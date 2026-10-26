import type { RepsType, TypeExercice } from '../../core/db/types'

// Brouillon d'édition d'une séance modèle : types et fonctions PURES (aucune mutation des entrées).
// La séance est une liste UNIFIÉE d'items, comme sur Android (SeanceItem) : exercices libres et blocs
// s'entrelacent selon leur ordre. L'ordre des tableaux est la seule source de vérité : `position` n'est
// qu'un reflet recalculé par renumeroter() (piège connu Android : ne jamais se fier à une position périmée).

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
  // Affichage et calcul uniquement (non persistés tels quels)
  exerciseNom: string
  muscles: string[]
  // Équipement de la fiche du catalogue : sert à l'indice de charge composable et à l'aperçu de montée
  equipementCatalogue: string[]
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
  // Circuit uniquement : nombre de séries commun, propagé aux exercices à l'enregistrement
  nombreSeriesPrevues: number
  exercices: ExerciceDraft[]
}

export type ItemDraft = { kind: 'libre'; exercice: ExerciceDraft } | { kind: 'bloc'; bloc: BlocDraft }

export interface SeanceDraft {
  id: string
  // false tant que la séance n'a jamais été enregistrée
  existante: boolean
  nom: string
  notes: string
  dureeEstimeeMin: number
  seanceCategory: string
  createdAt: string | null
  items: ItemDraft[]
}

// Données minimales du catalogue nécessaires pour ajouter un exercice.
export interface ExerciceCatalogue {
  id: string
  name: string
  muscles: string[]
  equipment: string[]
  isBodyweight: boolean
}

export const blocsDe = (d: SeanceDraft): BlocDraft[] => d.items.flatMap((i) => (i.kind === 'bloc' ? [i.bloc] : []))

// Tous les exercices, dans l'ordre d'affichage (libres et blocs entrelacés).
export const exercicesDe = (d: SeanceDraft): ExerciceDraft[] =>
  d.items.flatMap((i) => (i.kind === 'libre' ? [i.exercice] : i.bloc.exercices))

export function brouillonVide(id: string): SeanceDraft {
  return { id, existante: false, nom: '', notes: '', dureeEstimeeMin: 60, seanceCategory: 'STRENGTH', createdAt: null, items: [] }
}

export function nouveauBloc(id: string, type: TypeBloc): BlocDraft {
  return {
    id, nom: LIBELLES_BLOC[type], type, position: 0, dureeMin: null, description: '',
    tempsReposInterSec: 20, tempsReposFinRoundSec: 120, nombreSeriesPrevues: 3, exercices: [],
  }
}

// Défauts alignés sur ExerciceDraft Android ; un circuit travaille en durée. `typeBloc` null : exercice libre.
export function nouvelExercice(id: string, exo: ExerciceCatalogue, typeBloc: TypeBloc | null): ExerciceDraft {
  return {
    id, exerciseId: exo.id, exerciseNom: exo.name, muscles: exo.muscles, equipementCatalogue: exo.equipment,
    position: 0, supersetGroupe: null,
    nombreSeriesPrevues: 3, repsCibles: '', chargeCible: '', tempo: '',
    repsType: typeBloc === 'CIRCUIT' ? 'DURATION' : 'REPS',
    tempsReposSec: 90, consigneCle: '', equipement: '', avertissement: '', isBilateral: false,
    progressionActivee: false, systemeProgression: null, repsMin: null, repsMax: null, incrementKg: null,
    incrementDureeSec: 5, seuilDeload: 3, typeExercice: null, incrementPct: null, isBodyweight: exo.isBodyweight,
  }
}

// Positions 0..n-1 d'après l'ORDRE du brouillon : items sur une échelle commune (libres et blocs
// entrelacés, comme Android), exercices au sein de leur bloc.
export function renumeroter(d: SeanceDraft): SeanceDraft {
  return {
    ...d,
    items: d.items.map((item, i): ItemDraft =>
      item.kind === 'libre'
        ? { kind: 'libre', exercice: { ...item.exercice, position: i } }
        : {
            kind: 'bloc',
            bloc: { ...item.bloc, position: i, exercices: item.bloc.exercices.map((e, j) => ({ ...e, position: j })) },
          },
    ),
  }
}

