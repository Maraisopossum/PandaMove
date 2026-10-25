import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { useImagePanda } from '../../core/images/usePandaVariante'
import type { Seance } from '../../core/db/types'
import { lireGroupes } from './catalog/filtreCatalogue'
import { libelleMuscle } from './catalog/libelles'
import type { ActionMenu } from './MenuActions'
import { filtrerSeances, SEUIL_RECHERCHE } from './rechercheSeances'
import { useAffectation, type SuccesAffectation } from './useAffectation'
import { useLancement } from './useLancement'
import { useSeanceDirecte } from './useSeanceDirecte'
import { useSeanceList } from './useSeanceList'
import { useSuppression } from './useSuppression'

/** Message de confirmation affiché sous les boutons, avec un lien utile éventuel. */
export interface Notice {
  texte: string
  lien?: { vers: string; libelle: string }
}

export interface CarteSeance {
  seance: Seance
  /** « Dos, Biceps · 45 min · 3 exercices » */
  details: string
  notes: string
  actions: ActionMenu[]
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

// Orchestration de l'écran « Séances types » : cartes prêtes à afficher (avec leur menu d'actions), recherche,
// affectation au calendrier, lancement immédiat, séance directe, duplication, archivage / désarchivage et suppression
// avec choix du sort de l'historique.
export function useListeSeancesEcran() {
  const liste = useSeanceList()
  const { archiver, desarchiver, dupliquer } = liste
  const navigate = useNavigate()
  const { session } = useAuth()
  const pandaVide = useImagePanda('pose_sitting', { userId: session?.user.id, taille: 'sm' })
  const [notice, setNotice] = useState<Notice | null>(null)
  const [requete, setRequete] = useState('')

  const surSuccesAffectation = useCallback(({ texte, instanceId }: SuccesAffectation) => {
    setNotice({
      texte,
      lien: instanceId
        ? { vers: `/strength/instance/${instanceId}`, libelle: 'Ouvrir la séance' }
        : { vers: '/strength/planned', libelle: 'Voir les séances programmées' },
    })
  }, [])
  const affectation = useAffectation(liste.affecter, surSuccesAffectation)

  const ouvrirInstance = useCallback((id: string) => navigate(`/strength/instance/${id}`), [navigate])
  const lancement = useLancement(liste.lancer, ouvrirInstance)
  const suppression = useSuppression(liste.compterHistorique, liste.supprimer)
  const directe = useSeanceDirecte(liste.creerDirecte, ouvrirInstance)

  const demanderDuplication = useCallback(
    async (s: Seance) => {
      const id = await dupliquer(s.id)
      if (id) setNotice({ texte: `« ${s.nom} (copie) » a été créée.`, lien: { vers: `/strength/${id}/edit`, libelle: 'Modifier la copie' } })
    },
    [dupliquer],
  )

  const demanderArchivage = useCallback(
    async (s: Seance) => {
      if (await archiver(s.id)) {
        setNotice({ texte: `« ${s.nom} » est archivée. Retrouvez-la plus bas, dans « Séances archivées », pour la restaurer.` })
      }
    },
    [archiver],
  )

  const demanderDesarchivage = useCallback(
    async (s: Seance) => {
      if (await desarchiver(s.id)) setNotice({ texte: `« ${s.nom} » est de retour dans vos séances types.` })
    },
    [desarchiver],
  )

  const details = useCallback(
    (s: Seance) => {
      const muscles = lireGroupes(s.groupesMusculaires).map(libelleMuscle).join(', ')
      return `${muscles || 'Aucun muscle'} · ${s.dureeEstimeeMin} min · ${pluriel(liste.nbExercices[s.id] ?? 0, 'exercice')}`
    },
    [liste.nbExercices],
  )

  const cartes: CarteSeance[] = useMemo(
    () =>
      filtrerSeances(liste.seances, requete).map((s) => ({
        seance: s,
        details: details(s),
        notes: s.notes.trim(),
        actions: [
          { id: 'modifier', libelle: 'Modifier', onChoisir: () => void navigate(`/strength/${s.id}/edit`) },
          { id: 'dupliquer', libelle: 'Dupliquer', onChoisir: () => void demanderDuplication(s) },
          { id: 'archiver', libelle: 'Archiver', onChoisir: () => void demanderArchivage(s) },
          { id: 'supprimer', libelle: 'Supprimer…', destructive: true, onChoisir: () => void suppression.ouvrir(s) },
        ],
      })),
    [liste.seances, requete, details, navigate, demanderDuplication, demanderArchivage, suppression],
  )

  const archivees: CarteSeance[] = useMemo(
    () =>
      liste.archivees.map((s) => ({
        seance: s,
        details: details(s),
        notes: '',
        actions: [
          { id: 'desarchiver', libelle: 'Désarchiver', onChoisir: () => void demanderDesarchivage(s) },
          { id: 'dupliquer', libelle: 'Dupliquer', onChoisir: () => void demanderDuplication(s) },
          { id: 'supprimer', libelle: 'Supprimer…', destructive: true, onChoisir: () => void suppression.ouvrir(s) },
        ],
      })),
    [liste.archivees, details, demanderDesarchivage, demanderDuplication, suppression],
  )

  return {
    charge: liste.charge,
    erreur: liste.erreur,
    notice,
    cartes,
    archivees,
    // Aucun modèle du tout (ni visible ni archivé) : état vide avec aide
    vide: liste.charge && liste.seances.length === 0 && liste.archivees.length === 0,
    // Seuls des modèles archivés subsistent
    aucuneActive: liste.charge && liste.seances.length === 0 && liste.archivees.length > 0,
    rechercheVisible: liste.seances.length >= SEUIL_RECHERCHE,
    requete,
    setRequete,
    aucunResultat: requete.trim() !== '' && cartes.length === 0,
    pandaVide,
    affectation,
    lancement,
    suppression,
    directe,
  }
}
