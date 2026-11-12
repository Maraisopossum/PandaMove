import { useCallback, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import { creerSortie, ErreurSortie, lireParEmpreinte, type Sport } from '../../../core/db/repos/sorties'
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
}

export interface DepsImportFit {
  db?: Db
  /** Lecture d'un fichier (défaut : décodage FIT / zip réel). Remplaçable dans les tests. */
  lire?: (fichier: File) => Promise<ActiviteFit>
  /** Appelé après au moins une sortie créée (l'écran relit sa liste). */
  apres?: () => void
}

// Import de fichiers d'activité (FIT, ou zip Garmin Connect) : chaque fichier est converti en sortie et enregistré ; une
// sortie déjà importée (même sport, même départ, même durée) est signalée sans être dupliquée. Un fichier en échec
// n'empêche pas les suivants.
export function useImportFit({ db, lire = lireFichierActivite, apres }: DepsImportFit = {}) {
  const [resultats, setResultats] = useState<ResultatImport[]>([])
  const [enCours, setEnCours] = useState(false)

  const importer = useCallback(
    async (fichiers: File[]) => {
      setEnCours(true)
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
          await creerSortie(base, saisie)
          sortie.push({ nom: fichier.name, etat: 'importee', message: `${LIBELLE_SPORT[saisie.sport]} du ${saisie.date} importée.`, sport: saisie.sport })
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

  return { resultats, enCours, importer, effacer: () => setResultats([]) }
}
