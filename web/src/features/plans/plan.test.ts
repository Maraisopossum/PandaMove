import { describe, expect, it } from 'vitest'
import type { SeanceCardio } from '../../core/db/repos/seancesCardio'
import programme from '../calendar/seancesCardio/programme2027.json'
import type { EntreeProgramme } from '../calendar/seancesCardio/importerProgramme2027'
import { deduirePhases, regrouperPhases } from './phases'
import type { Sortie } from '../../core/db/repos/sorties'
import { construirePlan, etatSeance, proposerRattachements, realisationJusquA, semaineCourante, semainesSousSeuil, tauxGlissant } from './plan'
import { definitionMesure, lireReglagesPlans, REGLAGES_PLANS_DEFAUT } from './reglagesPlans'

const seancesProgramme = (): SeanceCardio[] =>
  (programme as EntreeProgramme[]).map((e, i) => ({
    id: `p${i}`, genre: e.genre, date: e.date, titre: e.titre, consigne: e.consigne, detail: e.detail, optionnelle: e.optionnelle,
    jalon: e.jalon, lien: null, isValidated: false, supprimee: false, createdAt: '',
  }))

describe('deduirePhases', () => {
  it('marque l’affûtage du jalon et des semaines réduites qui le précèdent', () => {
    expect(deduirePhases([240, 240, 240, 240, 100, 90], [5])).toEqual(['pic', 'pic', 'pic', 'pic', 'affutage', 'affutage'])
  })

  it('reprend doucement après un jalon, puis revient au développement', () => {
    const p = deduirePhases([240, 250, 260, 270, 90, 150, 170, 190, 270, 280], [4])
    expect(p.slice(4, 8)).toEqual(['affutage', 'reprise', 'reprise', 'reprise'])
    expect(p[8]).toBe('developpement')
  })

  it('traite une semaine très en dessous des trois précédentes comme allégée', () => {
    const p = deduirePhases([240, 240, 240, 240, 240, 100, 240, 240], [])
    expect(p[5]).toBe('allegee')
  })

  it('ne renvoie que du développement sans jalon ni creux', () => {
    expect(deduirePhases([200, 200, 200], [])).toEqual(['developpement', 'developpement', 'developpement'])
  })

  it('un plan vide donne une liste vide', () => {
    expect(deduirePhases([], [])).toEqual([])
  })

  it('regroupe les semaines consécutives de même phase', () => {
    expect(regrouperPhases(['base', 'base', 'pic', 'base'])).toEqual([
      { phase: 'base', de: 0, a: 1 },
      { phase: 'pic', de: 2, a: 2 },
      { phase: 'base', de: 3, a: 3 },
    ])
  })
})

describe('plan du programme 2027', () => {
  const plan = construirePlan(seancesProgramme())

  it('couvre les 31 semaines et les 3 jalons', () => {
    expect(plan?.semaines).toHaveLength(31)
    expect(plan?.jalons.map((j) => [j.nom, j.semaine + 1])).toEqual([['Ravensberg', 13], ['Pi Marathon', 19], ['Lille-Hardelot', 31]])
  })

  it('déduit les phases attendues : base, affûtages avant les jalons, reprise, pic', () => {
    const phases = plan!.semaines.map((s) => s.phase)
    const blocs = regrouperPhases(phases).map((b) => `${b.phase}:${b.de + 1}-${b.a + 1}`)
    expect(blocs).toEqual([
      'base:1-4', 'developpement:5-7', 'allegee:8-8', 'developpement:9-12', 'affutage:13-13', 'developpement:14-17', 'affutage:18-19',
      'reprise:20-22', 'specifique:23-25', 'pic:26-26', 'specifique:27-27', 'pic:28-29', 'affutage:30-31',
    ])  })

  it('ignore les séances facultatives dans le volume prévu', () => {
    const avec = seancesProgramme()
    const sans = avec.filter((s) => !s.optionnelle)
    expect(sans.length).toBeLessThan(avec.length)
    const total = (p: ReturnType<typeof construirePlan>) => p!.semaines.reduce((t, s) => t + s.prevues, 0)
    expect(total(plan)).toBe(sans.length)
  })

  it('situe le 14 novembre 2026 en semaine 2', () => {
    expect(semaineCourante(plan!, '2026-11-14')).toBe(1)
    expect(semaineCourante(plan!, '2026-10-01')).toBe(-1)
    expect(semaineCourante(plan!, '2027-09-01')).toBe(31)
  })
})

const sortie = (id: string, sport: 'course' | 'velo', date: string, dureeMin: number | null, seanceId: string | null = null): Sortie =>
  ({ id, sport, date, titre: 'Sortie', dureeS: dureeMin === null ? null : dureeMin * 60, seanceId }) as Sortie