export function ajouterBloc(d: SeanceDraft, bloc: BlocDraft): SeanceDraft {
  return renumeroter({ ...d, items: [...d.items, { kind: 'bloc', bloc }] })
}

// Insère un bloc en tête de liste (ajout d'un modèle d'échauffement, comme Android addWarmupToSeance).
export function insererBlocAuDebut(d: SeanceDraft, bloc: BlocDraft): SeanceDraft {
  return renumeroter({ ...d, items: [{ kind: 'bloc', bloc }, ...d.items] })
}

// `blocId` null : exercice libre, ajouté à la fin de la liste.
export function ajouterExercice(d: SeanceDraft, blocId: string | null, ex: ExerciceDraft): SeanceDraft {
  if (blocId === null) return renumeroter({ ...d, items: [...d.items, { kind: 'libre', exercice: ex }] })
  if (!blocsDe(d).some((b) => b.id === blocId)) return d
  return renumeroter({
    ...d,
    items: d.items.map((i): ItemDraft =>
      i.kind === 'bloc' && i.bloc.id === blocId ? { kind: 'bloc', bloc: { ...i.bloc, exercices: [...i.bloc.exercices, ex] } } : i,
    ),
  })
}

export function supprimerBloc(d: SeanceDraft, blocId: string): SeanceDraft {
  return renumeroter({ ...d, items: d.items.filter((i) => !(i.kind === 'bloc' && i.bloc.id === blocId)) })
}

// Exercice libre ou exercice d'un bloc.
export function supprimerExercice(d: SeanceDraft, exerciceId: string): SeanceDraft {
  return renumeroter({
    ...d,
    items: d.items
      .filter((i) => !(i.kind === 'libre' && i.exercice.id === exerciceId))
      .map((i): ItemDraft =>
        i.kind === 'bloc' ? { kind: 'bloc', bloc: { ...i.bloc, exercices: i.bloc.exercices.filter((e) => e.id !== exerciceId) } } : i,
      ),
  })
}

// Modification de champs sans changement d'ordre : pas de renumérotation.
export function modifierBloc(d: SeanceDraft, blocId: string, patch: Partial<Omit<BlocDraft, 'id' | 'exercices'>>): SeanceDraft {
  return {
    ...d,
    items: d.items.map((i): ItemDraft => (i.kind === 'bloc' && i.bloc.id === blocId ? { kind: 'bloc', bloc: { ...i.bloc, ...patch } } : i)),
  }
}

export function modifierExercice(d: SeanceDraft, exerciceId: string, patch: Partial<Omit<ExerciceDraft, 'id'>>): SeanceDraft {
  return transformerExercice(d, exerciceId, (e) => ({ ...e, ...patch }))
}

// Remplace un exercice (libre ou en bloc) par le résultat de `transformer` ; l'ordre ne change pas.
export function transformerExercice(d: SeanceDraft, exerciceId: string, transformer: (e: ExerciceDraft) => ExerciceDraft): SeanceDraft {
  const maj = (e: ExerciceDraft) => (e.id === exerciceId ? transformer(e) : e)
  return {
    ...d,
    items: d.items.map((i): ItemDraft =>
      i.kind === 'libre'
        ? { kind: 'libre', exercice: maj(i.exercice) }
        : { kind: 'bloc', bloc: { ...i.bloc, exercices: i.bloc.exercices.map(maj) } },
    ),
  }
}

