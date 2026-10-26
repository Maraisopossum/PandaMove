import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { getDb } from '../../core/db/client'
import { useImagePanda } from '../../core/images/usePandaVariante'
import type { Seance } from '../../core/db/types'
import { lireGroupes } from './catalog/filtreCatalogue'
import { libelleMuscle } from './catalog/libelles'
import type { ActionMenu } from './MenuActions'
import { filtrerSeances, SEUIL_RECHERCHE } from './rechercheSeances'
import { supprimerInstancesSelection } from './suppressionSelection'
import { useEcranListeInstances } from './useEcranListeInstances'
import { useAffectation, type SuccesAffectation } from './useAffectation'
import { useLancement } from './useLancement'
import { useSeanceDirecte } from './useSeanceDirecte'
import { useSeanceList } from './useSeanceList'
import { useSelection } from './useSelection'
import { useSuppression } from './useSuppression'
import { useSuppressionSelection } from './useSuppressionSelection'

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

/** Séances terminées visibles avant « Voir les N autres » (MAX_COMPLETED_VISIBLE Android). */
export const TERMINEES_VISIBLES = 5

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
  // Sélection multiple (appui long ou bouton « Sélectionner ») : suppression groupée comme l'Android
  const selection = useSelection()
  // Séances jouées de l'écran à sections : mêmes lignes et mêmes actions que les vues complètes, sélection partagée
  const programmees = useEcranListeInstances('programmees', {}, selection)
  const terminees = useEcranListeInstances('terminees', {}, selection)
  const [toutesTerminees, setToutesTerminees] = useState(false)
  const { recharger: rechargerProgrammees } = programmees
  const { recharger: rechargerTerminees } = terminees
  // Toute écriture sur les modèles qui crée, supprime ou rend visibles des séances jouées relit aussi les sections
  const puisRecharger = useCallback(
    <A extends unknown[], R>(ecrire: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        try {
          return await ecrire(...args)
        } finally {
          await Promise.all([rechargerProgrammees(), rechargerTerminees()])
        }
      },
    [rechargerProgrammees, rechargerTerminees],
  )
  const affecter = useMemo(() => puisRecharger(liste.affecter), [puisRecharger, liste.affecter])
  const supprimerModele = useMemo(() => puisRecharger(liste.supprimer), [puisRecharger, liste.supprimer])
  const creerDirecte = useMemo(() => puisRecharger(liste.creerDirecte), [puisRecharger, liste.creerDirecte])
  const lancer = useMemo(() => puisRecharger(liste.lancer), [puisRecharger, liste.lancer])

  const affectation = useAffectation(affecter, surSuccesAffectation)

  const ouvrirInstance = useCallback((id: string) => navigate(`/strength/instance/${id}`), [navigate])
  const lancement = useLancement(lancer, ouvrirInstance)
  const suppression = useSuppression(liste.compterHistorique, supprimerModele)
  const directe = useSeanceDirecte(creerDirecte, ouvrirInstance)
  const { supprimerSelection } = liste
  // Suppression groupée (Android : deleteSeances + deleteInstances) : d'abord les séances jouées, puis les types
  // (un type dont toutes les séances jouées viennent d'être supprimées n'a plus d'historique à conserver).
  const executerSelection = useCallback(
    async (ids: string[]) => {
      const types = new Set([...liste.seances, ...liste.archivees].map((s) => s.id))
      try {
        const jouees = ids.filter((id) => !types.has(id))
        if (jouees.length > 0) await supprimerInstancesSelection(getDb(), jouees)
        const modeles = ids.filter((id) => types.has(id))
        if (modeles.length > 0) await supprimerSelection(modeles)
      } finally {
        await Promise.all([rechargerProgrammees(), rechargerTerminees()])
      }
    },
    [liste.seances, liste.archivees, supprimerSelection, rechargerProgrammees, rechargerTerminees],
  )
  const suppressionSelection = useSuppressionSelection(executerSelection, selection.quitter)
  const compteSelection = useMemo(() => {
    const types = new Set(liste.seances.map((s) => s.id))
    const archivees = new Set(liste.archivees.map((s) => s.id))
    const planifiees = new Set(programmees.lignes.map((l) => l.id))
    const finies = new Set(terminees.lignes.map((l) => l.id))
    const nb = (ensemble: Set<string>) => selection.identifiants.filter((id) => ensemble.has(id)).length
    return { types: nb(types), archivees: nb(archivees), planifiees: nb(planifiees), terminees: nb(finies) }
  }, [liste.seances, liste.archivees, programmees.lignes, terminees.lignes, selection.identifiants])
  const termineesVisibles = toutesTerminees ? terminees.lignes : terminees.lignes.slice(0, TERMINEES_VISIBLES)

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
    // Rien du tout (ni modèle, visible ou archivé, ni séance jouée) : état vide avec aide
    vide:
      liste.charge && liste.seances.length === 0 && liste.archivees.length === 0 &&
      !programmees.chargement && !terminees.chargement && programmees.lignes.length === 0 && terminees.lignes.length === 0,
    programmees,
    terminees,
    termineesVisibles,
    nbTermineesCachees: terminees.lignes.length - termineesVisibles.length,
    toutesTerminees,
    basculerTerminees: () => setToutesTerminees((t) => !t),
    erreurInstances: programmees.erreur ?? terminees.erreur ?? programmees.erreurAction ?? terminees.erreurAction,
    // Seuls des modèles archivés subsistent
    aucuneActive: liste.charge && liste.seances.length === 0 && liste.archivees.length > 0,
    // Aucun type actif mais des séances jouées ou archivées : la section des types n'est pas affichée
    aTypes: liste.seances.length > 0,
    rechercheVisible: liste.seances.length >= SEUIL_RECHERCHE,
    requete,
    setRequete,
    aucunResultat: requete.trim() !== '' && cartes.length === 0,
    pandaVide,
    affectation,
    lancement,
    suppression,
    directe,
    selection,
    suppressionSelection,
    compteSelection,
  }
}
