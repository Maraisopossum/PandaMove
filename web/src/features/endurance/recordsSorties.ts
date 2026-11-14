import type { Sortie, Sport } from '../../core/db/repos/sorties'
import { ajouterJours } from './calculCharge'
import { lundiDe } from '../home/semaine'
import { distanceCumulee, meilleurEffort, meilleurTemps } from './analyseSerie'
import { formaterDuree } from './presentation'
import { lireSerie } from './statsSorties'

// Records et comparaisons des sorties : meilleurs temps par distance (course), meilleurs efforts de puissance (vélo), évolution
// du 5 km, autres records, badges de la liste et position d'une sortie parmi les précédentes. Fonctions pures sur les sorties déjà
// lues. Les meilleurs temps et efforts viennent de la série détaillée (importée d'un fichier) : une sortie saisie à la main n'y
// entre pas, et ne compte que par sa distance et sa durée totales.

export interface DefinitionDistance {
  id: string
  metres: number
  libelle: string
}
export interface DefinitionEffort {
  id: string
  secondes: number
  libelle: string
}

export const DISTANCES: readonly DefinitionDistance[] = [
  { id: '1k', metres: 1000, libelle: '1 km' },
  { id: '5k', metres: 5000, libelle: '5 km' },
  { id: '10k', metres: 10_000, libelle: '10 km' },
  { id: 'semi', metres: 21_097.5, libelle: 'Semi' },
  { id: 'marathon', metres: 42_195, libelle: 'Marathon' },
]

export const EFFORTS: readonly DefinitionEffort[] = [
  { id: '1min', secondes: 60, libelle: '1 min' },
  { id: '5min', secondes: 300, libelle: '5 min' },
  { id: '20min', secondes: 1200, libelle: '20 min' },
  { id: '60min', secondes: 3600, libelle: '60 min' },
]

export interface AnalyseSortie {
  id: string
  date: string
  /** Meilleur temps (s) par distance, course seulement. */
  temps: Record<string, number>
  /** Meilleure puissance moyenne (W) par durée, vélo seulement. */
  efforts: Record<string, number>
}

/** Analyse détaillée d'une sortie ; vide sans série exploitable. À calculer une fois par sortie (300 échantillons chacune). */
export function analyserSortie(s: Sortie): AnalyseSortie {
  const analyse: AnalyseSortie = { id: s.id, date: s.date, temps: {}, efforts: {} }
  const serie = lireSerie(s)
  if (serie.length === 0) return analyse
  if (s.sport === 'course') {
    const cumul = distanceCumulee(serie, s.distanceM)
    if (cumul) {
      for (const d of DISTANCES) {
        const t = meilleurTemps(cumul, d.metres)
        if (t !== null) analyse.temps[d.id] = Math.round(t)
      }
    }
  } else {
    for (const e of EFFORTS) {
      const w = meilleurEffort(serie, e.secondes)
      if (w !== null) analyse.efforts[e.id] = w
    }
  }
  return analyse
}

export interface RecordDistance {
  id: string
  libelle: string
  dureeS: number
  date: string
  sortieId: string
  /** Secondes par kilomètre. */
  allure: number
}
export interface RecordEffort {
  id: string
  libelle: string
  watts: number
  date: string
  sortieId: string
}
export interface AutreRecord {
  id: 'plus-longue' | 'plus-longue-duree' | 'meilleure-semaine' | 'denivele'
  nom: string
  /** Valeur brute : mètres, secondes ou mètres de dénivelé selon l'id. */
  valeur: number
  date: string
}
export interface PointEvolution {
  /** yyyy-MM */
  mois: string
  dureeS: number
}

export interface RecordsSport {
  /** Une entrée par distance, null quand aucune sortie ne l'a couverte. */
  distances: { definition: DefinitionDistance; record: RecordDistance | null }[]
  efforts: { definition: DefinitionEffort; record: RecordEffort | null }[]
  /** Meilleur 5 km de chaque mois, les six derniers mois avec une mesure. */
  evolution5k: PointEvolution[]
  autres: AutreRecord[]
}

// Meilleure valeur d'une grandeur sur les analyses : `meilleur` choisit entre deux candidats ; à égalité, la plus ancienne garde le record.
function meilleurPar<T>(analyses: readonly AnalyseSortie[], extraire: (a: AnalyseSortie) => number | undefined, plusBas: boolean, fabriquer: (a: AnalyseSortie, v: number) => T): T | null {
  let retenu: { a: AnalyseSortie; v: number } | null = null
  for (const a of [...analyses].sort((x, y) => x.date.localeCompare(y.date))) {
    const v = extraire(a)
    if (v === undefined) continue
    if (retenu === null || (plusBas ? v < retenu.v : v > retenu.v)) retenu = { a, v }
  }
  return retenu ? fabriquer(retenu.a, retenu.v) : null
}

const MOIS_EVOLUTION = 6

