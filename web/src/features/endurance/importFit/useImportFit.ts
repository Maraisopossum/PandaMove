import { useCallback, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import { definirValidation, lirePlage, type SeanceCardio } from '../../../core/db/repos/seancesCardio'
import { creerSortie, ErreurSortie, lierSeance, lireParEmpreinte, type Sport } from '../../../core/db/repos/sorties'
import { LIBELLE_SPORT } from '../presentation'
import { convertirActiviteFit, ErreurImportFit, type ActiviteFit } from './convertirFit'
import { lireFichierActivite } from './lireFichier'

export type EtatImport = 'importee' | 'doublon' | 'erreur'

export interface ResultatImport {
  nom: string
  etat: EtatImport
  message: string
  /** Sport de la sortie créée (pour signaler un sport différent de l'écran courant). */
  sport?: Sport
  /** Sortie créée : permet de la lier à une séance du calendrier. */
  sortieId?: string
  /** Séances programmées du même sport proches de la date de la sortie, la plus proche d'abord (celle du jour en tête). */
  candidats?: SeanceCardio[]
  /** Séance à laquelle la sortie a été liée. */
  liee?: SeanceCardio
}

export interface DepsImportFit {
  db?: Db
  /** Lecture d'un fichier (défaut : décodage FIT / zip réel). Remplaçable dans les tests. */
  lire?: (fichier: File) => Promise<ActiviteFit>
  /** Appelé après au moins une sortie créée ou liée (l'écran relit sa liste). */
  apres?: () => void
}

/** Écart maximal, en jours, entre la sortie et une séance proposée pour le lien. */
export const ECART_LIEN_JOURS = 7

const JOUR_MS = 86_400_000
const jours = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / JOUR_MS)
const plusJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * JOUR_MS).toISOString().slice(0, 10)

// Séances programmées (non validées) du sport dans les ±7 jours de `date`, triées par écart puis par date.
export async function candidatsLien(db: Db, sport: Sport, date: string): Promise<SeanceCardio[]> {
  const proches = await lirePlage(db, sport, plusJours(date, -ECART_LIEN_JOURS), plusJours(date, ECART_LIEN_JOURS))
  return proches
    .filter((s) => !s.isValidated)
    .sort((a, b) => Math.abs(jours(a.date) - jours(date)) - Math.abs(jours(b.date) - jours(date)) || a.date.localeCompare(b.date))
}

// Import de fichiers d'activité (FIT, ou zip Garmin Connect) : chaque fichier est converti en sortie et enregistré ; une
// sortie déjà importée (même sport, même départ, même durée) est signalée sans être dupliquée. Un fichier en échec
// n'empêche pas les suivants. Après l'import, chaque sortie peut être liée à une séance programmée du calendrier
// (`lier`) : la sortie garde la séance, et la séance est validée.
export function useImportFit({ db, lire = lireFichierActivite, apres }: DepsImportFit = {}) {
  const [resultats, setResultats] = useState<ResultatImport[]>([])
  const [enCours, setEnCours] = useState(false)
  const [erreurLien, setErreurLien] = useState<string | null>(null)

  const importer = useCallback(
    async (fichiers: File[]) => {
      setEnCours(true)
      setErreurLien(null)
      const base = db ?? getDb()
      const sortie: ResultatImport[] = []
      for (const fichier of fichiers) {
        try {
          const saisie = convertirActiviteFit(await lire(fichier))
          const existante = saisie.empreinte ? await lireParEmpreinte(base, saisie.empreinte) : null
          if (existante) {
            sortie.push({ nom: fichier.name, etat: 'doublon', message: `Déjà importée (${existante.titre}).` })
            continue
          }
          const sortieId = await creerSortie(base, saisie)
          const candidats = await candidatsLien(base, saisie.sport, saisie.date).catch(() => [])
          sortie.push({ nom: fichier.name, etat: 'importee', message: `${LIBELLE_SPORT[saisie.sport]} du ${saisie.date} importée.`, sport: saisie.sport, sortieId, candidats })
        } catch (e) {
          if (e instanceof ErreurImportFit || e instanceof ErreurSortie) sortie.push({ nom: fichier.name, etat: 'erreur', message: e.message })
          else {
            console.error("Import d'une sortie impossible", e)
            sortie.push({ nom: fichier.name, etat: 'erreur', message: "L'import de ce fichier a échoué." })
          }
        }
      }
      setResultats(sortie)
      setEnCours(false)
      if (sortie.some((r) => r.etat === 'importee')) apres?.()
    },
    [db, lire, apres],
  )

  // Lie la sortie importée à la séance choisie et valide la séance. Une séance ne sert qu'à une sortie : elle disparaît des
  // choix des autres fichiers importés avec elle.
  const lier = useCallback(
    async (sortieId: string, seanceId: string) => {
      const cible = resultats.find((r) => r.sortieId === sortieId)
      const seance = cible?.candidats?.find((s) => s.id === seanceId)
      if (!cible?.sport || !seance) return
      setErreurLien(null)
      try {
        const base = db ?? getDb()
        await lierSeance(base, sortieId, seanceId)
        await definirValidation(base, cible.sport, seanceId, true)
        setResultats((liste) =>
          liste.map((r) =>
            r.sortieId === sortieId
              ? { ...r, liee: seance }
              : r.candidats
                ? { ...r, candidats: r.candidats.filter((s) => s.id !== seanceId) }
                : r,
          ),
        )
        apres?.()
      } catch (e) {
        console.error('Lien de la sortie à la séance impossible', e)
        setErreurLien('Le lien avec la séance du calendrier a échoué.')
      }
    },
    [db, resultats, apres],
  )

  return { resultats, enCours, erreurLien, importer, lier, effacer: () => setResultats([]) }
}