// Change le type d'un bloc existant. Le nom suit le type tant qu'il est vide ou égal au libellé de
// l'ancien type (un nom choisi par l'utilisateur est conservé). Vers un circuit : exercices en durée, séries
// communes reprises du premier exercice. Vers échauffement / activation : pas de surcharge progressive
// (non applicable, bible §0.3), elle est donc désactivée sur ses exercices.
export function changerTypeBloc(d: SeanceDraft, blocId: string, type: TypeBloc): SeanceDraft {
  const bloc = blocsDe(d).find((b) => b.id === blocId)
  if (!bloc || bloc.type === type) return d
  const suitLeType = bloc.nom.trim() === '' || bloc.nom === LIBELLES_BLOC[bloc.type]
  const exercices = bloc.exercices.map((e) => {
    if (type === 'CIRCUIT') return { ...e, repsType: 'DURATION' as const }
    if ((type === 'ECHAUFFEMENT' || type === 'ACTIVATION') && e.progressionActivee) return { ...e, progressionActivee: false }
    return e
  })
  const series = type === 'CIRCUIT' ? (bloc.exercices[0]?.nombreSeriesPrevues ?? bloc.nombreSeriesPrevues) : bloc.nombreSeriesPrevues
  return {
    ...d,
    items: d.items.map((i): ItemDraft =>
      i.kind === 'bloc' && i.bloc.id === blocId
        ? { kind: 'bloc', bloc: { ...i.bloc, type, nom: suitLeType ? LIBELLES_BLOC[type] : i.bloc.nom, nombreSeriesPrevues: series, exercices } }
        : i,
    ),
  }
}

// Copie juste après l'original (même bloc, ou liste pour un exercice libre) sous un nouvel id.
export function dupliquerExercice(d: SeanceDraft, exerciceId: string, nouvelId: string): SeanceDraft {
  const copie = (e: ExerciceDraft): ExerciceDraft[] => [e, { ...e, id: nouvelId }]
  if (!exercicesDe(d).some((e) => e.id === exerciceId)) return d
  return renumeroter({
    ...d,
    items: d.items.flatMap((i): ItemDraft[] =>
      i.kind === 'libre'
        ? i.exercice.id === exerciceId
          ? copie(i.exercice).map((exercice) => ({ kind: 'libre' as const, exercice }))
          : [i]
        : [{ kind: 'bloc', bloc: { ...i.bloc, exercices: i.bloc.exercices.flatMap((e) => (e.id === exerciceId ? copie(e) : [e])) } }],
    ),
  })
}

function echanger<T>(liste: T[], i: number, j: number): T[] {
  const copie = [...liste]
  ;[copie[i], copie[j]] = [copie[j], copie[i]]
  return copie
}

const idItem = (i: ItemDraft) => (i.kind === 'libre' ? i.exercice.id : i.bloc.id)

// Cible d'un déplacement : `id` est un bloc, un exercice libre (parmi les items) ou un exercice de bloc
// (dans son bloc seulement : Android ne déplace pas un exercice d'un bloc à l'autre).
function cibleDeplacement(d: SeanceDraft, id: string, sens: -1 | 1): { items: ItemDraft[]; index: number; bloc?: string } | null {
  const iItem = d.items.findIndex((i) => idItem(i) === id)
  if (iItem >= 0) {
    const cible = iItem + sens
    return cible >= 0 && cible < d.items.length ? { items: d.items, index: iItem } : null
  }
  for (const i of d.items) {
    if (i.kind !== 'bloc') continue
    const iEx = i.bloc.exercices.findIndex((e) => e.id === id)
    if (iEx < 0) continue
    const cible = iEx + sens
    return cible >= 0 && cible < i.bloc.exercices.length ? { items: d.items, index: iEx, bloc: i.bloc.id } : null
  }
  return null
}

export function peutDeplacer(d: SeanceDraft, id: string, sens: -1 | 1): boolean {
  return cibleDeplacement(d, id, sens) !== null
}

// Monte (-1) ou descend (+1) d'un cran. Aux extrémités ou pour un id inconnu : le brouillon d'origine est renvoyé.
export function deplacerRelatif(d: SeanceDraft, id: string, sens: -1 | 1): SeanceDraft {
  const cible = cibleDeplacement(d, id, sens)
  if (!cible) return d
  if (cible.bloc === undefined) return renumeroter({ ...d, items: echanger(d.items, cible.index, cible.index + sens) })
  return renumeroter({
    ...d,
    items: d.items.map((i): ItemDraft =>
      i.kind === 'bloc' && i.bloc.id === cible.bloc
        ? { kind: 'bloc', bloc: { ...i.bloc, exercices: echanger(i.bloc.exercices, cible.index, cible.index + sens) } }
        : i,
    ),
  })
}

