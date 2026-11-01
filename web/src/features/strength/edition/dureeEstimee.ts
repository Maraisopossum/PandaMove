import { LIBELLES_BLOC, type BlocDraft, type ExerciceDraft, type SeanceDraft } from '../draft'

// Durée estimée d'une séance de renforcement, CALCULÉE d'après son contenu (fonctions pures).
//
// Hypothèses (ordre de grandeur, pas un chronomètre) :
//  - Une série en répétitions dure « répétitions visées × durée d'une répétition » : 3 s par répétition, ou la somme
//    des chiffres du tempo s'il est renseigné (« 3-1-1 » = 5 s), avec un minimum de 20 s (mise en place comprise).
//  - Les répétitions visées sont le premier nombre de `repsCibles`, ou le milieu d'une plage (« 8-12 » = 10) ;
//    illisible ou vide : 10 répétitions.
//  - Un exercice en durée (RepsType.DURATION) : `repsCibles` est en secondes (« 45 », « 45s », « 30-45 » = 37,5 s) ;
//    illisible ou vide : 30 s.
//  - Un exercice bilatéral se fait des deux côtés : durée de série × 2.
//  - Exercice hors superset/circuit : séries × (durée d'une série + repos de l'exercice). Le repos suivant la dernière
//    série est compté (rangement, changement de charge) : l'estimation reste volontairement un peu large.
//  - Superset et circuit : on enchaîne les exercices d'un tour avec le repos « inter » du bloc, puis le repos « fin de
//    tour » du bloc ; le repos propre de chaque exercice est ignoré. Circuit : tours = séries du bloc ; superset :
//    tours = plus grand nombre de séries parmi ses exercices (un exercice à moins de séries sort des derniers tours).
//  - Bloc Échauffement / Activation / Récupération : exercices à la suite comme des exercices libres ; si une durée
//    de bloc est saisie, elle remplace le calcul.
//  - Transition fixe de 30 s entre deux exercices (ou deux blocs) consécutifs de la séance.
//  - Résultat arrondi à la minute supérieure ; séance vide : 0.

export const SEC_PAR_REPETITION = 3
export const SERIE_MIN_SEC = 20
export const REPS_PAR_DEFAUT = 10
export const DUREE_PAR_DEFAUT_SEC = 30
export const TRANSITION_SEC = 30

/** Premier nombre de la saisie, ou milieu de la plage (« 8-12 » → 10, « 30-45 » → 37,5) ; null si illisible ou nul. */
export function repsVisees(saisie: string): number | null {
  const nombres = (saisie.replace(',', '.').match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  if (nombres.length === 0) return null
  const v = nombres.length >= 2 ? (nombres[0] + nombres[1]) / 2 : nombres[0]
  return v > 0 ? v : null
}

// Secondes par répétition : somme des chiffres du tempo (« 3-1-1 » = 5), 3 s par défaut
function secParRepetition(tempo: string): number {
  const somme = [...tempo].reduce((acc, c) => acc + (/\d/.test(c) ? Number(c) : 0), 0)
  return somme > 0 ? somme : SEC_PAR_REPETITION
}

/** Durée d'une série de l'exercice, en secondes (côtés compris, repos exclu). */
export function dureeSerieSec(e: ExerciceDraft): number {
  const visees = repsVisees(e.repsCibles)
  const sec = e.repsType === 'DURATION'
    ? (visees ?? DUREE_PAR_DEFAUT_SEC)
    : Math.max(SERIE_MIN_SEC, (visees ?? REPS_PAR_DEFAUT) * secParRepetition(e.tempo))
  return e.isBilateral ? sec * 2 : sec
}

const seriesDe = (e: ExerciceDraft) => Math.max(0, Number.isFinite(e.nombreSeriesPrevues) ? e.nombreSeriesPrevues : 0)

function dureeExercice(e: ExerciceDraft): number {
  return seriesDe(e) * (dureeSerieSec(e) + Math.max(0, e.tempsReposSec || 0))
}

// Suite d'exercices avec la transition entre chacun
function dureeSuite(exercices: ExerciceDraft[]): number {
  return exercices.reduce((acc, e) => acc + dureeExercice(e), 0) + Math.max(0, exercices.length - 1) * TRANSITION_SEC
}

// Circuit / superset : tours enchaînés avec repos inter (entre exercices d'un tour) et repos de fin de tour
function dureeParTours(b: BlocDraft): number {
  const tours = b.type === 'CIRCUIT' ? b.nombreSeriesPrevues : Math.max(0, ...b.exercices.map(seriesDe))
  const inter = Math.max(0, b.tempsReposInterSec || 0)
  const finTour = Math.max(0, b.tempsReposFinRoundSec || 0)
  let total = 0
  for (let tour = 1; tour <= (Number.isFinite(tours) ? tours : 0); tour++) {
    const presents = b.type === 'CIRCUIT' ? b.exercices : b.exercices.filter((e) => seriesDe(e) >= tour)
    if (presents.length === 0) continue
    total += presents.reduce((acc, e) => acc + dureeSerieSec(e), 0) + (presents.length - 1) * inter + finTour
  }
  return total
}

function dureeBloc(b: BlocDraft): number {
  if (b.exercices.length === 0) return 0
  if (b.type === 'SUPERSET' || b.type === 'CIRCUIT') return dureeParTours(b)
  if (b.dureeMin !== null && Number.isFinite(b.dureeMin) && b.dureeMin > 0) return b.dureeMin * 60
  return dureeSuite(b.exercices)
}

export interface LigneDuree {
  libelle: string
  sec: number
}

export interface DetailDuree {
  lignes: LigneDuree[]
  /** Transitions entre exercices / blocs consécutifs */
  transitionsSec: number
  totalSec: number
}

/** Décomposition de l'estimation : une ligne par exercice libre ou bloc non vide, plus les transitions. */
export function detailDuree(d: SeanceDraft): DetailDuree {
  const lignes: LigneDuree[] = d.items.flatMap((item): LigneDuree[] => {
    if (item.kind === 'libre') return [{ libelle: item.exercice.exerciseNom, sec: dureeExercice(item.exercice) }]
    if (item.bloc.exercices.length === 0) return []
    return [{ libelle: item.bloc.nom || LIBELLES_BLOC[item.bloc.type], sec: dureeBloc(item.bloc) }]
  })
  const transitionsSec = Math.max(0, lignes.length - 1) * TRANSITION_SEC
  return { lignes, transitionsSec, totalSec: lignes.reduce((acc, l) => acc + l.sec, transitionsSec) }
}

/** Durée estimée de la séance en secondes. */
export const dureeEstimeeSec = (d: SeanceDraft): number => detailDuree(d).totalSec

/** Durée estimée de la séance en minutes entières (arrondi supérieur) ; 0 pour une séance vide. */
export const dureeEstimeeMin = (d: SeanceDraft): number => Math.ceil(dureeEstimeeSec(d) / 60)

/** « ≈ 52 min » ; « — » pour une séance vide (rien à estimer). */
export const libelleDuree = (minutes: number): string => (minutes > 0 ? `≈ ${minutes} min` : '—')

/** Durée d'une ligne du détail : « 6 min » (arrondi à la minute la plus proche, au moins 1 min), « 30 s » sous la minute. */
export const libelleSecondes = (sec: number): string =>
  sec < 60 ? `${Math.round(sec)} s` : `${Math.max(1, Math.round(sec / 60))} min`
