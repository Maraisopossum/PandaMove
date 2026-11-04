// Moteur de session de respiration : fonctions pures, sans horloge ni minuteur.
// L'état à un instant se déduit du temps de respiration écoulé (hors pauses) : aucune dérive si l'onglet est ralenti.
// Ordre des phases : inspiration → rétention pleine → expiration → rétention vide ; seules les phases de durée > 0 existent.

export type Phase = 'inspire' | 'retention_pleine' | 'expire' | 'retention_vide'

export interface ConfigSession {
  inspireMs: number
  retentionPleineMs: number
  expireMs: number
  retentionVideMs: number
  cycles: number
}

export interface PhaseActive {
  phase: Phase
  dureeMs: number
}

export interface EtatSession {
  phase: Phase
  /** Temps écoulé dans la phase courante. */
  progressionMs: number
  dureePhaseMs: number
  /** Cycle en cours, de 1 à `cyclesTotal`. */
  cycle: number
  cyclesTotal: number
  termine: boolean
}

// `texte` : couleur lisible (contraste >= 4,5:1) pour le chiffre affiché sur le cercle de la phase.
export const INFOS_PHASE: Record<Phase, { libelle: string; consigne: string; couleur: string; texte: string }> = {
  inspire: { libelle: 'Inspire', consigne: 'Inspire lentement par le nez', couleur: '#4FC3F7', texte: '#10202B' },
  retention_pleine: { libelle: 'Retiens', consigne: 'Retiens ta respiration', couleur: '#CE93D8', texte: '#10202B' },
  expire: { libelle: 'Expire', consigne: 'Expire lentement par la bouche', couleur: '#80CBC4', texte: '#10202B' },
  retention_vide: { libelle: 'Pause', consigne: 'Reste poumons vides', couleur: '#546E7A', texte: '#FFFFFF' },
}

export function phasesActives(c: ConfigSession): PhaseActive[] {
  const phases: PhaseActive[] = [{ phase: 'inspire', dureeMs: c.inspireMs }]
  if (c.retentionPleineMs > 0) phases.push({ phase: 'retention_pleine', dureeMs: c.retentionPleineMs })
  phases.push({ phase: 'expire', dureeMs: c.expireMs })
  if (c.retentionVideMs > 0) phases.push({ phase: 'retention_vide', dureeMs: c.retentionVideMs })
  return phases
}

export const dureeCycleMs = (c: ConfigSession): number => phasesActives(c).reduce((somme, p) => somme + p.dureeMs, 0)

export const dureeTotaleMs = (c: ConfigSession): number => dureeCycleMs(c) * c.cycles

// État après `ecouleMs` de respiration. Au-delà de la durée totale : séance terminée, figée sur la fin du dernier cycle.
export function etatA(c: ConfigSession, ecouleMs: number): EtatSession {
  const phases = phasesActives(c)
  const cycleMs = dureeCycleMs(c)
  const ecoule = Math.max(0, ecouleMs)
  if (cycleMs <= 0 || c.cycles < 1) throw new Error('Configuration de respiration invalide.')

  if (ecoule >= cycleMs * c.cycles) {
    const derniere = phases[phases.length - 1]
    return { phase: derniere.phase, progressionMs: derniere.dureeMs, dureePhaseMs: derniere.dureeMs, cycle: c.cycles, cyclesTotal: c.cycles, termine: true }
  }

  const cycle = Math.floor(ecoule / cycleMs) + 1
  let reste = ecoule - (cycle - 1) * cycleMs
  for (const p of phases) {
    if (reste < p.dureeMs) return { phase: p.phase, progressionMs: reste, dureePhaseMs: p.dureeMs, cycle, cyclesTotal: c.cycles, termine: false }
    reste -= p.dureeMs
  }
  // Inatteignable (reste < cycleMs) ; garde pour les flottants
  const derniere = phases[phases.length - 1]
  return { phase: derniere.phase, progressionMs: derniere.dureeMs, dureePhaseMs: derniere.dureeMs, cycle, cyclesTotal: c.cycles, termine: false }
}

/** Avancement 0 → 1 dans la phase courante. */
export const avancement = (e: EtatSession): number => (e.dureePhaseMs <= 0 ? 0 : Math.min(1, Math.max(0, e.progressionMs / e.dureePhaseMs)))

/** Taille du cercle, de 0 (poumons vides) à 1 (poumons pleins), selon la phase et son avancement. */
export function echelleCercle(phase: Phase, progression: number): number {
  switch (phase) {
    case 'inspire':
      return progression
    case 'retention_pleine':
      return 1
    case 'expire':
      return 1 - progression
    case 'retention_vide':
      return 0
  }
}

/** Secondes restantes dans la phase, arrondies au-dessus (affichage du compte à rebours). */
export const secondesRestantes = (e: EtatSession): number => Math.max(0, Math.ceil((e.dureePhaseMs - e.progressionMs) / 1000))
