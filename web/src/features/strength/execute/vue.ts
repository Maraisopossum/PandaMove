import { parseTimestamp } from '../../../core/common/parseTimestamp'
import type { BlocSeance, ExerciceSeance, RepsType, SerieRealisee } from '../../../core/db/types'

// Fonctions pures de l'écran d'exécution : construction de la vue, validation des mesures, formats.

export interface SerieVue {
  id: string
  numero: number
  // Répétitions, ou SECONDES pour un exercice DURATION
  reps: number | null
  chargeKg: number | null
  rpe: number | null
  updatedAt: string
  // Ancre du repos : instant de validation (validated_at), à défaut updated_at (séries antérieures à 0006)
  valideeA: string
}

export interface ExerciceVue {
  id: string
  exerciseId: string
  nom: string
  repsType: RepsType
  libelleReps: string
  repsCibles: string
  chargeCible: string
  nombreSeriesPrevues: number
  tempsReposSec: number
  blocId: string | null
  position: number
  supersetGroupe: string | null
  libelleSuperset: string | null
  // Superset : nom de l'exercice suivant du groupe, à enchaîner sans repos (null pour le dernier ou hors superset)
  enchaineAvec: string | null
  series: SerieVue[]
}

export interface BlocVue {
  // null : exercices hors bloc
  id: string | null
  nom: string
  exercices: ExerciceVue[]
}

export interface Mesures {
  reps: number
  chargeKg: number | null
  rpe: number | null
}

export const libelleReps = (repsType: RepsType) => (repsType === 'DURATION' ? 'Durée (s)' : 'Répétitions')

// Blocs triés par position, exercices triés par position dans leur bloc ; les exercices hors bloc
// (ou dont le bloc n'existe plus) forment un groupe final « Exercices ». Les séries vivantes
// (déjà dédoublonnées par listSeries) sont rattachées et triées par numéro.
export function construireVue(
  blocs: BlocSeance[],
  exercices: ExerciceSeance[],
  series: SerieRealisee[],
  noms: Map<string, string>,
): { blocs: BlocVue[]; exercices: ExerciceVue[] } {
  const parExercice = new Map<string, SerieVue[]>()
  for (const s of series) {
    const liste = parExercice.get(s.exerciceSeanceId) ?? []
    liste.push({ id: s.id, numero: s.numeroSerie, reps: s.repsRealisees, chargeKg: s.chargeKg, rpe: s.rpe, updatedAt: s.updatedAt, valideeA: s.validatedAt ?? s.updatedAt })
    parExercice.set(s.exerciceSeanceId, liste)
  }
  const versVue = (e: ExerciceSeance): ExerciceVue => ({
    id: e.id,
    exerciseId: e.exerciseId,
    nom: noms.get(e.exerciseId) ?? 'Exercice inconnu',
    repsType: e.repsType,
    libelleReps: libelleReps(e.repsType),
    repsCibles: e.repsCibles,
    chargeCible: e.chargeCible,
    nombreSeriesPrevues: e.nombreSeriesPrevues,
    tempsReposSec: e.tempsReposSec,
    blocId: e.blocId,
    position: e.position,
    supersetGroupe: e.supersetGroupe,
    libelleSuperset: e.supersetGroupe ? `Superset ${e.supersetGroupe}` : null,
    enchaineAvec: null,
    series: (parExercice.get(e.id) ?? []).sort((a, b) => a.numero - b.numero),
  })
  const parPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

  const idsBlocs = new Set(blocs.map((b) => b.id))
  const groupes: BlocVue[] = [...blocs].sort(parPosition).map((b) => ({
    id: b.id,
    nom: b.nom,
    exercices: exercices.filter((e) => e.blocId === b.id).sort(parPosition).map(versVue),
  }))
  const horsBloc = exercices.filter((e) => e.blocId === null || !idsBlocs.has(e.blocId)).sort(parPosition)
  if (horsBloc.length > 0) groupes.push({ id: null, nom: 'Exercices', exercices: horsBloc.map(versVue) })
  const visibles = groupes.filter((g) => g.exercices.length > 0)
  const tous = visibles.flatMap((g) => g.exercices)
  for (const e of tous) e.enchaineAvec = suivantDuSuperset(tous, e)?.nom ?? null
  return { blocs: visibles, exercices: tous }
}

// Exercices du même superset que `e` (même lettre ET même bloc), dans l'ordre d'affichage (position).
// Un groupe d'un seul exercice n'est pas un superset : renvoie [] dans ce cas comme hors superset.
function groupeSuperset(exercices: ExerciceVue[], e: ExerciceVue): ExerciceVue[] {
  if (!e.supersetGroupe) return []
  const groupe = exercices.filter((x) => x.supersetGroupe === e.supersetGroupe && x.blocId === e.blocId)
  return groupe.length > 1 ? groupe : []
}

