import type { RepsType, TypeExercice } from '../../core/db/types'

// Brouillon d'édition d'une séance modèle : types et fonctions PURES (aucune mutation des entrées).
// L'ordre des tableaux est la seule source de vérité : `position` n'est qu'un reflet recalculé
// par renumeroter() (piège connu Android : ne jamais se fier à une position périmée).

export const TYPES_BLOC = ['ECHAUFFEMENT', 'ACTIVATION', 'SUPERSET', 'CIRCUIT', 'RECUPERATION'] as const
export type TypeBloc = (typeof TYPES_BLOC)[number]

export const LIBELLES_BLOC: Record<TypeBloc, string> = {
  ECHAUFFEMENT: 'Échauffement',
  ACTIVATION: 'Activation',
  SUPERSET: 'Superset',
  CIRCUIT: 'Circuit',
  RECUPERATION: 'Récupération',
}

export interface ExerciceDraft {
  id: string
  exerciseId: string
  // Affichage et calcul des groupes musculaires uniquement (non persistés tels quels)
  exerciseNom: string
  muscles: string[]
  position: number
  supersetGroupe: string | null
  nombreSeriesPrevues: number
  repsCibles: string
  chargeCible: string
  tempo: string
  repsType: RepsType
  tempsReposSec: number
  consigneCle: string
  equipement: string
  avertissement: string
  isBilateral: boolean
  progressionActivee: boolean
  systemeProgression: string | null
  repsMin: number | null
  repsMax: number | null
  incrementKg: number | null
  incrementDureeSec: number
  seuilDeload: number
  typeExercice: TypeExercice | null
  incrementPct: number | null
  isBodyweight: boolean
}

export interface BlocDraft {
  id: string
  nom: string
  type: TypeBloc
  position: number
  dureeMin: number | null
  description: string
  tempsReposInterSec: number
  tempsReposFinRoundSec: number
  exercices: ExerciceDraft[]
}

export interface SeanceDraft {
  id: string
  // false tant que la séance n'a jamais été enregistrée
  existante: boolean
  nom: string
  notes: string
  dureeEstimeeMin: number
  seanceCategory: string
  createdAt: string | null
  blocs: BlocDraft[]
}

// Données minimales du catalogue nécessaires pour ajouter un exercice.
export interface ExerciceCatalogue {
  id: string
  name: string
  muscles: string[]
  isBodyweight: boolean
}

export function brouillonVide(id: string): SeanceDraft {
  return { id, existante: false, nom: '', notes: '', dureeEstimeeMin: 60, seanceCategory: 'STRENGTH', createdAt: null, blocs: [] }
}

export function nouveauBloc(id: string, type: TypeBloc): BlocDraft {
  return {
    id, nom: LIBELLES_BLOC[type], type, position: 0, dureeMin: null, description: '',
    tempsReposInterSec: 20, tempsReposFinRoundSec: 120, exercices: [],
  }
}

// Défauts alignés sur ExerciceDraft Android ; un circuit travaille en durée.
export function nouvelExercice(id: string, exo: ExerciceCatalogue, typeBloc: TypeBloc): ExerciceDraft {
  return {
    id, exerciseId: exo.id, exerciseNom: exo.name, muscles: exo.muscles, position: 0, supersetGroupe: null,
    nombreSeriesPrevues: 3, repsCibles: '', chargeCible: '', tempo: '',
    repsType: typeBloc === 'CIRCUIT' ? 'DURATION' : 'REPS',
    tempsReposSec: 90, consigneCle: '', equipement: '', avertissement: '', isBilateral: false,
    progressionActivee: false, systemeProgression: null, repsMin: null, repsMax: null, incrementKg: null,
    incrementDureeSec: 5, seuilDeload: 3, typeExercice: null, incrementPct: null, isBodyweight: exo.isBodyweight,
  }
}

// Positions 0..n-1 d'après l'ORDRE du brouillon (blocs entre eux, exercices au sein de leur bloc).
export function renumeroter(d: SeanceDraft): SeanceDraft {
  return {
    ...d,
    blocs: d.blocs.map((b, i) => ({
      ...b,
      position: i,
      exercices: b.exercices.map((e, j) => ({ ...e, position: j })),
    })),
  }
}