// Circuit : le nombre de séries du bloc s'applique à chacun de ses exercices, tous en durée (Android
// updateExistingSeanceContent / updateExerciceInBloc).
export function appliquerSeriesCircuit(d: SeanceDraft): SeanceDraft {
  return {
    ...d,
    items: d.items.map((i): ItemDraft =>
      i.kind === 'bloc' && i.bloc.type === 'CIRCUIT'
        ? {
            kind: 'bloc',
            bloc: {
              ...i.bloc,
              exercices: i.bloc.exercices.map((e) => ({ ...e, nombreSeriesPrevues: i.bloc.nombreSeriesPrevues, repsType: 'DURATION' as const })),
            },
          }
        : i,
    ),
  }
}

// Union sans doublon (ordre d'apparition) des muscles des exercices : champ groupes_musculaires.
export function groupesMusculaires(d: SeanceDraft): string[] {
  const vus = new Set<string>()
  for (const e of exercicesDe(d)) for (const m of e.muscles) if (m) vus.add(m)
  return [...vus]
}

const entierDans = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
const nombreDans = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max

function erreursExercice(e: ExerciceDraft): string[] {
  const erreurs: string[] = []
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
  return erreurs
}

// Toutes les erreurs de validation, en français (liste vide = enregistrable).
// Une séance vide (sans bloc ni exercice) reste enregistrable, comme sur Android.
export function validerBrouillon(d: SeanceDraft): string[] {
  const erreurs: string[] = []
  if (d.nom.trim() === '') erreurs.push('Le nom de la séance est obligatoire.')
  else if (d.nom.trim().length > 100) erreurs.push('Le nom de la séance est limité à 100 caractères.')
  if (!entierDans(d.dureeEstimeeMin, 1, 600)) erreurs.push('La durée estimée doit être un nombre entier de minutes entre 1 et 600.')

  for (const item of d.items) {
    if (item.kind === 'libre') {
      erreurs.push(...erreursExercice(item.exercice))
      continue
    }
    const b = item.bloc
    const bloc = `Bloc « ${b.nom || LIBELLES_BLOC[b.type]} »`
    if (b.dureeMin !== null && !entierDans(b.dureeMin, 1, 600)) erreurs.push(`${bloc} : la durée du bloc doit être entre 1 et 600 minutes.`)
    if (!entierDans(b.tempsReposInterSec, 0, 3600) || !entierDans(b.tempsReposFinRoundSec, 0, 3600)) {
      erreurs.push(`${bloc} : les temps de repos doivent être entre 0 et 3600 secondes.`)
    }
    if (b.type === 'CIRCUIT' && !entierDans(b.nombreSeriesPrevues, 1, 20)) {
      erreurs.push(`${bloc} : le nombre de séries du circuit doit être entre 1 et 20.`)
    }
    for (const e of b.exercices) {
      // Circuit : le nombre de séries vient du bloc (propagé à l'enregistrement), pas de l'exercice
      const verifie = b.type === 'CIRCUIT' ? { ...e, nombreSeriesPrevues: 1 } : e
      erreurs.push(...erreursExercice(verifie))
    }
  }

  // Circuit : chaque exercice a besoin d'une durée (repsCibles en secondes), comme sur Android
  const sansDuree = blocsDe(d)
    .filter((b) => b.type === 'CIRCUIT')
    .flatMap((b) => b.exercices)
    .filter((e) => !(Number.parseInt(e.repsCibles, 10) > 0))
  if (sansDuree.length > 0) erreurs.push(`Durée manquante pour : ${sansDuree.map((e) => e.exerciseNom).join(', ')}`)
  return erreurs
}
