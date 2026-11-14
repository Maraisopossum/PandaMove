import { LIBELLE_TYPE, libelleZone, MOMENTS, SEANCES_TYPES, TOUS_TYPES } from './donnees'
import { genererSeance, type PlanSeance } from './generer'
import { ecrireChoix, ecrirePlan, normaliserChoix, type ChoixMobilite } from './stockage'

// Routines de mobilité : un réglage (temps, séance type, types d'exercices, zones, moment) nommé et gardé pour être relancé en
// un toucher. Propres à l'appareil, comme le dernier choix : elles ne sont pas synchronisées (pas de table, rien à déployer).
// Toute lecture tolère un stockage absent ou corrompu.

const CLE_ROUTINES = 'pandamove.mobilite.routines'
const NOMBRE_MAX = 20
const LONGUEUR_NOM_MAX = 40

export interface Routine {
  id: string
  nom: string
  choix: ChoixMobilite
}

const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage)

export function lireRoutines(): Routine[] {
  try {
    const v: unknown = JSON.parse(local()?.getItem(CLE_ROUTINES) ?? 'null')
    if (!Array.isArray(v)) return []
    return v.flatMap((x: Partial<Routine> | null) =>
      x && typeof x.id === 'string' && x.id !== '' && typeof x.nom === 'string' && x.nom.trim() !== ''
        ? [{ id: x.id, nom: x.nom.trim().slice(0, LONGUEUR_NOM_MAX), choix: normaliserChoix(x.choix) }]
        : [],
    ).slice(0, NOMBRE_MAX)
  } catch {
    return []
  }
}

export function ecrireRoutines(routines: Routine[]): void {
  try {
    local()?.setItem(CLE_ROUTINES, JSON.stringify(routines.slice(0, NOMBRE_MAX)))
  } catch {
    // stockage plein ou bloqué : la routine n'est simplement pas retenue
  }
}

export const nomValide = (nom: string) => nom.trim().length > 0

/** Ajoute une routine en tête ; renvoie la liste à jour. Un nom vide est refusé (liste inchangée). */
export function ajouterRoutine(routines: Routine[], nom: string, choix: ChoixMobilite, id: string): Routine[] {
  if (!nomValide(nom) || routines.length >= NOMBRE_MAX) return routines
  return [{ id, nom: nom.trim().slice(0, LONGUEUR_NOM_MAX), choix }, ...routines]
}

export function renommerRoutine(routines: Routine[], id: string, nom: string): Routine[] {
  return nomValide(nom) ? routines.map((r) => (r.id === id ? { ...r, nom: nom.trim().slice(0, LONGUEUR_NOM_MAX) } : r)) : routines
}

export const retirerRoutine = (routines: Routine[], id: string): Routine[] => routines.filter((r) => r.id !== id)

/** Nom proposé à l'enregistrement : « Mobilité seule · 10 min », « Hanches, Fessiers · 8 min »… */
export function nomSuggere(choix: ChoixMobilite): string {
  const sport = SEANCES_TYPES.find((s) => s.id === choix.sport)
  const base = sport ? sport.libelle : choix.zones.length > 0 ? choix.zones.slice(0, 2).map(libelleZone).join(', ') : 'Ma routine'
  return `${base} · ${choix.minutes} min`
}

/** Étiquettes de la carte : types (s'ils ne sont pas les trois) puis zones, au plus `max`. */
export function etiquettes(choix: ChoixMobilite, max = 4): string[] {
  const types = choix.types.length < TOUS_TYPES.length ? choix.types.map((t) => LIBELLE_TYPE[t]) : []
  const zones = choix.zones.length > 0 ? choix.zones.map(libelleZone) : ['Tout le corps']
  return [...types, ...zones].slice(0, max)
}

/** Séance qu'une routine produirait, à graine fixe : sert à compter les exercices de la carte sans la lancer. */
export function apercuRoutine(choix: ChoixMobilite, graine = 1): PlanSeance {
  return genererSeance({ minutes: choix.minutes, zones: choix.zones, moment: choix.moment, types: choix.types, graine })
}

export const libelleMoment = (choix: ChoixMobilite) => (MOMENTS.find((m) => m.id === choix.moment)?.libelle ?? '').toLowerCase()

/** Détail de la carte : « 8 min · 8 exercices · avant le sport ». */
export function detailRoutine(choix: ChoixMobilite): string {
  const n = apercuRoutine(choix).etapes.length
  return `${choix.minutes} min · ${n} exercice${n > 1 ? 's' : ''} · ${libelleMoment(choix)}`
}

/** Prépare la séance d'un choix (tirage au hasard), la garde pour l'aperçu et retient le choix : même geste que « Générer ». */
export function preparerSeance(choix: ChoixMobilite): PlanSeance {
  const plan = genererSeance({ minutes: choix.minutes, zones: choix.zones, moment: choix.moment, types: choix.types, graine: Math.floor(Math.random() * 1_000_000) })
  ecrireChoix(choix)
  ecrirePlan(plan)
  return plan
}