export function ajouterBloc(d: SeanceDraft, bloc: BlocDraft): SeanceDraft {
  return renumeroter({ ...d, blocs: [...d.blocs, bloc] })
}

export function supprimerBloc(d: SeanceDraft, blocId: string): SeanceDraft {
  return renumeroter({ ...d, blocs: d.blocs.filter((b) => b.id !== blocId) })
}

export function ajouterExercice(d: SeanceDraft, blocId: string, ex: ExerciceDraft): SeanceDraft {
  if (!d.blocs.some((b) => b.id === blocId)) return d
  return renumeroter({
    ...d,
    blocs: d.blocs.map((b) => (b.id === blocId ? { ...b, exercices: [...b.exercices, ex] } : b)),
  })
}

export function supprimerExercice(d: SeanceDraft, exerciceId: string): SeanceDraft {
  return renumeroter({
    ...d,
    blocs: d.blocs.map((b) => ({ ...b, exercices: b.exercices.filter((e) => e.id !== exerciceId) })),
  })
}

// Modification de champs sans changement d'ordre : pas de renumérotation.
export function modifierBloc(d: SeanceDraft, blocId: string, patch: Partial<Omit<BlocDraft, 'id' | 'exercices'>>): SeanceDraft {
  return { ...d, blocs: d.blocs.map((b) => (b.id === blocId ? { ...b, ...patch } : b)) }
}

export function modifierExercice(d: SeanceDraft, exerciceId: string, patch: Partial<Omit<ExerciceDraft, 'id'>>): SeanceDraft {
  return {
    ...d,
    blocs: d.blocs.map((b) => ({ ...b, exercices: b.exercices.map((e) => (e.id === exerciceId ? { ...e, ...patch } : e)) })),
  }
}

const borner = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)

// Déplace un exercice. `versPosition` = index dans le bloc cible APRÈS retrait de l'exercice
// (borné à [0, longueur]) ; bloc cible = `versBlocId`, sinon le bloc actuel de l'exercice.
// Exercice ou bloc inconnu : le brouillon d'origine est renvoyé tel quel.
export function deplacerExercice(d: SeanceDraft, exerciceId: string, versPosition: number, versBlocId?: string): SeanceDraft {
  const source = d.blocs.find((b) => b.exercices.some((e) => e.id === exerciceId))
  if (!source) return d
  const cibleId = versBlocId ?? source.id
  if (!d.blocs.some((b) => b.id === cibleId)) return d
  const exercice = source.exercices.find((e) => e.id === exerciceId)!
  const sansLui = d.blocs.map((b) => ({ ...b, exercices: b.exercices.filter((e) => e.id !== exerciceId) }))
  return renumeroter({
    ...d,
    blocs: sansLui.map((b) => {
      if (b.id !== cibleId) return b
      const index = borner(Number.isFinite(versPosition) ? Math.trunc(versPosition) : 0, 0, b.exercices.length)
      return { ...b, exercices: [...b.exercices.slice(0, index), exercice, ...b.exercices.slice(index)] }
    }),
  })
}

// Monte (-1) ou descend (+1) d'un cran ; à la limite d'un bloc l'exercice passe dans le bloc voisin
// (fin du précédent / début du suivant). Aux extrémités de la séance : sans effet.
export function deplacerExerciceRelatif(d: SeanceDraft, exerciceId: string, sens: -1 | 1): SeanceDraft {
  const iBloc = d.blocs.findIndex((b) => b.exercices.some((e) => e.id === exerciceId))
  if (iBloc < 0) return d
  const bloc = d.blocs[iBloc]
  const iEx = bloc.exercices.findIndex((e) => e.id === exerciceId)
  const cible = iEx + sens
  if (cible >= 0 && cible < bloc.exercices.length) return deplacerExercice(d, exerciceId, cible)
  const voisin = d.blocs[iBloc + sens]
  if (!voisin) return d
  return deplacerExercice(d, exerciceId, sens === -1 ? voisin.exercices.length : 0, voisin.id)
}

