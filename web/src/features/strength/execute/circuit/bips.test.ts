import { describe, expect, it, vi } from 'vitest'
import { affichage, avancer, demarrer, type ExercicePlan, type PlanCircuit } from './machine'
import { bipsEntre } from './bips'
import { creerSonneur, type ContexteAudio } from './audio'

const exo = (id: string, secondes: number): ExercicePlan => ({
  id, nom: id, toursPrevus: 1, lignes: [{ numero: 1, libelle: '1', cote: '', secondes, chargeKg: null, faite: false }],
})
const plan = (...e: ExercicePlan[]): PlanCircuit => ({ mode: 'circuit', exercices: e, reposInterSec: 10, reposFinTourSec: 10 })
const T0 = 0

// Affichage de l'état obtenu en avançant la machine à l'instant `t`
function vue(p: PlanCircuit, t: number) {
  const r = avancer(demarrer(p, { exIdx: 0, numero: 1 }, T0), t)
  return affichage(r.etat, t)
}

describe('bipsEntre', () => {
  const p = plan(exo('a', 20), exo('b', 20))
  it('rien pendant le décompte ni sans changement de seconde significative', () => {
    expect(bipsEntre(null, vue(p, 0))).toEqual([])
    expect(bipsEntre(vue(p, 0), vue(p, 1000))).toEqual([])
    expect(bipsEntre(vue(p, 3000), vue(p, 4000))).toEqual([])
  })
  it('bip de départ à la fin du décompte', () => {
    expect(bipsEntre(vue(p, 2999), vue(p, 3000))).toEqual(['depart'])
  })
  it('bip de compte à rebours à 5, 4, 3, 2, 1 secondes restantes (une fois par seconde)', () => {
    // exercice de 3000 à 23000 ; 5 s restantes à 18000
    expect(bipsEntre(vue(p, 17_000), vue(p, 18_000))).toEqual(['compte'])
    expect(bipsEntre(vue(p, 18_000), vue(p, 18_400))).toEqual([])
    expect(bipsEntre(vue(p, 21_000), vue(p, 22_000))).toEqual(['compte'])
    expect(bipsEntre(vue(p, 16_000), vue(p, 17_000))).toEqual([]) // 7 s -> 6 s
  })
  it('bip de fin quand le minuteur atteint zéro', () => {
    expect(bipsEntre(vue(p, 22_999), vue(p, 23_000))).toEqual(['fin'])
  })
  it('bip de compte à rebours aussi pendant le repos', () => {
    // repos de 23000 à 33000 ; 5 s restantes à 28000
    expect(bipsEntre(vue(p, 27_000), vue(p, 28_000))).toEqual(['repos'])
    expect(bipsEntre(vue(p, 26_000), vue(p, 27_000))).toEqual([])
  })
  it('fin du repos : départ de l’exercice suivant', () => {
    expect(bipsEntre(vue(p, 32_999), vue(p, 33_000))).toEqual(['depart'])
  })
  it('fin du dernier exercice (affichage nul) : bip de fin', () => {
    const seul = plan(exo('a', 5))
    expect(bipsEntre(vue(seul, 7999), vue(seul, 8000))).toEqual(['fin'])
  })
  it('enchaînement sans repos : fin puis départ', () => {
    const sans: PlanCircuit = { ...plan(exo('a', 5), exo('b', 5)), reposInterSec: 0 }
    expect(bipsEntre(vue(sans, 7999), vue(sans, 8000))).toEqual(['fin', 'depart'])
  })
})

// Faux contexte audio : enregistre les oscillateurs lancés
function fauxContexte() {
  const lances: { frequence: number; type: string; debut: number; fin: number }[] = []
  const ctx: ContexteAudio = {
    currentTime: 10,
    state: 'running',
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createGain: () => ({ gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn() }),
    createOscillator: () => {
      const o = {
        type: 'sine', frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
      }
      o.start.mockImplementation((t: number) => (o as unknown as { debut: number }).debut = t)
      o.stop.mockImplementation((t: number) => {
        lances.push({ frequence: o.frequency.value, type: o.type, debut: (o as unknown as { debut: number }).debut, fin: t })
      })
      return o
    },
  }
  return { ctx, lances }
}

describe('creerSonneur', () => {
  it('joue un bip bref par type, de durée croissante pour le bip de fin', () => {
    const { ctx, lances } = fauxContexte()
    const s = creerSonneur(() => ctx)
    s.jouer('compte')
    s.jouer('fin')
    expect(lances).toHaveLength(2)
    expect(lances[0].fin - lances[0].debut).toBeCloseTo(0.1, 2)
    expect(lances[1].fin - lances[1].debut).toBeCloseTo(0.8, 2)
    expect(lances[0].frequence).toBeGreaterThan(0)
  })
  it('crée le contexte une seule fois et le réveille (politique de lecture automatique)', () => {
    const { ctx } = fauxContexte()
    ;(ctx as { state: string }).state = 'suspended'
    const creer = vi.fn(() => ctx)
    const s = creerSonneur(creer)
    s.preparer()
    s.jouer('depart')
    expect(creer).toHaveBeenCalledTimes(1)
    expect(ctx.resume).toHaveBeenCalled()
  })
  it('reste muet sans erreur quand l’audio est absent ou refuse de démarrer', () => {
    const absent = creerSonneur(() => null)
    expect(() => {
      absent.preparer()
      absent.jouer('fin')
      absent.fermer()
    }).not.toThrow()
    const casse = creerSonneur(() => {
      throw new Error('NotAllowedError')
    })
    expect(() => casse.jouer('depart')).not.toThrow()
  })
  it('fermer libère le contexte', () => {
    const { ctx } = fauxContexte()
    const s = creerSonneur(() => ctx)
    s.preparer()
    s.fermer()
    expect(ctx.close).toHaveBeenCalled()
  })
})
