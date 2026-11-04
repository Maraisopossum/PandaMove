import type { Phase } from './moteur'

// Sons de la séance, synthétisés avec Web Audio (aucun fichier). Pendant chaque phase active, une tonalité continue avec
// fondu entrant et sortant ; la rétention poumons vides est silencieuse. Un bip court marque chaque seconde du décompte.

export interface AudioRespiration {
  /** Bip du décompte. */
  tic(): void
  /** Tonalité de la phase, sur `dureeMs` (silence pour la rétention poumons vides). */
  demarrerTon(phase: Phase, dureeMs: number): void
  arreterTon(): void
  liberer(): void
}

export const FREQUENCES_PHASE: Record<Phase, number | null> = {
  inspire: 432,
  retention_pleine: 440,
  expire: 396,
  retention_vide: null,
}

export const REGLAGES_AUDIO = { frequenceTic: 660, dureeTicMs: 80, fonduTicMs: 12, fonduTonMs: 200, volumeTon: 0.55, volumeTic: 0.45 } as const

// Contexte audio partagé. Les navigateurs (Safari surtout) n'autorisent le son qu'après un geste : `preparerAudio` est
// appelé depuis le clic sur « Démarrer », la session réutilise ensuite le même contexte.
let contexte: AudioContext | null = null

function obtenirContexte(): AudioContext | null {
  if (contexte && contexte.state !== 'closed') return contexte
  const Constructeur = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Constructeur) return null
  try {
    contexte = new Constructeur()
  } catch {
    contexte = null
  }
  return contexte
}

/** À appeler depuis un geste de l'utilisateur : crée le contexte audio et le réveille. Sans effet si le son est indisponible. */
export function preparerAudio(): void {
  const ctx = obtenirContexte()
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
}

// Enveloppe d'un son : montée linéaire jusqu'au volume, plateau, descente linéaire (le son s'arrête à `fin`).
function envelope(gain: GainNode, debut: number, fin: number, volume: number, fonduS: number): void {
  const fondu = Math.min(fonduS, (fin - debut) / 2)
  gain.gain.setValueAtTime(0, debut)
  gain.gain.linearRampToValueAtTime(volume, debut + fondu)
  gain.gain.setValueAtTime(volume, fin - fondu)
  gain.gain.linearRampToValueAtTime(0, fin)
}

export function creerAudio(): AudioRespiration {
  let ton: { oscillateur: OscillatorNode; gain: GainNode } | null = null

  function jouer(frequence: number, dureeMs: number, volume: number, fonduMs: number): { oscillateur: OscillatorNode; gain: GainNode } | null {
    const ctx = obtenirContexte()
    if (!ctx) return null
    try {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
      const oscillateur = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillateur.type = 'sine'
      oscillateur.frequency.value = frequence
      oscillateur.connect(gain)
      gain.connect(ctx.destination)
      const debut = ctx.currentTime
      const fin = debut + dureeMs / 1000
      envelope(gain, debut, fin, volume, fonduMs / 1000)
      oscillateur.start(debut)
      oscillateur.stop(fin + 0.02)
      oscillateur.onended = () => {
        oscillateur.disconnect()
        gain.disconnect()
      }
      return { oscillateur, gain }
    } catch {
      return null
    }
  }

  function arreterTon(): void {
    if (!ton) return
    const { oscillateur, gain } = ton
    ton = null
    const ctx = obtenirContexte()
    try {
      // Arrêt avec un fondu très court (évite le claquement d'une coupure sèche)
      if (ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05)
        oscillateur.stop(ctx.currentTime + 0.06)
      } else oscillateur.stop()
    } catch {
      /* déjà arrêté */
    }
  }

  return {
    tic() {
      jouer(REGLAGES_AUDIO.frequenceTic, REGLAGES_AUDIO.dureeTicMs, REGLAGES_AUDIO.volumeTic, REGLAGES_AUDIO.fonduTicMs)
    },
    demarrerTon(phase, dureeMs) {
      arreterTon()
      const frequence = FREQUENCES_PHASE[phase]
      if (frequence === null || dureeMs <= 0) return
      ton = jouer(frequence, dureeMs, REGLAGES_AUDIO.volumeTon, REGLAGES_AUDIO.fonduTonMs)
    },
    arreterTon,
    liberer: arreterTon,
  }
}

/** Audio muet : sert aux tests et quand le son est indisponible. */
export const audioMuet: AudioRespiration = { tic: () => undefined, demarrerTon: () => undefined, arreterTon: () => undefined, liberer: () => undefined }