export function calculerRecords(sorties: readonly Sortie[], analyses: readonly AnalyseSortie[], sport: Sport): RecordsSport {
  const distances = DISTANCES.map((definition) => ({
    definition,
    record: meilleurPar<RecordDistance>(analyses, (a) => a.temps[definition.id], true, (a, dureeS) => ({
      id: definition.id, libelle: definition.libelle, dureeS, date: a.date, sortieId: a.id, allure: dureeS / (definition.metres / 1000),
    })),
  }))
  const efforts = EFFORTS.map((definition) => ({
    definition,
    record: meilleurPar<RecordEffort>(analyses, (a) => a.efforts[definition.id], false, (a, watts) => ({ id: definition.id, libelle: definition.libelle, watts, date: a.date, sortieId: a.id })),
  }))

  const parMois = new Map<string, number>()
  for (const a of analyses) {
    const t = a.temps['5k']
    if (t === undefined) continue
    const mois = a.date.slice(0, 7)
    parMois.set(mois, Math.min(parMois.get(mois) ?? Infinity, t))
  }
  const evolution5k = [...parMois.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-MOIS_EVOLUTION)
    .map(([mois, dureeS]) => ({ mois, dureeS }))

  const duSport = sorties.filter((s) => s.sport === sport)
  const autres: AutreRecord[] = []
  const max = (valeur: (s: Sortie) => number | null) => duSport.reduce<{ s: Sortie; v: number } | null>((m, s) => {
    const v = valeur(s)
    return v !== null && v > 0 && (m === null || v > m.v) ? { s, v } : m
  }, null)
  const longue = max((s) => s.distanceM)
  if (longue) autres.push({ id: 'plus-longue', nom: 'Sortie la plus longue', valeur: longue.v, date: longue.s.date })
  const duree = max((s) => s.dureeS)
  if (duree) autres.push({ id: 'plus-longue-duree', nom: 'Plus longue durée', valeur: duree.v, date: duree.s.date })
  const semaines = new Map<string, number>()
  for (const s of duSport) if (s.distanceM) semaines.set(lundiDe(s.date), (semaines.get(lundiDe(s.date)) ?? 0) + s.distanceM)
  const meilleureSemaine = [...semaines.entries()].reduce<[string, number] | null>((m, e) => (m === null || e[1] > m[1] ? e : m), null)
  if (meilleureSemaine) autres.push({ id: 'meilleure-semaine', nom: 'Meilleure semaine', valeur: meilleureSemaine[1], date: meilleureSemaine[0] })
  const deniv = max((s) => s.denivelePosM)
  if (deniv) autres.push({ id: 'denivele', nom: 'Meilleur dénivelé', valeur: deniv.v, date: deniv.s.date })

  return { distances, efforts, evolution5k, autres }
}

/**
 * Badges de la liste : « Sortie la plus longue », « Meilleur 5 km : 24:38 », « Record de puissance sur 20 min : 279 W ». Rien tant
 * que le sport compte moins de deux sorties (la première serait trivialement un record).
 */
export function badgesParSortie(sorties: readonly Sortie[], records: RecordsSport, sport: Sport): Record<string, string[]> {
  const badges: Record<string, string[]> = {}
  const ajouter = (id: string, texte: string) => (badges[id] ??= []).push(texte)
  const duSport = sorties.filter((s) => s.sport === sport)
  if (duSport.length < 2) return badges
  const longue = records.autres.find((a) => a.id === 'plus-longue')
  const porteuse = longue && duSport.find((s) => s.distanceM === longue.valeur && s.date === longue.date)
  if (porteuse) ajouter(porteuse.id, 'Sortie la plus longue')
  for (const { definition, record } of records.distances) {
    if (record && definition.id !== '1k' && definition.id !== 'marathon') ajouter(record.sortieId, `Meilleur ${definition.libelle.toLowerCase() === 'semi' ? 'semi' : definition.libelle} : ${formaterDuree(record.dureeS)}`)
  }
  for (const { definition, record } of records.efforts) {
    if (record && definition.id !== '1min') ajouter(record.sortieId, `Record de puissance sur ${definition.libelle} : ${record.watts} W`)
  }
  return badges
}

// ── Objectif et bilan de la semaine ──────────────────────────────────────────────────────────────────────────

export interface BilanHebdo {
  nombre: number
  distanceM: number
  dureeS: number
  /** Course : secondes par km ; vélo : km/h ; sur les sorties qui ont distance et durée. null sans. */
  rythme: number | null
  /** Distance du même point de la semaine précédente (lundi à ce même jour d'avant), pour l'écart. */
  distancePrecedenteM: number
}

