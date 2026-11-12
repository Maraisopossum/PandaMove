// Sons de la séance de mobilité, synthétisés avec Web Audio (aucun fichier) : un bip bref au changement de phase, deux bips
// pour changer de côté, trois notes montantes à la fin. Le son se coupe d'un bouton, réglage gardé par appareil.

const CLE_SON = 'pandamove.mobilite.son'

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
    // stockage bloqué : le réglage ne sera pas retenu
  }
}

export type SonMobilite = 'phase' | 'cote' | 'fin'

type ContexteAudio = AudioContext
const NOTES: Record<SonMobilite, { f: number; delaiMs: number }[]> = {
  phase: [{ f: 660, delaiMs: 0 }],
  cote: [{ f: 520, delaiMs: 0 }, { f: 520, delaiMs: 170 }],
  fin: [{ f: 523.25, delaiMs: 0 }, { f: 659.25, delaiMs: 200 }, { f: 783.99, delaiMs: 400 }],
}

export interface AudioMobilite {
  jouer(son: SonMobilite): void
  liberer(): void
}

// Contexte créé au premier son (après un geste de l'utilisateur : le bouton « Commencer »). Sans Web Audio : silence.
export function creerAudio(): AudioMobilite {
  let ctx: ContexteAudio | null = null
  const obtenir = (): ContexteAudio | null => {
    if (ctx) return ctx
    const Constructeur = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    if (!Constructeur) return null
    try {
      ctx = new Constructeur()
    } catch {
      ctx = null
    }
    return ctx
  }
  return {
    jouer(son) {
      const c = obtenir()
      if (!c) return
      if (c.state === 'suspended') void c.resume().catch(() => undefined)
      for (const { f, delaiMs } of NOTES[son]) {
        const debut = c.currentTime + delaiMs / 1000
        const osc = c.createOscillator()
        const gain = c.createGain()
        osc.frequency.value = f
        gain.gain.setValueAtTime(0.0001, debut)
        gain.gain.exponentialRampToValueAtTime(0.12, debut + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.16)
        osc.connect(gain).connect(c.destination)
        osc.start(debut)
        osc.stop(debut + 0.2)
      }
    },
    liberer() {
      void ctx?.close().catch(() => undefined)
      ctx = null
    },
  }
}
