import type { Sonneur } from './audio'
import { bipsEntre, type Bip } from './bips'
import type { Affichage, NatureRepos } from './machine'
import type { ReglagesCircuit } from './reglages'

// Retours sensoriels du circuit au-delà des bips d'Android, adaptés au web : vibration et voix.
// Les API navigateur sont injectées (aucun appel direct dans la logique) ; chacune se dégrade en silence.

export type Evenement =
  | { type: 'decompte'; restant: number; nom: string; premier: boolean }
  | { type: 'depart' }
  | { type: 'repos'; nature: NatureRepos; prochain: string }
  | { type: 'termine' }

// Événements « de sens » entre deux affichages (les bips de fin / compte à rebours viennent de bipsEntre).
export function evenementsEntre(avant: Affichage | null, apres: Affichage | null, termine: boolean): Evenement[] {
  const evs: Evenement[] = []
  const change = avant !== null && (apres === null || apres.cle !== avant.cle)
  if (apres?.phase === 'decompte' && (avant === null || change || avant.restantSec !== apres.restantSec)) {
    evs.push({ type: 'decompte', restant: apres.restantSec, nom: apres.nomExercice, premier: avant === null || change })
  }
  if (apres?.phase === 'actif' && change) evs.push({ type: 'depart' })
  if (apres?.phase === 'repos' && apres.repos && (avant === null || change)) {
    evs.push({ type: 'repos', nature: apres.repos.nature, prochain: apres.repos.prochain })
  }
  if (apres === null && termine) evs.push({ type: 'termine' })
  return evs
}

// Motifs de vibration (ms, alternance vibre / pause)
export const MOTIFS = {
  depart: [100],
  compte: [40],
  fin: [400],
  double: [120, 80, 120],
} as const
const PAUSE_ENTRE_MOTIFS = 100

// --- Vibration ---------------------------------------------------------------------------------------

export interface Vibreur {
  vibrer(motif: readonly number[]): void
  arreter(): void
}
interface ApiVibration {
  vibrate(motif: number | number[]): boolean
}

function vibrationNavigateur(): ApiVibration | null {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator : null
}

export function creerVibreur(fournir: () => ApiVibration | null = vibrationNavigateur): Vibreur {
  const appeler = (motif: number | number[]) => {
    try {
      fournir()?.vibrate(motif)
    } catch {
      // vibration absente (iOS Safari) ou refusée : silence
    }
  }
  return { vibrer: (motif) => appeler([...motif]), arreter: () => appeler(0) }
}

/** Ce que l'appareil sait faire (pour l'afficher dans les réglages). */
export function capacites(): { vibration: boolean; voix: boolean } {
  return { vibration: vibrationNavigateur() !== null, voix: voixNavigateur() !== null }
}

// --- Voix --------------------------------------------------------------------------------------------

export interface Voix {
  /** À appeler depuis un geste de l'utilisateur : débloque la synthèse (iOS, autoplay). */
  preparer(): void
  dire(texte: string): void
  arreter(): void
}
interface Enonce {
  text: string
  lang: string
  volume: number
}
interface FournisseurVoix {
  synth: { speak(e: Enonce): void; cancel(): void }
  enonce(texte: string): Enonce
}

function voixNavigateur(): FournisseurVoix | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null
  return {
    synth: window.speechSynthesis as unknown as FournisseurVoix['synth'],
    enonce: (texte) => new SpeechSynthesisUtterance(texte) as unknown as Enonce,
  }
}

export function creerVoix(fournir: () => FournisseurVoix | null = voixNavigateur): Voix {
  const parler = (texte: string, volume: number) => {
    try {
      const f = fournir()
      if (!f) return
      const e = f.enonce(texte)
      e.lang = 'fr-FR'
      e.volume = volume
      f.synth.speak(e)
    } catch {
      // synthèse indisponible ou refusée : silence
    }
  }
  return {
    preparer: () => parler('', 0),
    dire: (texte) => parler(texte, 1),
    arreter() {
      try {
        fournir()?.synth.cancel()
      } catch {
        // rien à annuler
      }
    },
  }
}

// --- Assemblage --------------------------------------------------------------------------------------

export interface ContexteRetours {
  /** La machine vient de finir normalement (pas d'arrêt manuel) */
  termine: boolean
  mode: 'circuit' | 'seul'
}

export interface Retours {
  preparer(reglages: ReglagesCircuit): void
  appliquer(avant: Affichage | null, apres: Affichage | null, ctx: ContexteRetours, reglages: ReglagesCircuit): void
  arreter(): void
  fermer(): void
}

const MOTIF_BIP: Partial<Record<Bip, readonly number[]>> = { depart: MOTIFS.depart, compte: MOTIFS.compte, fin: MOTIFS.fin }

function phraseRepos(nature: NatureRepos, prochain: string): string {
  if (nature === 'cote') return 'Changez de côté'
  return `${nature === 'fin-tour' ? 'Fin du tour. ' : ''}Repos. Prochain exercice : ${prochain}`
}

export function creerRetours({ sonneur, vibreur, voix }: { sonneur: Sonneur; vibreur: Vibreur; voix: Voix }): Retours {
  return {
    preparer(r) {
      if (r.son) sonneur.preparer()
      if (r.voix) voix.preparer()
    },
    appliquer(avant, apres, ctx, r) {
      const bips = bipsEntre(avant, apres)
      const evenements = evenementsEntre(avant, apres, ctx.termine)
      if (r.son) for (const b of bips) sonneur.jouer(b)

      if (r.vibration) {
        const motifs: (readonly number[])[] = []
        for (const b of bips) {
          const m = MOTIF_BIP[b]
          if (m) motifs.push(m)
        }
        if (evenements.some((e) => e.type === 'repos' || e.type === 'termine')) motifs.push(MOTIFS.double)
        if (motifs.length > 0) vibreur.vibrer(motifs.flatMap((m, i) => (i === 0 ? [...m] : [PAUSE_ENTRE_MOTIFS, ...m])))
      }

      if (r.voix) {
        for (const e of evenements) {
          if (e.type === 'decompte') {
            if (r.voixCompte) voix.dire(String(e.restant))
            else if (e.premier) voix.dire(`Prochain exercice : ${e.nom}`)
          } else if (e.type === 'depart') voix.dire('Allez !')
          else if (e.type === 'repos') voix.dire(phraseRepos(e.nature, e.prochain))
          else voix.dire(ctx.mode === 'seul' ? 'Minuteur terminé' : 'Circuit terminé')
        }
      }
    },
    arreter() {
      voix.arreter()
      vibreur.arreter()
    },
    fermer() {
      voix.arreter()
      vibreur.arreter()
      sonneur.fermer()
    },
  }
}