const seance = (id: string, genre: 'course' | 'velo', date: string, detail: string, extra: Partial<SeanceCardio> = {}): SeanceCardio =>
  ({ id, genre, date, titre: `Séance ${id}`, consigne: null, detail, optionnelle: false, jalon: null, lien: null, isValidated: false, supprimee: false, createdAt: '', ...extra })

describe('état des séances', () => {
  const o = { aujourdhui: '2026-11-14' }
  it('faite quand validée sans sortie, ou avec une sortie assez longue', () => {
    expect(etatSeance(seance('a', 'course', '2026-11-10', '60 min', { isValidated: true }), null, o)).toBe('faite')
    expect(etatSeance(seance('a', 'course', '2026-11-10', '60 min', { isValidated: true }), sortie('s', 'course', '2026-11-10', 50, 'a'), o)).toBe('faite')
  })

  it('faite autrement quand la sortie est sous le seuil de durée réglé', () => {
    const s = seance('a', 'course', '2026-11-10', '60 min', { isValidated: true })
    expect(etatSeance(s, sortie('s', 'course', '2026-11-10', 40, 'a'), o)).toBe('autrement')
    expect(etatSeance(s, sortie('s', 'course', '2026-11-10', 40, 'a'), { ...o, dureeMinPct: 60 })).toBe('faite')
  })

  it('manquée seulement quand le jour est passé ; facultative jamais manquée ; la séance du jour est à venir', () => {
    expect(etatSeance(seance('a', 'course', '2026-11-10', '60 min'), null, o)).toBe('manquee')
    expect(etatSeance(seance('a', 'course', '2026-11-14', '60 min'), null, o)).toBe('aVenir')
    expect(etatSeance(seance('a', 'course', '2026-11-10', '60 min', { optionnelle: true }), null, o)).toBe('facultative')
    expect(etatSeance(seance('a', 'course', '2026-11-10', '60 min'), null, {})).toBe('aVenir')
  })
})

describe('réalisation', () => {
  const o = { aujourdhui: '2026-11-14' }
  const base = () => [
    seance('a', 'course', '2026-11-10', '60 min', { isValidated: true }),
    seance('b', 'velo', '2026-11-11', '60 min', { isValidated: true }),
    seance('c', 'course', '2026-11-12', '60 min'),
    seance('d', 'course', '2026-11-13', '60 min', { optionnelle: true }),
    seance('e', 'course', '2026-11-20', '60 min'),
  ]

  it('compte les séances échues : faite = 1, manquée = 0, facultative et à venir ignorées', () => {
    const plan = construirePlan(base(), [], o)!
    const r = realisationJusquA(plan, 0, 'seances')
    expect(r.prevues).toBe(3)
    expect(r.faites).toBe(2)
    expect(r.tauxPct).toBe(67)
    expect(realisationJusquA(plan, 0, 'duree').tauxPct).toBe(67)
    expect(realisationJusquA(plan, 0, 'les-deux').tauxPct).toBe(67)
  })

  it('compte une séance faite autrement pour la part réglée', () => {
    const s = base()
    s[0] = { ...s[0] }
    const plan = construirePlan(s, [sortie('x', 'course', '2026-11-10', 20, 'a')], { ...o, autrementPct: 50 })!
    expect(realisationJusquA(plan, 0, 'seances').faites).toBe(1.5)
    expect(realisationJusquA(plan, 0, 'duree').tauxPct).toBe(Math.round(((20 + 60) / 180) * 100))
  })

  it('renvoie null sans séance échue', () => {
    const plan = construirePlan([seance('e', 'course', '2026-11-20', '60 min')], [], o)!
    expect(realisationJusquA(plan, 0, 'seances').tauxPct).toBeNull()
  })

  it('un plan sans séance n’existe pas', () => {
    expect(construirePlan([])).toBeNull()
  })

  it('taux glissant et semaines de suite sous le seuil', () => {
    const s = [
      seance('a', 'course', '2026-11-02', '60 min', { isValidated: true }),
      seance('b', 'course', '2026-11-09', '60 min'),
      seance('c', 'course', '2026-11-16', '60 min'),
      seance('d', 'course', '2026-11-23', '60 min'),
      seance('e', 'course', '2026-11-30', '60 min'),
    ]
    const plan = construirePlan(s, [], { aujourdhui: '2026-12-02' })!
    expect(tauxGlissant(plan, 4, 'seances').map((x) => x.tauxPct)).toEqual([100, 50, 33, 25, 0])
    expect(semainesSousSeuil(plan, 4, 'seances', 70)).toBe(4)
    expect(semainesSousSeuil(plan, 0, 'seances', 70)).toBe(0)
  })
})

