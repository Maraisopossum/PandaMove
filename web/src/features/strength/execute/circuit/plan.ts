import { construireLignes, nombreLignes, valeursLigne, type Brouillon, type SerieHisto } from '../lignesSeries'
import { exerciceComplet } from '../navigationSeries'
import type { BlocVue, ExerciceVue } from '../vue'
import type { ExercicePlan, LignePlan, PlanCircuit, Position } from './machine'

// Conditions de lancement, plan figé au lancement et récapitulatif des réglages. Fonctions pures.

/**
 * Durée cible en secondes d'un exercice : « 45 », « 45s » ou « 45 s ». Android n'accepte que les entiers
 * (toIntOrNull) ; le suffixe « s » est toléré ici car certaines cibles saisies en durée le portent.
 * null pour tout le reste (« PDC », « 8-10 », vide…).
 */
export function secondesCible(repsCibles: string): number | null {
  const m = /^\s*(\d+)\s*s?\s*$/i.exec(repsCibles)
  return m ? Number(m[1]) : null
}

// Exercice chronométrable : en durée, avec une cible numérique (condition Android des deux boutons).
export const estEligible = (e: ExerciceVue): boolean => e.repsType === 'DURATION' && secondesCible(e.repsCibles) !== null

export type Lancement =
  | { type: 'circuit'; blocId: string; /** Au moins une série du circuit déjà validée */ reprise: boolean }
  | { type: 'seul'; exerciceId: string }

const nbFaites = (e: ExerciceVue) => e.series.filter((s) => s.terminee).length

/**
 * Bouton de lancement à afficher pour l'exercice actif (null : aucun).
 * - bloc CIRCUIT avec au moins un exercice en durée numérique : le circuit automatique ;
 * - exercice en durée numérique hors circuit : le minuteur seul ;
 * - rien si tout est déjà validé.
 */
export function lancementPour(blocActif: BlocVue | null, exerciceActif: ExerciceVue | null): Lancement | null {
  if (!exerciceActif) return null
  if (blocActif?.type === 'CIRCUIT' && blocActif.id !== null) {
    const eligibles = blocActif.exercices.filter(estEligible)
    if (eligibles.length === 0 || eligibles.every(exerciceComplet)) return null
    return { type: 'circuit', blocId: blocActif.id, reprise: eligibles.some((e) => nbFaites(e) > 0) }
  }
  if (!estEligible(exerciceActif) || exerciceComplet(exerciceActif)) return null
  return { type: 'seul', exerciceId: exerciceActif.id }
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Rappel des réglages avant le départ : « 3 tours · 4 exercices · repos 20 s entre exercices, 120 s en fin de tour · environ 16 min ». */
export function recapCircuit(exercices: ExerciceVue[]): string {
  const eligibles = exercices.filter(estEligible)
  if (eligibles.length === 0) return ''
  const series = eligibles.map((e) => e.nombreSeriesPrevues)
  const min = Math.min(...series)
  const max = Math.max(...series)
  const tours = min === max ? pluriel(max, 'tour') : `${min} à ${max} tours`
  const inter = eligibles[0].blocReposInterSec
  const fin = eligibles[0].blocReposFinRoundSec
  const repos =
    inter > 0 && fin > 0 ? `repos ${inter} s entre exercices, ${fin} s en fin de tour`
    : inter > 0 ? `repos ${inter} s entre exercices`
    : fin > 0 ? `repos ${fin} s en fin de tour`
    : 'sans repos'
  const travail = eligibles.reduce((t, e) => t + (secondesCible(e.repsCibles) ?? 0) * nombreLignes({ ...e, series: [] }), 0)
  const total = travail + inter * (eligibles.length - 1) * max + fin * (max - 1)
  const minutes = Math.max(1, Math.round(total / 60))
  return `${tours} · ${pluriel(eligibles.length, 'exercice')} · ${repos} · environ ${minutes} min`
}

export type Cible = { type: 'circuit'; blocId: string } | { type: 'seul'; exerciceId: string }

const MSG_DUREE = 'saisissez un nombre de secondes supérieur à 0.'

/**
 * Plan figé au lancement, d'après ce que le tableau affiche : durée de chaque série à faire =
 * saisie en cours (brouillon) > valeur préremplie (historique ou cible) ; charge idem. Les durées
 * invalides (≤ 0, vides) sont refusées avant tout départ.
 */
export function construirePlan(
  cible: Cible,
  exercices: ExerciceVue[],
  historiques: ReadonlyMap<string, SerieHisto[]>,
  brouillons: Readonly<Record<string, Brouillon>>,
): { plan: PlanCircuit; depart: Position } | { erreur: string } {
  const lignesDe = (e: ExerciceVue) =>
    construireLignes(e, historiques.get(e.exerciseId) ?? []).map((l) => ({ l, v: valeursLigne(l, brouillons[`${e.id}#${l.numero}`]) }))
  const valide = (reps: number | null) => reps !== null && Number.isInteger(reps) && reps > 0

  if (cible.type === 'seul') {
    const e = exercices.find((x) => x.id === cible.exerciceId)
    if (!e) return { erreur: 'Exercice introuvable.' }
    const prochaine = lignesDe(e).find(({ l }) => !l.terminee)
    if (!prochaine) return { erreur: 'Toutes les séries de cet exercice sont déjà validées.' }
    if (!valide(prochaine.v.reps)) return { erreur: `Durée invalide : ${MSG_DUREE}` }
    const ligne: LignePlan = {
      numero: prochaine.l.numero, libelle: prochaine.l.libelle, cote: prochaine.l.cote as LignePlan['cote'],
      secondes: prochaine.v.reps!, chargeKg: prochaine.v.chargeKg, faite: false,
    }
    return {
      plan: { mode: 'seul', exercices: [{ id: e.id, nom: e.nom, toursPrevus: e.nombreSeriesPrevues, lignes: [ligne] }], reposInterSec: 0, reposFinTourSec: 0 },
      depart: { exIdx: 0, numero: ligne.numero },
    }
  }

  const duBloc = exercices.filter((e) => e.blocId === cible.blocId && estEligible(e))
  if (duBloc.length === 0) return { erreur: 'Ce circuit ne contient aucun exercice en durée.' }
  const plans: ExercicePlan[] = []
  for (const e of duBloc) {
    const lignes: LignePlan[] = []
    for (const { l, v } of lignesDe(e)) {
      if (!l.terminee && !valide(v.reps)) return { erreur: `Durée invalide pour « ${e.nom} » (série ${l.libelle}) : ${MSG_DUREE}` }
      lignes.push({
        numero: l.numero, libelle: l.libelle, cote: l.cote as LignePlan['cote'],
        secondes: l.terminee ? (l.reps ?? 0) : v.reps!, chargeKg: v.chargeKg, faite: l.terminee,
      })
    }
    plans.push({ id: e.id, nom: e.nom, toursPrevus: e.nombreSeriesPrevues, lignes })
  }
  const exIdx = plans.findIndex((p) => p.lignes.some((l) => !l.faite))
  if (exIdx < 0) return { erreur: 'Toutes les séries de ce circuit sont déjà validées.' }
  return {
    plan: { mode: 'circuit', exercices: plans, reposInterSec: duBloc[0].blocReposInterSec, reposFinTourSec: duBloc[0].blocReposFinRoundSec },
    depart: { exIdx, numero: plans[exIdx].lignes.find((l) => !l.faite)!.numero },
  }
}
