import type { Phase } from './moteur'

// Sons de la séance, synthétisés avec Web Audio (aucun fichier). Une cloche douce marque le début de chaque phase et
// s'éteint d'elle-même (pas de tonalité continue : un son tenu pendant toute la phase fatigue) ; la rétention poumons
// vides est silencieuse. Un tic très discret rythme le décompte. Le son se coupe d'un bouton, réglage gardé par appareil.

export interface AudioRespiration {
  /** Tic du décompte. */
  tic(): void
  /** Cloche de la phase (silence pour la rétention poumons vides). `dureeMs` borne la résonance. */
  demarrerTon(phase: Phase, dureeMs: number): void
  arreterTon(): void
  liberer(): void
}

// Notes graves et douces : do5 à l'inspiration (le souffle monte), sol4 à l'expiration (il descend), mi5 très léger en rétention.
export const FREQUENCES_PHASE: Record<Phase, number | null> = {
  inspire: 523.25,
  retention_pleine: 659.25,
  expire: 392,
  retention_vide: null,
}

// Volumes bas (amplitude 0..1). `resonanceMs` : durée d'extinction de la cloche, plafonnée par la durée de la phase.
export const REGLAGES_AUDIO = {
  volumeCloche: 0.14,
  volumeRetention: 0.07,
  resonanceMs: 1800,
  attaqueMs: 60,
  frequenceTic: 330,
  dureeTicMs: 70,
  volumeTic: 0.05,
} as const

const CLE_SON = 'pandamove.respiration.son'

/** Son activé ? Oui par défaut ; sans stockage disponible, oui. */
export function lireSonActif(): boolean {
  try {
    return localStorage.getItem(CLE_SON) !== '0'
  } catch {
    return true
  }
}

export function ecrireSonActif(actif: boolean): void {
  try {
    localStorage.setItem(CLE_SON, actif ? '1' : '0')
  } catch {
    /* stockage indisponible : le réglage vaut pour la séance en cours seulement */
  }
}

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

interface Cloche {
  gain: GainNode
  oscillateurs: OscillatorNode[]
}

export function creerAudio(): AudioRespiration {
  let courante: Cloche | null = null

  // Une note douce : fondamentale + harmonique 2 (plus faible), attaque courte, extinction exponentielle.
  function sonner(frequence: number, dureeMs: number, volume: number, attaqueMs: number): Cloche | null {
    if (!lireSonActif()) return null
    const ctx = obtenirContexte()
    if (!ctx) return null
    try {
      if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
      const debut = ctx.currentTime
      const attaque = attaqueMs / 1000
      const fin = debut + dureeMs / 1000
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, debut)
      gain.gain.linearRampToValueAtTime(volume, debut + attaque)
      gain.gain.exponentialRampToValueAtTime(0.0001, fin)
      gain.connect(ctx.destination)
      const oscillateurs = [1, 2].map((rang) => {
        const o = ctx.createOscillator()
        const poids = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = frequence * rang
        poids.gain.value = rang === 1 ? 1 : 0.2
        o.connect(poids)
        poids.connect(gain)
        o.start(debut)
        o.stop(fin + 0.05)
        return o
      })
      oscillateurs[0].onended = () => gain.disconnect()
      return { gain, oscillateurs }
    } catch {
      return null
    }
  }

  function arreterTon(): void {
    if (!courante) return
    const { gain, oscillateurs } = courante
    courante = null
    const ctx = obtenirContexte()
    try {
      // Extinction rapide (évite le claquement d'une coupure sèche)
      if (ctx) {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08)
        for (const o of oscillateurs) o.stop(ctx.currentTime + 0.1)
      }
    } catch {
      /* déjà arrêtée */
    }
  }

  return {
    tic() {
      sonner(REGLAGES_AUDIO.frequenceTic, REGLAGES_AUDIO.dureeTicMs, REGLAGES_AUDIO.volumeTic, 5)
    },
    demarrerTon(phase, dureeMs) {
      arreterTon()
      const frequence = FREQUENCES_PHASE[phase]
      if (frequence === null || dureeMs <= 0) return
      const volume = phase === 'retention_pleine' ? REGLAGES_AUDIO.volumeRetention : REGLAGES_AUDIO.volumeCloche
      courante = sonner(frequence, Math.min(REGLAGES_AUDIO.resonanceMs, dureeMs), volume, REGLAGES_AUDIO.attaqueMs)
    },
    arreterTon,
    liberer: arreterTon,
  }
}

/** Audio muet : sert aux tests et quand le son est indisponible. */
export const audioMuet: AudioRespiration = { tic: () => undefined, demarrerTon: () => undefined, arreterTon: () => undefined, liberer: () => undefined }
