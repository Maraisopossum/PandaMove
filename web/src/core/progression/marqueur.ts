// Marqueur de progression d'une instance (instances_seance.progression_json, migration 0005).
// Forme stockée : { "evaluee": true, "decisions": { "<exerciceId>": "acceptee" | "refusee" | "ajustee" | "appliquee_auto" } }
// « appliquee_auto » : issue appliquée à la fin de séance SANS validation (échec simple : compteur +1),
// distincte d'un « Oui » explicite (« acceptee »).
// - evaluee : l'évaluation de fin de séance a eu lieu (échecs simples appliqués) ; jamais refaite ;
// - decisions : choix enregistré par exercice d'instance ; une décision n'est jamais rejouée.
// Remplace toute garde temporelle (derniere_maj comparée à completed_at).
// - bases (facultatif, lot 29) : pour chaque exercice dont l'évaluation a ÉCRIT un objectif, ce qu'il faut pour la
//   recalculer après une correction de la séance : la cible évaluée, l'objectif d'avant, l'objectif écrit et la
//   proposition. Un marqueur sans « bases » (séance évaluée avant ce lot) n'est jamais recalculé.

export type DecisionEnregistree = 'acceptee' | 'refusee' | 'ajustee' | 'appliquee_auto'

/** Objectif de progression tel qu'écrit ou lu en base (sans identifiants). */
export interface ObjectifMarque {
  chargeCible: number | null
  repsCible: number | null
  dureeCibleSec: number | null
  compteurEchec: number
  nombreSeriesCible: number | null
  derniereMaj: string
}

/** Proposition du moteur, réduite à ce qui permet de dire « le résultat n'a pas changé ». */
export interface PropositionMarquee {
  statut: string
  chargeCible: number | null
  repsCible: number | null
  dureeCibleSec: number | null
  compteurEchec: number
  nombreSeries: number | null
  deload: boolean
}

/** Base d'évaluation d'un exercice (voir l'en-tête du fichier). */
export interface BaseExercice {
  /** Cible évaluée (objectif existant, sinon cible du modèle) */
  cible: { chargeKg: number | null; reps: number | null; dureeSec: number | null }
  /** Objectif avant l'écriture ; null s'il n'existait pas */
  avant: ObjectifMarque | null
  /** Objectif écrit par l'évaluation (relu en base juste après l'écriture) */
  ecrit: ObjectifMarque
  proposition: PropositionMarquee
  /** Séries prévues de la ligne d'instance avant / après un « +1 série » ; null si non touchées */
  seriesAvant: number | null
  seriesApres: number | null
}

export interface EtatProgression {
  evaluee: boolean
  decisions: Record<string, DecisionEnregistree>
  bases?: Record<string, BaseExercice>
}

const DECISIONS: readonly string[] = ['acceptee', 'refusee', 'ajustee', 'appliquee_auto']

const nombreOuNull = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v))
const objet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function lireObjectif(v: unknown): ObjectifMarque | null {
  if (!objet(v)) return null
  const { chargeCible, repsCible, dureeCibleSec, compteurEchec, nombreSeriesCible, derniereMaj } = v
  if (!nombreOuNull(chargeCible) || !nombreOuNull(repsCible) || !nombreOuNull(dureeCibleSec) || !nombreOuNull(nombreSeriesCible)) return null
  if (typeof compteurEchec !== 'number' || typeof derniereMaj !== 'string') return null
  return { chargeCible, repsCible, dureeCibleSec, compteurEchec, nombreSeriesCible, derniereMaj }
}

