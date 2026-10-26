import { describe, expect, it, vi } from 'vitest'
import type { Sonneur } from './audio'
import { affichage, avancer, demarrer, type Affichage, type PlanCircuit } from './machine'
import { DEFAUTS, type ReglagesCircuit } from './reglages'
import { creerRetours, creerVibreur, creerVoix, evenementsEntre, MOTIFS } from './retours'

const plan = (s1: number, s2: number, inter = 10): PlanCircuit => ({
  mode: 'circuit', reposInterSec: inter, reposFinTourSec: 10,
  exercices: [
    { id: 'a', nom: 'Squat', toursPrevus: 1, lignes: [{ numero: 1, libelle: '1', cote: '', secondes: s1, chargeKg: null, faite: false }] },
    { id: 'b', nom: 'Gainage', toursPrevus: 1, lignes: [{ numero: 1, libelle: '1', cote: '', secondes: s2, chargeKg: null, faite: false }] },
  ],
})
const vue = (p: PlanCircuit, t: number): Affichage | null => affichage(avancer(demarrer(p, { exIdx: 0, numero: 1 }, 0), t).etat, t)

describe('evenementsEntre', () => {
  const p = plan(20, 20)
  it('décompte : un événement au début puis à chaque chiffre', () => {
    expect(evenementsEntre(null, vue(p, 0), false)).toEqual([{ type: 'decompte', restant: 3, nom: 'Squat', premier: true }])
    expect(evenementsEntre(vue(p, 0), vue(p, 500), false)).toEqual([])
    expect(evenementsEntre(vue(p, 500), vue(p, 1000), false)).toEqual([{ type: 'decompte', restant: 2, nom: 'Squat', premier: false }])
  })
  it('départ, entrée en repos avec le prochain exercice, fin du circuit', () => {
    expect(evenementsEntre(vue(p, 2999), vue(p, 3000), false)).toEqual([{ type: 'depart' }])
    expect(evenementsEntre(vue(p, 22_999), vue(p, 23_000), false)).toEqual([{ type: 'repos', nature: 'inter', prochain: 'Gainage' }])
    const dernier = plan(5, 5, 0)
    expect(evenementsEntre(vue(dernier, 13_000), vue(dernier, 13_001), false)).toEqual([])
    expect(evenementsEntre(vue(dernier, 12_999), null, true)).toEqual([{ type: 'termine' }])
  })
  it('rien en cours de seconde sans changement', () => {
    expect(evenementsEntre(vue(p, 5000), vue(p, 6000), false)).toEqual([])
  })
})

describe('creerVibreur', () => {
  it('vibre avec le motif demandé', () => {
    const vibrate = vi.fn(() => true)
    creerVibreur(() => ({ vibrate })).vibrer([100])
    expect(vibrate).toHaveBeenCalledWith([100])
  })
  it('silencieux si l’API est absente (iOS Safari) ou lève une erreur', () => {
    expect(() => creerVibreur(() => null).vibrer([100])).not.toThrow()
    expect(() => creerVibreur(() => ({ vibrate: () => { throw new Error('NotAllowed') } })).vibrer([100])).not.toThrow()
    expect(() => creerVibreur(() => { throw new Error('boum') }).vibrer([100])).not.toThrow()
  })
  it('arrêter coupe la vibration en cours', () => {
    const vibrate = vi.fn(() => true)
    creerVibreur(() => ({ vibrate })).arreter()
    expect(vibrate).toHaveBeenCalledWith(0)
  })
})

describe('creerVoix', () => {
  function faux() {
    const dits: { text: string; lang: string }[] = []
    const synth = { speak: vi.fn((u: { text: string; lang: string }) => dits.push(u)), cancel: vi.fn() }
    return { dits, synth, voix: creerVoix(() => ({ synth, enonce: (text) => ({ text, lang: '', volume: 1 }) })) }
  }
  it('dit le texte en fr-FR', () => {
    const { dits, voix } = faux()
    voix.dire('Allez !')
    expect(dits).toEqual([{ text: 'Allez !', lang: 'fr-FR', volume: 1 }])
  })
  it('préparer (geste utilisateur) amorce la synthèse avec un énoncé muet', () => {
    const { dits, voix } = faux()
    voix.preparer()
    expect(dits).toHaveLength(1)
    expect(dits[0]).toMatchObject({ text: '', volume: 0 })
  })
  it('arrêter annule les énoncés en attente', () => {
    const { synth, voix } = faux()
    voix.arreter()
    expect(synth.cancel).toHaveBeenCalled()
  })
  it('silencieux si speechSynthesis est indisponible ou échoue', () => {
    expect(() => {
      const v = creerVoix(() => null)
      v.preparer()
      v.dire('x')
      v.arreter()
    }).not.toThrow()
    const casse = creerVoix(() => ({ synth: { speak: () => { throw new Error('x') }, cancel: () => { throw new Error('x') } }, enonce: (t) => ({ text: t, lang: '', volume: 1 }) }))
    expect(() => {
      casse.dire('x')
      casse.arreter()
    }).not.toThrow()
  })
})

