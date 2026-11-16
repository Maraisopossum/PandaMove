import { useCallback, useSyncExternalStore } from 'react'
import type { ModuleId } from './modules'

// Ordre des modules, choisi par l'utilisateur : il vaut pour le menu de navigation ET pour les accès rapides de l'Accueil. L'Accueil reste
// toujours en tête du menu. Chaque module peut en plus être affiché ou masqué parmi les accès rapides de l'Accueil.
// Réglage d'appareil (localStorage, clé `pandamove.modules.ordre`), jamais synchronisé, comme les autres préférences d'affichage.
// Toute lecture tolère un stockage absent, corrompu ou obsolète (module retiré, module nouveau ajouté en fin de liste).

export const CLE_ORDRE_MODULES = 'pandamove.modules.ordre'
const EVENEMENT = 'pandamove:modules'

/** Modules déplaçables, dans l'ordre par défaut : le sport, la préparation, le quotidien, puis les écrans transverses. */
export const MODULES_ORDONNABLES: readonly ModuleId[] = [
  'strength', 'running', 'cycling', 'hyrox', 'plans', 'calendar', 'nutrition', 'mobility', 'breathing', 'stats', 'tools', 'profile', 'import',
]

/** Accès rapides de l'Accueil par défaut : trois rangées de trois. */
export const TUILES_DEFAUT: readonly ModuleId[] = ['strength', 'running', 'cycling', 'hyrox', 'plans', 'calendar', 'nutrition', 'mobility', 'breathing']

export interface PreferencesModules {
  /** Ordre de tous les modules déplaçables (menu et accès rapides). */
  ordre: ModuleId[]
  /** Modules affichés parmi les accès rapides de l'Accueil. */
  tuiles: ModuleId[]
}

export const PREFERENCES_DEFAUT: PreferencesModules = { ordre: [...MODULES_ORDONNABLES], tuiles: [...TUILES_DEFAUT] }

const estModule = (v: unknown): v is ModuleId => typeof v === 'string' && (MODULES_ORDONNABLES as readonly string[]).includes(v)
const sansDoublon = (liste: ModuleId[]) => liste.filter((id, i) => liste.indexOf(id) === i)

/** Préférences valides à partir d'une valeur quelconque (JSON relu) : ids inconnus écartés, modules manquants ajoutés en fin d'ordre. */
export function normaliser(brut: unknown): PreferencesModules {
  const o = (typeof brut === 'object' && brut !== null ? brut : {}) as { ordre?: unknown; tuiles?: unknown }
  const donne = sansDoublon((Array.isArray(o.ordre) ? o.ordre : []).filter(estModule))
  const ordre = [...donne, ...MODULES_ORDONNABLES.filter((id) => !donne.includes(id))]
  const tuiles = Array.isArray(o.tuiles) ? sansDoublon(o.tuiles.filter(estModule)) : [...TUILES_DEFAUT]
  return { ordre, tuiles }
}

/** Déplace un module d'un rang vers le haut (-1) ou le bas (+1) ; inchangé aux extrémités. */
export function deplacer(ordre: readonly ModuleId[], id: ModuleId, sens: -1 | 1): ModuleId[] {
  const i = ordre.indexOf(id)
  const j = i + sens
  if (i < 0 || j < 0 || j >= ordre.length) return [...ordre]
  const suite = [...ordre]
  ;[suite[i], suite[j]] = [suite[j], suite[i]]
  return suite
}

/** Modules du menu de navigation : l'Accueil d'abord, puis l'ordre choisi. */
export const modulesDuMenu = (p: PreferencesModules): ModuleId[] => ['home', ...p.ordre]

/** Accès rapides de l'Accueil : les modules cochés, dans l'ordre choisi. */
export const tuilesAccueil = (p: PreferencesModules): ModuleId[] => p.ordre.filter((id) => p.tuiles.includes(id))

const local = () => (typeof localStorage === 'undefined' ? undefined : localStorage)

function brut(): string | null {
  try {
    return local()?.getItem(CLE_ORDRE_MODULES) ?? null
  } catch {
    return null
  }
}

function analyser(texte: string | null): PreferencesModules {
  if (texte === null) return PREFERENCES_DEFAUT
  try {
    return normaliser(JSON.parse(texte))
  } catch {
    return PREFERENCES_DEFAUT
  }
}

export const lirePreferencesModules = (): PreferencesModules => analyser(brut())

export function ecrirePreferencesModules(p: PreferencesModules): void {
  try {
    local()?.setItem(CLE_ORDRE_MODULES, JSON.stringify(normaliser(p)))
  } catch {
    // Stockage indisponible : le réglage vaut pour la session seulement (non relu)
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENEMENT))
}

export function reinitialiserPreferencesModules(): void {
  try {
    local()?.removeItem(CLE_ORDRE_MODULES)
  } catch {
    // rien à faire
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENEMENT))
}

// Instantané stable (même objet tant que le texte stocké ne change pas) : requis par useSyncExternalStore
let cache: { texte: string | null; valeur: PreferencesModules } | null = null
function instantane(): PreferencesModules {
  const texte = brut()
  if (!cache || cache.texte !== texte) cache = { texte, valeur: analyser(texte) }
  return cache.valeur
}

function abonner(rappel: () => void): () => void {
  window.addEventListener(EVENEMENT, rappel)
  window.addEventListener('storage', rappel)
  return () => {
    window.removeEventListener(EVENEMENT, rappel)
    window.removeEventListener('storage', rappel)
  }
}

/** Préférences courantes, à jour dans tous les composants (menu, Accueil, écran d'organisation) dès qu'elles changent. */
export function usePreferencesModules(): { preferences: PreferencesModules; modifier: (p: PreferencesModules) => void; reinitialiser: () => void } {
  const preferences = useSyncExternalStore(abonner, instantane, () => PREFERENCES_DEFAUT)
  const modifier = useCallback((p: PreferencesModules) => ecrirePreferencesModules(p), [])
  return { preferences, modifier, reinitialiser: reinitialiserPreferencesModules }
}
