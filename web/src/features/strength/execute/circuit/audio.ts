import type { Bip } from './bips'

// Sonneur Web Audio : reproduit les tonalités Android (ToneGenerator) par de simples oscillateurs.
// Tout est facultatif : API absente, lecture refusée par le navigateur ou erreur => silence, sans exception.

export interface ContexteAudio {
  readonly currentTime: number
  readonly state: string
  readonly destination: unknown
  resume(): Promise<void>
  close(): Promise<void>
  createGain(): {
    gain: { value: number; setValueAtTime(v: number, t: number): unknown; linearRampToValueAtTime(v: number, t: number): unknown }
    connect(destination: unknown): unknown
  }
  createOscillator(): {
    type: string
    frequency: { value: number }
    connect(destination: unknown): unknown
    start(t: number): void
    stop(t: number): void
  }
}

export interface Sonneur {
  /** À appeler depuis un geste de l'utilisateur (clic de lancement) : débloque la lecture sonore. */
  preparer(): void
  jouer(bip: Bip): void
  fermer(): void
}

// Fréquence (Hz), durée (s) : bip bref (BEEP2 100 ms / BEEP 120 ms), départ (BEEP2 200 ms), fin (800 ms)
const TONALITES: Record<Bip, { hz: number; sec: number }> = {
  compte: { hz: 880, sec: 0.1 },
  depart: { hz: 880, sec: 0.2 },
  fin: { hz: 660, sec: 0.8 },
  repos: { hz: 660, sec: 0.12 },
  // Fin naturelle du repos (Android : TONE_CDMA_ALERT_CALL_GUARD, 1,5 s)
  finRepos: { hz: 520, sec: 1.5 },
}
const VOLUME = 0.25

function contexteNavigateur(): ContexteAudio | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: new () => ContexteAudio; webkitAudioContext?: new () => ContexteAudio }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  return Ctor ? new Ctor() : null
}

export function creerSonneur(creer: () => ContexteAudio | null = contexteNavigateur): Sonneur {
  let ctx: ContexteAudio | null = null
  let essaye = false

  const contexte = (): ContexteAudio | null => {
    if (!essaye) {
      essaye = true
      try {
        ctx = creer()
      } catch (e) {
        console.warn('Audio indisponible : le circuit reste silencieux', e)
        ctx = null
      }
    }
    if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  }

  return {
    preparer() {
      contexte()
    },
    jouer(bip) {
      try {
        const c = contexte()
        if (!c) return
        const { hz, sec } = TONALITES[bip]
        const t = c.currentTime
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.type = 'sine'
        osc.frequency.value = hz
        // Enveloppe courte : évite le « clic » de début et de fin
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(VOLUME, t + 0.01)
        gain.gain.setValueAtTime(VOLUME, t + Math.max(0.01, sec - 0.02))
        gain.gain.linearRampToValueAtTime(0, t + sec)
        osc.connect(gain)
        gain.connect(c.destination)
        osc.start(t)
        osc.stop(t + sec)
      } catch (e) {
        console.warn('Bip impossible', e)
      }
    },
    fermer() {
      try {
        void ctx?.close().catch(() => {})
      } catch {
        // contexte déjà fermé
      }
      ctx = null
      essaye = false
    },
  }
}