function suivantDuSuperset(exercices: ExerciceVue[], e: ExerciceVue): ExerciceVue | null {
  const groupe = groupeSuperset(exercices, e)
  const i = groupe.indexOf(e)
  return i >= 0 && i < groupe.length - 1 ? groupe[i + 1] : null
}

// Validation des mesures (champs fournis seulement). Renvoie un message français ou null.
export function verifierMesures(m: Partial<Mesures>, repsType: RepsType): string | null {
  if (m.reps !== undefined && !(Number.isInteger(m.reps) && m.reps >= 0)) {
    return repsType === 'DURATION' ? 'Saisissez une durée en secondes (nombre entier).' : 'Saisissez un nombre de répétitions entier.'
  }
  if (m.chargeKg !== undefined && m.chargeKg !== null && !(Number.isFinite(m.chargeKg) && m.chargeKg >= 0)) {
    return 'La charge doit être un nombre positif (kg).'
  }
  if (m.rpe !== undefined && m.rpe !== null && !(Number.isFinite(m.rpe) && m.rpe >= 1 && m.rpe <= 10)) {
    return 'Le RPE doit être compris entre 1 et 10.'
  }
  return null
}

// Repos restant (ms) : dernière série validée (validated_at le plus récent, repli updated_at) + repos de son exercice − maintenant,
// borné à 0. null s'il n'y a encore aucune série. Dérivé uniquement d'horodatages stockés.
// Superset (A1 → B1 → repos → A2 → B2…) : pas de repos entre les exercices d'un même tour. Si la dernière série
// appartient à un exercice suivi, dans son groupe, d'un exercice qui a encore SA série de ce tour à faire, le repos
// n'a pas commencé (null). Sinon (dernier exercice du groupe, ou suivants complets pour ce tour, ex. nombre de
// séries inégal), le repos part de cette série avec le temps de repos de son exercice.
export function reposRestant(exercices: ExerciceVue[], nowMs: number): number | null {
  let derniere: { ms: number; exercice: ExerciceVue; rang: number } | null = null
  for (const e of exercices) {
    for (const [i, s] of e.series.entries()) {
      const ms = parseTimestamp(s.valideeA)
      // rang : tour du superset auquel appartient la série (1 = première série de l'exercice).
      // Égalité d'horodatage : la série affichée la plus loin (exercice suivant, numéro supérieur) l'emporte.
      if (ms !== null && (derniere === null || ms >= derniere.ms)) derniere = { ms, exercice: e, rang: i + 1 }
    }
  }
  if (derniere === null) return null
  const { ms, exercice, rang } = derniere
  const groupe = groupeSuperset(exercices, exercice)
  const suivants = groupe.slice(groupe.indexOf(exercice) + 1)
  if (suivants.some((x) => x.series.length < rang && x.nombreSeriesPrevues >= rang)) return null
  return Math.max(0, ms + exercice.tempsReposSec * 1000 - nowMs)
}

// Durée affichée : mm:ss sous une heure, h:mm:ss au-delà.
export function formaterDuree(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const deux = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${deux(m)}:${deux(s)}` : `${deux(m)}:${deux(s)}`
}

// Libellé accessible, volontairement grossier (minute) pour ne pas être relu à chaque seconde.
export function libelleDureeAccessible(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return 'Temps écoulé : moins d’une minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `Temps écoulé : ${h} h ${m} min` : `Temps écoulé : ${m} min`
}

// Cibles d'un exercice : « 3 séries × 8-10 · 60 kg · repos 90 s ».
export function texteCibles(e: Pick<ExerciceVue, 'nombreSeriesPrevues' | 'repsCibles' | 'chargeCible' | 'tempsReposSec'>): string {
  const n = e.nombreSeriesPrevues
  const parties = [`${n} série${n > 1 ? 's' : ''}${e.repsCibles ? ` × ${e.repsCibles}` : ''}`]
  if (e.chargeCible) parties.push(e.chargeCible)
  parties.push(`repos ${e.tempsReposSec} s`)
  return parties.join(' · ')
}

// Résumé lisible d'une série (lecture seule) ; DURATION => secondes.
export function texteSerie(s: Pick<SerieVue, 'reps' | 'chargeKg' | 'rpe'>, repsType: RepsType): string {
  const parties = [s.reps === null ? '—' : repsType === 'DURATION' ? `${s.reps} s` : `${s.reps} reps`]
  if (s.chargeKg !== null) parties.push(`${String(s.chargeKg).replace('.', ',')} kg`)
  if (s.rpe !== null) parties.push(`RPE ${String(s.rpe).replace('.', ',')}`)
  return parties.join(' · ')
}
