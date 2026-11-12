import { EXERCICES, rangZone, TOUTES_ZONES, type Exercice, type MomentSeance, type Posture, type ZoneCorps } from './donnees'

// Générateur de séances de mobilité : à partir du temps disponible, des zones à cibler et du moment (avant / après le sport),
// choisit des exercices qui couvrent les zones à tour de rôle, ajuste leurs durées pour remplir le temps, puis les ordonne
// par posture (debout, assis, au sol) pour limiter les changements de position. Fonctions pures : une même graine donne
// toujours la même séance, une autre graine propose une variante.

/** Temps de changement de position entre deux exercices, en secondes. */
export const TRANSITION_S = 6
const DUREE_MIN_S = 15
const DUREE_MAX_S = 90

export interface Etape {
  exercice: Exercice
  /** Durée en secondes, par côté pour un exercice qui se fait des deux côtés. */
  dureeS: number
}

export interface DemandeSeance {
  minutes: number
  /** Zones à cibler ; vide : tout le corps. */
  zones: ZoneCorps[]
  moment: MomentSeance
  graine: number
}

export interface PlanSeance extends DemandeSeance {
  etapes: Etape[]
  /** Durée réelle de la séance (exercices et transitions). */
  dureeTotaleS: number
}

// Générateur pseudo-aléatoire à graine (mulberry32) : reproductible, sans dépendance.
function aleatoire(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const tempsEtape = (e: Etape): number => (e.exercice.cote ? 2 * e.dureeS : e.dureeS) + TRANSITION_S
export const dureeTotale = (etapes: Etape[]): number => etapes.reduce((t, e) => t + tempsEtape(e), 0)

// Adéquation d'un exercice au moment : avant le sport on privilégie mobilité et activation, après on privilégie les étirements.
function adequation(ex: Exercice, moment: MomentSeance): number {
  if (moment === 'avant') return ex.type === 'etirement' ? 0.4 : 2
  if (moment === 'apres') return ex.type === 'etirement' ? 2 : ex.type === 'mobilite' ? 1.4 : 0.3
  return 1.5
}

const RANG_POSTURE: Record<Posture, number> = { debout: 0, assis: 1, sol: 2 }

function ordonner(etapes: Etape[]): Etape[] {
  return [...etapes].sort(
    (a, b) => RANG_POSTURE[a.exercice.posture] - RANG_POSTURE[b.exercice.posture] || rangZone(a.exercice.zones[0]) - rangZone(b.exercice.zones[0]),
  )
}

// Durées ajustées pour que la séance remplisse le temps demandé : mise à l'échelle des durées conseillées (de 60 à 160 %),
// arrondie à 5 s, bornée entre 15 et 90 s.
function ajusterDurees(choisis: Exercice[], budgetS: number): Etape[] {
  const transitions = TRANSITION_S * choisis.length
  const brut = choisis.reduce((t, ex) => t + (ex.cote ? 2 : 1) * ex.dureeS, 0)
  const facteur = Math.max(0.6, Math.min(1.6, (budgetS - transitions) / brut))
  return choisis.map((ex) => ({ exercice: ex, dureeS: Math.max(DUREE_MIN_S, Math.min(DUREE_MAX_S, Math.round((ex.dureeS * facteur) / 5) * 5)) }))
}

function score(ex: Exercice, zone: ZoneCorps, cibles: ZoneCorps[], moment: MomentSeance, alea: () => number): number {
  const autres = ex.zones.filter((z) => z !== zone && cibles.includes(z)).length
  return adequation(ex, moment) + (ex.zones[0] === zone ? 1 : 0) + 0.3 * autres + alea() * 0.8
}

export function genererSeance(demande: DemandeSeance, exclus: readonly string[] = []): PlanSeance {
  const cibles = demande.zones.length > 0 ? demande.zones : TOUTES_ZONES
  const budgetS = Math.max(60, demande.minutes * 60)
  const alea = aleatoire(demande.graine)
  const disponibles = EXERCICES.filter((ex) => !exclus.includes(ex.id) && ex.zones.some((z) => cibles.includes(z)))

  const choisis: Exercice[] = []
  const epuisees = new Set<ZoneCorps>()
  let total = 0
  while (epuisees.size < cibles.length) {
    // Zone la moins couverte pour l'instant (à égalité, la plus haute dans le corps)
    const zone = cibles
      .filter((z) => !epuisees.has(z))
      .map((z) => ({ z, n: choisis.filter((ex) => ex.zones.includes(z)).length }))
      .sort((a, b) => a.n - b.n || rangZone(a.z) - rangZone(b.z))[0].z
    const candidats = disponibles.filter((ex) => ex.zones.includes(zone) && !choisis.includes(ex))
    if (candidats.length === 0) {
      epuisees.add(zone)
      continue
    }
    const meilleur = candidats.map((ex) => ({ ex, s: score(ex, zone, cibles, demande.moment, alea) })).sort((a, b) => b.s - a.s)[0].ex
    const temps = (meilleur.cote ? 2 : 1) * meilleur.dureeS + TRANSITION_S
    // Un exercice de trop dépasserait le temps : on s'arrête (sauf s'il n'y a encore rien)
    if (choisis.length > 0 && total + temps > budgetS * 1.08) break
    choisis.push(meilleur)
    total += temps
  }
  const etapes = ordonner(ajusterDurees(choisis, budgetS))
  return { ...demande, etapes, dureeTotaleS: dureeTotale(etapes) }
}

// Remplace l'exercice `index` par un autre qui travaille la même zone et n'est pas déjà dans la séance ; sa durée est ajustée
// pour garder le temps de l'étape. Sans remplaçant, la séance est rendue telle quelle.
export function remplacerEtape(plan: PlanSeance, index: number): PlanSeance {
  const actuelle = plan.etapes[index]
  if (!actuelle) return plan
  const cibles = plan.zones.length > 0 ? plan.zones : TOUTES_ZONES
  const dejaLa = new Set(plan.etapes.map((x) => x.exercice.id))
  const zone = actuelle.exercice.zones.find((z) => cibles.includes(z)) ?? actuelle.exercice.zones[0]
  const alea = aleatoire(plan.graine + index + 1)
  const candidats = EXERCICES.filter((ex) => !dejaLa.has(ex.id) && ex.zones.includes(zone))
  if (candidats.length === 0) return plan
  const nouveau = candidats.map((ex) => ({ ex, s: score(ex, zone, cibles, plan.moment, alea) })).sort((a, b) => b.s - a.s)[0].ex
  const dureeCible = tempsEtape(actuelle) - TRANSITION_S
  const parCote = nouveau.cote ? dureeCible / 2 : dureeCible
  const etape: Etape = { exercice: nouveau, dureeS: Math.max(DUREE_MIN_S, Math.min(DUREE_MAX_S, Math.round(parCote / 5) * 5)) }
  const etapes = plan.etapes.map((x, i) => (i === index ? etape : x))
  return { ...plan, etapes, dureeTotaleS: dureeTotale(etapes) }
}

// Zones réellement couvertes par la séance, dans l'ordre du corps.
export function zonesCouvertes(etapes: Etape[]): ZoneCorps[] {
  return TOUTES_ZONES.filter((z) => etapes.some((x) => x.exercice.zones.includes(z)))
}
