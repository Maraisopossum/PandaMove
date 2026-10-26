// Réglages des retours du circuit (son, vibration, voix), mémorisés PAR APPAREIL dans le navigateur.
// Module pur : le stockage est injecté (localStorage par défaut), toute erreur d'accès est absorbée.

export interface ReglagesCircuit {
  /** Bips (comme l'Android) */
  son: boolean
  /** Vibration (navigator.vibrate ; absente sur iOS Safari) */
  vibration: boolean
  /** Annonces vocales (speechSynthesis, fr-FR) */
  voix: boolean
  /** Compte à rebours 3-2-1 parlé (utile seulement si la voix est activée) */
  voixCompte: boolean
}

export const CLE_REGLAGES = 'pandamove.circuit.reglages'

// Voix désactivée par défaut : un lecteur d'écran lit déjà les annonces de l'écran du circuit
export const DEFAUTS: ReglagesCircuit = { son: true, vibration: true, voix: false, voixCompte: false }

export interface Stockage {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
}

// Lecture tolérante : champ par champ, tout ce qui n'est pas un booléen retombe sur le défaut.
export function analyserReglages(brut: string | null): ReglagesCircuit {
  if (brut === null) return DEFAUTS
  let valeur: unknown
  try {
    valeur = JSON.parse(brut)
  } catch {
    return DEFAUTS
  }
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) return DEFAUTS
  const v = valeur as Record<string, unknown>
  const bool = (cle: keyof ReglagesCircuit) => (typeof v[cle] === 'boolean' ? (v[cle] as boolean) : DEFAUTS[cle])
  return { son: bool('son'), vibration: bool('vibration'), voix: bool('voix'), voixCompte: bool('voixCompte') }
}

function stockageNavigateur(): Stockage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Texte brut mémorisé (null si rien ou stockage inaccessible). */
export function lireBrut(stockage: Stockage | null = stockageNavigateur()): string | null {
  try {
    return stockage?.getItem(CLE_REGLAGES) ?? null
  } catch {
    return null
  }
}

export function lireReglages(stockage: Stockage | null = stockageNavigateur()): ReglagesCircuit {
  return analyserReglages(lireBrut(stockage))
}

export function ecrireReglages(reglages: ReglagesCircuit, stockage: Stockage | null = stockageNavigateur()): void {
  try {
    stockage?.setItem(CLE_REGLAGES, JSON.stringify(reglages))
  } catch {
    // stockage indisponible : le choix vaut pour la session seulement
  }
}
