// Réglages des plans d'endurance : préférences d'appareil (localStorage, non synchronisées), comme les rappels.
// La mesure principale est le taux de réalisation ; sa définition est configurable.

export type MesureReussite = 'seances' | 'duree' | 'les-deux'

export interface ReglagesPlans {
  mesure: MesureReussite
  /** Part de la durée prévue (en %) à atteindre pour qu'une séance compte comme faite. */
  dureeMinPct: number
  /** Part (en %) comptée pour une séance « faite autrement » (durée ou discipline différente). */
  autrementPct: number
  /** Taux (en %) à partir duquel la réalisation est « bonne ». */
  seuilBonPct: number
  /** Taux (en %) sous lequel la réalisation est « à surveiller ». */
  seuilSurveillerPct: number
  prevenirTroisSemaines: boolean
  phasesAuto: boolean
  /** Réduction de volume (en %) qui fait une semaine d'affûtage avant un jalon. */
  reductionAffutagePct: number
  /** Une semaine est « allégée » sous ce pourcentage de la moyenne des trois précédentes. */
  allegeePct: number
  additionnerCharge: boolean
  alerteJalons: boolean
  proposerRattachement: boolean
  /** Une sortie manuelle du même sport et du même jour compte pour la séance prévue, sans confirmation. */
  rattachementAuto: boolean
}

export const CLE_REGLAGES_PLANS = 'pandamove.plans.reglages'

export const REGLAGES_PLANS_DEFAUT: ReglagesPlans = {
  mesure: 'seances',
  dureeMinPct: 80,
  autrementPct: 50,
  seuilBonPct: 85,
  seuilSurveillerPct: 70,
  prevenirTroisSemaines: true,
  phasesAuto: true,
  reductionAffutagePct: 30,
  allegeePct: 70,
  additionnerCharge: true,
  alerteJalons: true,
  proposerRattachement: true,
  rattachementAuto: true,
}

const MESURES: readonly MesureReussite[] = ['seances', 'duree', 'les-deux']

const entier = (v: unknown, defaut: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : defaut

const booleen = (v: unknown, defaut: boolean): boolean => (typeof v === 'boolean' ? v : defaut)

/** Lit des réglages stockés : toute valeur absente ou invalide retombe sur la valeur par défaut. */
export function lireReglagesPlans(brut: string | null): ReglagesPlans {
  const d = REGLAGES_PLANS_DEFAUT
  let o: Record<string, unknown> = {}
  try {
    const v: unknown = brut ? JSON.parse(brut) : {}
    if (v && typeof v === 'object' && !Array.isArray(v)) o = v as Record<string, unknown>
  } catch {
    o = {}
  }
  const bon = entier(o.seuilBonPct, d.seuilBonPct, 1, 100)
  const surveiller = Math.min(entier(o.seuilSurveillerPct, d.seuilSurveillerPct, 1, 100), bon)
  return {
    mesure: MESURES.includes(o.mesure as MesureReussite) ? (o.mesure as MesureReussite) : d.mesure,
    dureeMinPct: entier(o.dureeMinPct, d.dureeMinPct, 10, 100),
    autrementPct: entier(o.autrementPct, d.autrementPct, 0, 100),
    seuilBonPct: bon,
    seuilSurveillerPct: surveiller,
    prevenirTroisSemaines: booleen(o.prevenirTroisSemaines, d.prevenirTroisSemaines),
    phasesAuto: booleen(o.phasesAuto, d.phasesAuto),
    reductionAffutagePct: entier(o.reductionAffutagePct, d.reductionAffutagePct, 10, 80),
    allegeePct: entier(o.allegeePct, d.allegeePct, 30, 95),
    additionnerCharge: booleen(o.additionnerCharge, d.additionnerCharge),
    alerteJalons: booleen(o.alerteJalons, d.alerteJalons),
    proposerRattachement: booleen(o.proposerRattachement, d.proposerRattachement),
    rattachementAuto: booleen(o.rattachementAuto, d.rattachementAuto),
  }
}

export function chargerReglagesPlans(): ReglagesPlans {
  try {
    return lireReglagesPlans(globalThis.localStorage?.getItem(CLE_REGLAGES_PLANS) ?? null)
  } catch {
    return REGLAGES_PLANS_DEFAUT
  }
}

export function enregistrerReglagesPlans(r: ReglagesPlans): void {
  try {
    globalThis.localStorage?.setItem(CLE_REGLAGES_PLANS, JSON.stringify(r))
  } catch {
    // stockage indisponible : les réglages ne sont pas retenus
  }
}

export function retablirReglagesPlans(): ReglagesPlans {
  try {
    globalThis.localStorage?.removeItem(CLE_REGLAGES_PLANS)
  } catch {
    // rien à retirer
  }
  return REGLAGES_PLANS_DEFAUT
}

export const LIBELLE_MESURE: Record<MesureReussite, string> = { seances: 'Séances', duree: 'Durée', 'les-deux': 'Les deux' }

/** Phrase qui définit la mesure retenue, affichée à côté du taux. */
export function definitionMesure(m: MesureReussite): string {
  return m === 'seances' ? 'séances faites ÷ séances prévues' : m === 'duree' ? 'durée réalisée ÷ durée prévue' : 'moyenne des séances et de la durée'
}
