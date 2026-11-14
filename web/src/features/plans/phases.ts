// Déduction des phases d'un plan d'endurance à partir du volume prévu de chaque semaine et des semaines de jalon.
// Fonction pure et déterministe : mêmes entrées, mêmes phases. Les règles sont celles affichées à l'écran.

export type Phase = 'base' | 'developpement' | 'allegee' | 'affutage' | 'reprise' | 'specifique' | 'pic'

export const LIBELLE_PHASE: Record<Phase, string> = {
  base: 'Base',
  developpement: 'Développement',
  allegee: 'Allégée',
  affutage: 'Affûtage',
  reprise: 'Reprise',
  specifique: 'Spécifique',
  pic: 'Pic',
}

export interface ParametresPhases {
  /** Réduction (en %) qui fait une semaine d'affûtage avant un jalon. */
  reductionAffutagePct: number
  /** Une semaine est « allégée » sous ce pourcentage de la moyenne des trois précédentes. */
  allegeePct: number
}

export const PARAMETRES_PHASES_DEFAUT: ParametresPhases = { reductionAffutagePct: 30, allegeePct: 70 }

const MAX_SEMAINES_AFFUTAGE = 2
const MAX_SEMAINES_REPRISE = 3
const REPRISE_SOUS_PCT = 85
const BASE_SOUS_PCT = 65
const PIC_DES_PCT = 95

const moyenne = (v: number[]) => (v.length ? v.reduce((t, x) => t + x, 0) / v.length : 0)

/**
 * `volumes` : minutes prévues de chaque semaine, dans l'ordre, sans trou. `jalons` : indices des semaines qui portent un jalon.
 * Renvoie une phase par semaine. Ordre d'application : affûtage (jalon et semaines réduites avant), reprise après un jalon, base
 * au départ, semaines allégées, pic, spécifique avant le dernier jalon, puis développement pour le reste.
 */
export function deduirePhases(volumes: readonly number[], jalons: readonly number[], parametres: ParametresPhases = PARAMETRES_PHASES_DEFAUT): Phase[] {
  const n = volumes.length
  const phases: (Phase | null)[] = Array.from({ length: n }, () => null)
  const jalonsTries = [...new Set(jalons)].filter((j) => j >= 0 && j < n).sort((a, b) => a - b)
  const facteurAffutage = 1 - parametres.reductionAffutagePct / 100

  // 1. Affûtage : la semaine du jalon, plus (au plus deux) semaines précédentes nettement réduites.
  const referenceReprise = new Map<number, number>()
  for (const j of jalonsTries) {
    const avant = volumes.slice(Math.max(0, j - 4), j)
    const reference = avant.length ? Math.max(...avant) : 0
    let debut = j
    while (debut - 1 >= 0 && j - (debut - 1) <= MAX_SEMAINES_AFFUTAGE && phases[debut - 1] === null && reference > 0 && volumes[debut - 1] < facteurAffutage * reference) debut--
    for (let i = debut; i <= j; i++) phases[i] = 'affutage'
    // Référence de la reprise : le plus gros volume des quatre semaines qui précèdent l'affûtage.
    const avantAffutage = volumes.slice(Math.max(0, debut - 4), debut)
    referenceReprise.set(j, avantAffutage.length ? Math.max(...avantAffutage) : reference)
  }

  // 2. Reprise : jusqu'à trois semaines après un jalon, tant que le volume reste sous 85 % de la référence d'avant le jalon.
  for (const j of jalonsTries) {
    const reference = referenceReprise.get(j) ?? 0
    for (let i = j + 1, k = 0; i < n && k < MAX_SEMAINES_REPRISE && phases[i] === null && reference > 0 && volumes[i] < (REPRISE_SOUS_PCT / 100) * reference; i++, k++) phases[i] = 'reprise'
  }

  // 3. Base : les semaines de départ nettement sous le volume médian du plan.
  const tries = [...volumes].filter((v) => v > 0).sort((a, b) => a - b)
  const mediane = tries.length ? tries[Math.floor(tries.length / 2)] : 0
  for (let i = 0; i < n && phases[i] === null && mediane > 0 && volumes[i] < (BASE_SOUS_PCT / 100) * mediane; i++) phases[i] = 'base'

  // 4. Allégée : une semaine sous allegeePct % de la moyenne des trois précédentes.
  for (let i = 1; i < n; i++) {
    if (phases[i] !== null) continue
    const precedentes = volumes.slice(Math.max(0, i - 3), i).filter((v) => v > 0)
    if (precedentes.length && volumes[i] < (parametres.allegeePct / 100) * moyenne(precedentes)) phases[i] = 'allegee'
  }

  // 5. Pic : les semaines les plus chargées du plan, avant le dernier jalon (sans jalon, pas de pic).
  const dernierJalon = jalonsTries.length ? jalonsTries[jalonsTries.length - 1] : -1
  const maximum = Math.max(0, ...volumes)
  for (let i = 0; i < dernierJalon; i++) if (phases[i] === null && maximum > 0 && volumes[i] >= (PIC_DES_PCT / 100) * maximum) phases[i] = 'pic'

  // 6. Spécifique : les semaines restantes juste avant le dernier jalon, après l'avant-dernier.
  if (jalonsTries.length >= 2) {
    const dernier = jalonsTries[jalonsTries.length - 1]
    const avantDernier = jalonsTries[jalonsTries.length - 2]
    for (let i = avantDernier + 1; i < dernier; i++) if (phases[i] === null) phases[i] = 'specifique'
  }

  // 7. Développement : tout le reste.
  return phases.map((p) => p ?? 'developpement')
}

export interface BlocPhase {
  phase: Phase
  /** Indices (inclusifs) de la première et de la dernière semaine du bloc. */
  de: number
  a: number
}

/** Regroupe les semaines consécutives de même phase. */
export function regrouperPhases(phases: readonly Phase[]): BlocPhase[] {
  const blocs: BlocPhase[] = []
  phases.forEach((p, i) => {
    const dernier = blocs[blocs.length - 1]
    if (dernier && dernier.phase === p && dernier.a === i - 1) dernier.a = i
    else blocs.push({ phase: p, de: i, a: i })
  })
  return blocs
}