function lireBase(v: unknown): BaseExercice | null {
  if (!objet(v) || !objet(v.cible) || !objet(v.proposition)) return null
  const { chargeKg, reps, dureeSec } = v.cible
  if (!nombreOuNull(chargeKg) || !nombreOuNull(reps) || !nombreOuNull(dureeSec)) return null
  const p = v.proposition
  if (typeof p.statut !== 'string' || typeof p.deload !== 'boolean' || typeof p.compteurEchec !== 'number') return null
  if (!nombreOuNull(p.chargeCible) || !nombreOuNull(p.repsCible) || !nombreOuNull(p.dureeCibleSec) || !nombreOuNull(p.nombreSeries)) return null
  const ecrit = lireObjectif(v.ecrit)
  const avant = v.avant === null ? null : lireObjectif(v.avant)
  if (!ecrit || (v.avant !== null && !avant)) return null
  if (!nombreOuNull(v.seriesAvant) || !nombreOuNull(v.seriesApres)) return null
  return {
    cible: { chargeKg, reps, dureeSec },
    avant,
    ecrit,
    proposition: {
      statut: p.statut, chargeCible: p.chargeCible, repsCible: p.repsCible, dureeCibleSec: p.dureeCibleSec,
      compteurEchec: p.compteurEchec, nombreSeries: p.nombreSeries, deload: p.deload,
    },
    seriesAvant: v.seriesAvant,
    seriesApres: v.seriesApres,
  }
}

/** Lit le JSON stocké ; absent ou malformé -> null (traité comme absent), jamais d'exception. */
export function lireProgression(json: string | null | undefined): EtatProgression | null {
  if (!json) return null
  let v: unknown
  try {
    v = JSON.parse(json)
  } catch {
    return null
  }
  if (!objet(v)) return null
  const brut = v
  if (typeof brut.evaluee !== 'boolean') return null
  const decisions: Record<string, DecisionEnregistree> = {}
  const source = brut.decisions
  if (objet(source)) {
    for (const [cle, valeur] of Object.entries(source)) {
      if (typeof valeur === 'string' && DECISIONS.includes(valeur)) decisions[cle] = valeur as DecisionEnregistree
    }
  }
  // Une base illisible est ignorée seule : le reste du marqueur (évaluée, décisions) reste valable
  const bases: Record<string, BaseExercice> = {}
  if (objet(brut.bases)) {
    for (const [cle, valeur] of Object.entries(brut.bases)) {
      const base = lireBase(valeur)
      if (base) bases[cle] = base
    }
  }
  return avecBases(brut.evaluee, decisions, bases)
}

// La clé « bases » n'existe que s'il y a au moins une base : les marqueurs sans base gardent exactement leur forme d'avant.
function avecBases(
  evaluee: boolean,
  decisions: Record<string, DecisionEnregistree>,
  bases: Record<string, BaseExercice> | undefined,
): EtatProgression {
  return bases && Object.keys(bases).length > 0 ? { evaluee, decisions, bases } : { evaluee, decisions }
}

export function marquerEvaluee(etat: EtatProgression | null): EtatProgression {
  return avecBases(true, { ...(etat?.decisions ?? {}) }, etat?.bases && { ...etat.bases })
}

export function enregistrerDecision(
  etat: EtatProgression | null,
  exerciceId: string,
  decision: DecisionEnregistree,
): EtatProgression {
  return avecBases(etat?.evaluee ?? false, { ...(etat?.decisions ?? {}), [exerciceId]: decision }, etat?.bases && { ...etat.bases })
}

/** Enregistre la base d'évaluation d'un exercice (remplace la précédente). */
export function enregistrerBase(etat: EtatProgression | null, exerciceId: string, base: BaseExercice): EtatProgression {
  return avecBases(etat?.evaluee ?? false, { ...(etat?.decisions ?? {}) }, { ...(etat?.bases ?? {}), [exerciceId]: base })
}

/** Oublie la décision et la base d'un exercice (son évaluation est annulée : elle sera refaite). */
export function retirerExercice(etat: EtatProgression, exerciceId: string): EtatProgression {
  const decisions = { ...etat.decisions }
  delete decisions[exerciceId]
  const bases = { ...(etat.bases ?? {}) }
  delete bases[exerciceId]
  return avecBases(etat.evaluee, decisions, bases)
}

export function serialiserProgression(etat: EtatProgression): string {
  const bases = etat.bases && Object.keys(etat.bases).length > 0 ? { bases: etat.bases } : {}
  return JSON.stringify({ evaluee: etat.evaluee, decisions: etat.decisions, ...bases })
}