describe('creerRetours', () => {
  function monter(reglages: ReglagesCircuit = DEFAUTS) {
    const sonneur = { preparer: vi.fn(), jouer: vi.fn(), fermer: vi.fn() } satisfies Sonneur
    const vibreur = { vibrer: vi.fn(), arreter: vi.fn() }
    const voix = { preparer: vi.fn(), dire: vi.fn(), arreter: vi.fn() }
    const retours = creerRetours({ sonneur, vibreur, voix })
    return { sonneur, vibreur, voix, retours, reglages }
  }
  const p = plan(20, 20)
  const ctx = { termine: false, mode: 'circuit' as const }

  it('préparer initialise les trois sorties (geste utilisateur) selon les réglages', () => {
    const a = monter()
    a.retours.preparer(DEFAUTS)
    expect(a.sonneur.preparer).toHaveBeenCalled()
    expect(a.voix.preparer).not.toHaveBeenCalled() // voix désactivée par défaut
    const b = monter()
    b.retours.preparer({ ...DEFAUTS, voix: true })
    expect(b.voix.preparer).toHaveBeenCalled()
  })

  it('par défaut : bips et vibration, jamais de voix', () => {
    const { retours, sonneur, vibreur, voix } = monter()
    retours.appliquer(vue(p, 2999), vue(p, 3000), ctx, DEFAUTS)
    expect(sonneur.jouer).toHaveBeenCalledWith('depart')
    expect(vibreur.vibrer).toHaveBeenCalledWith(MOTIFS.depart)
    expect(voix.dire).not.toHaveBeenCalled()
  })

  it('vibration : court à chaque seconde des 5 dernières, long à la fin, double + long à l’entrée en repos', () => {
    const { retours, vibreur } = monter()
    retours.appliquer(vue(p, 17_000), vue(p, 18_000), ctx, DEFAUTS)
    expect(vibreur.vibrer).toHaveBeenLastCalledWith(MOTIFS.compte)
    retours.appliquer(vue(p, 22_999), vue(p, 23_000), ctx, DEFAUTS)
    expect(vibreur.vibrer).toHaveBeenLastCalledWith([...MOTIFS.fin, 100, ...MOTIFS.double])
  })

  it('fin du circuit : long puis double', () => {
    const { retours, vibreur } = monter()
    const dernier = plan(5, 5, 0)
    retours.appliquer(vue(dernier, 12_999), null, { termine: true, mode: 'circuit' }, DEFAUTS)
    expect(vibreur.vibrer).toHaveBeenLastCalledWith([...MOTIFS.fin, 100, ...MOTIFS.double])
  })

  it('réglage Son coupé : aucun bip ; Vibration coupée : aucun motif', () => {
    const { retours, sonneur, vibreur } = monter()
    retours.appliquer(vue(p, 2999), vue(p, 3000), ctx, { ...DEFAUTS, son: false, vibration: false })
    expect(sonneur.jouer).not.toHaveBeenCalled()
    expect(vibreur.vibrer).not.toHaveBeenCalled()
  })

  it('voix activée : prochain exercice au décompte, « Allez ! », repos + prochain, circuit terminé', () => {
    const { retours, voix } = monter()
    const r = { ...DEFAUTS, voix: true }
    retours.appliquer(null, vue(p, 0), ctx, r)
    expect(voix.dire).toHaveBeenLastCalledWith('Prochain exercice : Squat')
    retours.appliquer(vue(p, 2999), vue(p, 3000), ctx, r)
    expect(voix.dire).toHaveBeenLastCalledWith('Allez !')
    retours.appliquer(vue(p, 22_999), vue(p, 23_000), ctx, r)
    expect(voix.dire).toHaveBeenLastCalledWith('Repos. Prochain exercice : Gainage')
    retours.appliquer(vue(p, 52_999), null, { termine: true, mode: 'circuit' }, r)
    expect(voix.dire).toHaveBeenLastCalledWith('Circuit terminé')
  })

  it('compte à rebours parlé en option : seulement les chiffres, pas de lecture seconde par seconde ailleurs', () => {
    const { retours, voix } = monter()
    const r = { ...DEFAUTS, voix: true, voixCompte: true }
    retours.appliquer(null, vue(p, 0), ctx, r)
    retours.appliquer(vue(p, 0), vue(p, 1000), ctx, r)
    retours.appliquer(vue(p, 1000), vue(p, 2000), ctx, r)
    expect(voix.dire.mock.calls.map((c) => c[0])).toEqual(['3', '2', '1'])
    voix.dire.mockClear()
    retours.appliquer(vue(p, 5000), vue(p, 6000), ctx, r)
    retours.appliquer(vue(p, 17_000), vue(p, 18_000), ctx, r)
    expect(voix.dire).not.toHaveBeenCalled()
  })

  it('changement de côté et minuteur seul', () => {
    const { retours, voix } = monter()
    const r = { ...DEFAUTS, voix: true }
    const bil: PlanCircuit = { mode: 'circuit', reposInterSec: 10, reposFinTourSec: 10, exercices: [{ id: 'a', nom: 'Fente', toursPrevus: 1, lignes: [
      { numero: 1, libelle: '1G', cote: 'G', secondes: 5, chargeKg: null, faite: false },
      { numero: 2, libelle: '1D', cote: 'D', secondes: 5, chargeKg: null, faite: false },
    ] }] }
    retours.appliquer(vue(bil, 7999), vue(bil, 8000), ctx, r)
    expect(voix.dire).toHaveBeenLastCalledWith('Changez de côté')
    retours.appliquer(vue(bil, 17_999), null, { termine: true, mode: 'seul' }, r)
    expect(voix.dire).toHaveBeenLastCalledWith('Minuteur terminé')
  })

  it('arrêter coupe voix et vibration ; fermer libère le son', () => {
    const { retours, voix, vibreur, sonneur } = monter()
    retours.arreter()
    expect(voix.arreter).toHaveBeenCalled()
    expect(vibreur.arreter).toHaveBeenCalled()
    retours.fermer()
    expect(sonneur.fermer).toHaveBeenCalled()
  })
})
