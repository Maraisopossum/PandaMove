// Marqueur de progression d'une instance (instances_seance.progression_json, migration 0005).
// Forme stockée : { "evaluee": true, "decisions": { "<exerciceId>": "acceptee" | "refusee" | "ajustee" } }
// - evaluee : l'évaluation de fin de séance a eu lieu (échecs simples appliqués) ; jamais refaite ;
// - decisions : choix enregistré par exercice d'instance ; une décision n'est jamais rejouée.
// Remplace toute garde temporelle (derniere_maj comparée à completed_at).

export type DecisionEnregistree = 'acceptee' | 'refusee' | 'ajustee'

export interface EtatProgression {
  evaluee: boolean
  decisions: Record<string, DecisionEnregistree>
}

const DECISIONS: readonly string[] = ['acceptee', 'refusee', 'ajustee']

/** Lit le JSON stocké ; absent ou malformé -> null (traité comme absent), jamais d'exception. */
export function lireProgression(json: string | null | undefined): EtatProgression | null {
  if (!json) return null
  let v: unknown
  try {
    v = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  const brut = v as Record<string, unknown>
  if (typeof brut.evaluee !== 'boolean') return null
  const decisions: Record<string, DecisionEnregistree> = {}
  const source = brut.decisions
  if (typeof source === 'object' && source !== null && !Array.isArray(source)) {
    for (const [cle, valeur] of Object.entries(source)) {
      if (typeof valeur === 'string' && DECISIONS.includes(valeur)) decisions[cle] = valeur as DecisionEnregistree
    }
  }
  return { evaluee: brut.evaluee, decisions }
}

export function marquerEvaluee(etat: EtatProgression | null): EtatProgression {
  return { evaluee: true, decisions: { ...(etat?.decisions ?? {}) } }
}

export function enregistrerDecision(
  etat: EtatProgression | null,
  exerciceId: string,
  decision: DecisionEnregistree,
): EtatProgression {
  return { evaluee: etat?.evaluee ?? false, decisions: { ...(etat?.decisions ?? {}), [exerciceId]: decision } }
}

export function serialiserProgression(etat: EtatProgression): string {
  return JSON.stringify({ evaluee: etat.evaluee, decisions: etat.decisions })
}