export function deplacerBloc(d: SeanceDraft, blocId: string, versPosition: number): SeanceDraft {
  const bloc = d.blocs.find((b) => b.id === blocId)
  if (!bloc) return d
  const autres = d.blocs.filter((b) => b.id !== blocId)
  const index = borner(Number.isFinite(versPosition) ? Math.trunc(versPosition) : 0, 0, autres.length)
  return renumeroter({ ...d, blocs: [...autres.slice(0, index), bloc, ...autres.slice(index)] })
}

// Union sans doublon (ordre d'apparition) des muscles des exercices : champ groupes_musculaires.
export function groupesMusculaires(d: SeanceDraft): string[] {
  const vus = new Set<string>()
  for (const b of d.blocs) for (const e of b.exercices) for (const m of e.muscles) if (m) vus.add(m)
  return [...vus]
}

const entierDans = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
const nombreDans = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max

// Toutes les erreurs de validation, en français (liste vide = enregistrable).
// Une séance vide (sans bloc ni exercice) reste enregistrable, comme sur Android.
export function validerBrouillon(d: SeanceDraft): string[] {
  const erreurs: string[] = []
  if (d.nom.trim() === '') erreurs.push('Le nom de la séance est obligatoire.')
  else if (d.nom.trim().length > 100) erreurs.push('Le nom de la séance est limité à 100 caractères.')
  if (!entierDans(d.dureeEstimeeMin, 1, 600)) erreurs.push('La durée estimée doit être un nombre entier de minutes entre 1 et 600.')

  for (const b of d.blocs) {
    const bloc = `Bloc « ${b.nom || LIBELLES_BLOC[b.type]} »`
    if (b.dureeMin !== null && !entierDans(b.dureeMin, 1, 600)) erreurs.push(`${bloc} : la durée du bloc doit être entre 1 et 600 minutes.`)
    if (!entierDans(b.tempsReposInterSec, 0, 3600) || !entierDans(b.tempsReposFinRoundSec, 0, 3600)) {
      erreurs.push(`${bloc} : les temps de repos doivent être entre 0 et 3600 secondes.`)
    }
    for (const e of b.exercices) {
      const n = e.exerciseNom
      if (!entierDans(e.nombreSeriesPrevues, 1, 20)) erreurs.push(`${n} : le nombre de séries doit être entre 1 et 20.`)
      if (!entierDans(e.tempsReposSec, 0, 3600)) erreurs.push(`${n} : le temps de repos doit être entre 0 et 3600 secondes.`)
      if (e.repsMin !== null && !entierDans(e.repsMin, 1, 1000)) erreurs.push(`${n} : les répétitions minimales doivent être entre 1 et 1000.`)
      if (e.repsMax !== null && !entierDans(e.repsMax, 1, 1000)) erreurs.push(`${n} : les répétitions maximales doivent être entre 1 et 1000.`)
      if (e.repsMin !== null && e.repsMax !== null && entierDans(e.repsMin, 1, 1000) && entierDans(e.repsMax, 1, 1000) && e.repsMin > e.repsMax) {
        erreurs.push(`${n} : le minimum de répétitions dépasse le maximum.`)
      }
      if (e.incrementKg !== null && !nombreDans(e.incrementKg, 0, 500)) erreurs.push(`${n} : l'incrément en kg doit être entre 0 et 500.`)
      if (e.incrementPct !== null && !nombreDans(e.incrementPct, 0, 100)) erreurs.push(`${n} : le pourcentage d'incrément doit être entre 0 et 100.`)
      if (!entierDans(e.seuilDeload, 1, 10)) erreurs.push(`${n} : le seuil de deload doit être entre 1 et 10.`)
      if (!entierDans(e.incrementDureeSec, 1, 600)) erreurs.push(`${n} : l'incrément de durée doit être entre 1 et 600 secondes.`)
    }
  }

  // Circuit : chaque exercice a besoin d'une durée (repsCibles en secondes), comme sur Android
  const sansDuree = d.blocs
    .filter((b) => b.type === 'CIRCUIT')
    .flatMap((b) => b.exercices)
    .filter((e) => !(Number.parseInt(e.repsCibles, 10) > 0))
  if (sansDuree.length > 0) erreurs.push(`Durée manquante pour : ${sansDuree.map((e) => e.exerciseNom).join(', ')}`)
  return erreurs
}