export function bilanHebdo(sorties: readonly Sortie[], sport: Sport, aujourdhuiIso: string): BilanHebdo {
  const debut = lundiDe(aujourdhuiIso)
  const dans = (de: string, a: string) => sorties.filter((s) => s.sport === sport && s.date >= de && s.date <= a)
  const courantes = dans(debut, aujourdhuiIso)
  const precedentes = dans(ajouterJours(debut, -7), ajouterJours(aujourdhuiIso, -7))
  const completes = courantes.filter((s) => s.distanceM && s.dureeS)
  const d = completes.reduce((t, s) => t + (s.distanceM as number), 0)
  const t = completes.reduce((x, s) => x + (s.dureeS as number), 0)
  return {
    nombre: courantes.length,
    distanceM: courantes.reduce((x, s) => x + (s.distanceM ?? 0), 0),
    dureeS: courantes.reduce((x, s) => x + (s.dureeS ?? 0), 0),
    rythme: d > 0 && t > 0 ? (sport === 'course' ? t / (d / 1000) : d / 1000 / (t / 3600)) : null,
    distancePrecedenteM: precedentes.reduce((x, s) => x + (s.distanceM ?? 0), 0),
  }
}

/** Jours restants dans la semaine après aujourd'hui (0 le dimanche). */
export function joursRestants(aujourdhuiIso: string): number {
  const jour = new Date(`${aujourdhuiIso}T00:00:00Z`).getUTCDay()
  return (7 - jour) % 7
}

// ── Position d'une sortie parmi les précédentes ───────────────────────────────────────────────────────────────

export interface Comparaison {
  id: 'distance' | 'rythme' | 'denivele'
  nom: string
  /** Position de la sortie et de la moyenne sur l'échelle min–max des sorties comparées, 0..100. */
  positionSortie: number
  positionMoyenne: number
  sortie: number
  moyenne: number
  /** « plus » : la valeur haute est meilleure (distance, vitesse) ; « moins » : la valeur basse l'est (allure en s/km). */
  meilleur: 'plus' | 'moins'
}

const FENETRE_COMPARAISON_JOURS = 30
const MIN_COMPARABLES = 3

/** Compare la sortie à celles du même sport des 30 jours qui la précèdent (au moins 3, elle-même exclue) ; null sinon. */
export function comparerSortie(s: Sortie, toutes: readonly Sortie[]): { comparaisons: Comparaison[]; nombre: number; rangDistance: number | null } | null {
  const debut = ajouterJours(s.date, -FENETRE_COMPARAISON_JOURS)
  const autres = toutes.filter((x) => x.id !== s.id && x.sport === s.sport && x.date >= debut && x.date <= s.date)
  if (autres.length < MIN_COMPARABLES) return null
  const rythme = (x: Sortie) => (x.distanceM && x.dureeS ? (s.sport === 'course' ? x.dureeS / (x.distanceM / 1000) : x.distanceM / 1000 / (x.dureeS / 3600)) : null)
  const grandeurs: { id: Comparaison['id']; nom: string; meilleur: Comparaison['meilleur']; valeur: (x: Sortie) => number | null }[] = [
    { id: 'distance', nom: 'Distance', meilleur: 'plus', valeur: (x) => x.distanceM },
    { id: 'rythme', nom: s.sport === 'course' ? 'Allure' : 'Vitesse moyenne', meilleur: s.sport === 'course' ? 'moins' : 'plus', valeur: rythme },
    { id: 'denivele', nom: 'Dénivelé positif', meilleur: 'plus', valeur: (x) => x.denivelePosM },
  ]
  const comparaisons: Comparaison[] = []
  for (const g of grandeurs) {
    const v = g.valeur(s)
    const autresV = autres.map(g.valeur).filter((x): x is number => x !== null)
    if (v === null || autresV.length < MIN_COMPARABLES) continue
    const moyenne = autresV.reduce((a, b) => a + b, 0) / autresV.length
    const tous = [...autresV, v]
    const [min, max] = [Math.min(...tous), Math.max(...tous)]
    const pos = (x: number) => (max === min ? 50 : Math.round(((x - min) / (max - min)) * 100))
    comparaisons.push({ id: g.id, nom: g.nom, positionSortie: pos(v), positionMoyenne: pos(moyenne), sortie: v, moyenne, meilleur: g.meilleur })
  }
  if (comparaisons.length === 0) return null
  const distances = autres.map((x) => x.distanceM).filter((x): x is number => x !== null)
  const rangDistance = s.distanceM !== null ? distances.filter((x) => x > (s.distanceM as number)).length + 1 : null
  return { comparaisons, nombre: autres.length + 1, rangDistance }
}

/** « Plus rapide que d'habitude », « Dans la moyenne », « Plus plat que d'habitude »… (écart de 3 % toléré). */
export function verdict(c: Comparaison): string {
  const rapport = c.moyenne === 0 ? 0 : (c.sortie - c.moyenne) / c.moyenne
  if (Math.abs(rapport) <= 0.03) return 'Dans la moyenne'
  const haut = rapport > 0
  if (c.id === 'distance') return haut ? 'Plus longue que d’habitude' : 'Plus courte que d’habitude'
  if (c.id === 'denivele') return haut ? 'Plus vallonnée que d’habitude' : 'Plus plate que d’habitude'
  // Allure (s/km) : valeur haute = plus lent ; vitesse (km/h) : valeur haute = plus rapide
  const plusRapide = c.meilleur === 'moins' ? !haut : haut
  return plusRapide ? 'Plus rapide que d’habitude' : 'Plus lente que d’habitude'
}
