import { describe, expect, it } from 'vitest'
import type { SeanceCardio } from '../../core/db/repos/seancesCardio'
import programme from '../calendar/seancesCardio/programme2027.json'
import type { EntreeProgramme } from '../calendar/seancesCardio/importerProgramme2027'
import { deduirePhases, regrouperPhases } from './phases'
import { construirePlan, realisationJusquA, semaineCourante } from './plan'
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

describe('réalisation', () => {
  it('calcule le taux selon la mesure choisie', () => {
    const s = seancesProgramme()
    const premiereSemaine = s.filter((x) => x.date < '2026-11-09' && !x.optionnelle)
    premiereSemaine.forEach((x) => (x.isValidated = true))
    const plan = construirePlan(s)!
    expect(realisationJusquA(plan, 0, 'seances').tauxPct).toBe(100)
    expect(realisationJusquA(plan, 1, 'seances').tauxPct).toBeLessThan(100)
    expect(realisationJusquA(plan, 0, 'duree').tauxPct).toBe(100)
    expect(realisationJusquA(plan, 0, 'les-deux').tauxPct).toBe(100)
  })

  it('renvoie null sans séance prévue', () => {
    const plan = construirePlan(seancesProgramme())!
    expect(realisationJusquA({ ...plan, semaines: [{ ...plan.semaines[0], prevues: 0, prevuMin: 0, faites: 0, realiseMin: 0 }] }, 0, 'seances').tauxPct).toBeNull()
  })

  it('un plan sans séance n’existe pas', () => {
    expect(construirePlan([])).toBeNull()
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