describe('propositions de rattachement', () => {
  const o = { aujourdhui: '2026-11-14' }
  it('propose la séance non faite du même sport, du même jour, et une seule fois par séance', () => {
    const plan = construirePlan([seance('c', 'course', '2026-11-12', '45 min'), seance('v', 'velo', '2026-11-12', '60 min')], [], o)!
    const prop = proposerRattachements(plan.semaines[0], [sortie('s1', 'course', '2026-11-12', 40), sortie('s2', 'course', '2026-11-12', 42)])
    expect(prop.map((x) => [x.sortie.id, x.seance.id])).toEqual([['s1', 'c']])
  })

  it('ne propose rien pour une sortie déjà rattachée, trop éloignée ou d’un autre sport', () => {
    const plan = construirePlan([seance('c', 'course', '2026-11-12', '45 min')], [], o)!
    expect(proposerRattachements(plan.semaines[0], [sortie('s1', 'course', '2026-11-12', 40, 'z')])).toEqual([])
    expect(proposerRattachements(plan.semaines[0], [sortie('s1', 'course', '2026-11-15', 40)])).toEqual([])
    expect(proposerRattachements(plan.semaines[0], [sortie('s1', 'velo', '2026-11-12', 40)])).toEqual([])
  })
})

describe('réglages des plans', () => {
  it('retombent sur les valeurs par défaut quand tout est absent ou illisible', () => {
    expect(lireReglagesPlans(null)).toEqual(REGLAGES_PLANS_DEFAUT)
    expect(lireReglagesPlans('pas du json')).toEqual(REGLAGES_PLANS_DEFAUT)
    expect(lireReglagesPlans('[1]')).toEqual(REGLAGES_PLANS_DEFAUT)
  })

  it('garde les valeurs valides, borne les autres et garde le seuil à surveiller sous le seuil bon', () => {
    const r = lireReglagesPlans(JSON.stringify({ mesure: 'duree', dureeMinPct: 500, seuilBonPct: 60, seuilSurveillerPct: 90, phasesAuto: false, autrementPct: 'x' }))
    expect(r.mesure).toBe('duree')
    expect(r.dureeMinPct).toBe(100)
    expect(r.seuilBonPct).toBe(60)
    expect(r.seuilSurveillerPct).toBe(60)
    expect(r.phasesAuto).toBe(false)
    expect(r.autrementPct).toBe(50)
  })

  it('décrit la mesure retenue', () => {
    expect(definitionMesure('seances')).toBe('séances faites ÷ séances prévues')
  })
})

describe('rattachements implicites', () => {
  it('une sortie ajoutée à la main compte pour la séance du même sport du même jour (taux de réalisation à 100 %)', () => {
    const seances = [seance('a', 'course', '2026-11-10', '60 min'), seance('b', 'course', '2026-11-12', '45 min')]
    const sorties = [sortie('s1', 'course', '2026-11-10', 60), sortie('s2', 'course', '2026-11-12', 45)]
    const plan = construirePlan(seances, sorties, { aujourdhui: '2026-11-15', rattachementAuto: true })!
    expect(plan.semaines[0].seances.map((s) => s.etat)).toEqual(['faite', 'faite'])
    expect(realisationJusquA(plan, 0, 'seances').tauxPct).toBe(100)
  })

  it('ne rattache ni un autre sport, ni une sortie à plus d’un jour, ni deux sorties à la même séance', () => {
    const seances = [seance('a', 'course', '2026-11-10', '60 min')]
    const plan = construirePlan(seances, [sortie('v', 'velo', '2026-11-10', 60), sortie('l', 'course', '2026-11-13', 60)], { aujourdhui: '2026-11-15', rattachementAuto: true })!
    expect(plan.semaines[0].seances[0].etat).toBe('manquee')
    const deux = construirePlan(seances, [sortie('x', 'course', '2026-11-10', 60), sortie('y', 'course', '2026-11-10', 30)], { aujourdhui: '2026-11-15', rattachementAuto: true })!
    expect(deux.semaines[0].seances[0].sortieId).toBe('x')
  })
})

it('sans le réglage, une sortie manuelle ne compte pas pour la séance', () => {
  const plan = construirePlan([seance('a', 'course', '2026-11-10', '60 min')], [sortie('s1', 'course', '2026-11-10', 60)], { aujourdhui: '2026-11-15' })!
  expect(plan.semaines[0].seances[0].etat).toBe('manquee')
})
