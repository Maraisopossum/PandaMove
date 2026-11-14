import { describe, expect, it } from 'vitest'
import { bilanSemaine, methodePreferee, minutesParSemaine, momentDe, serieDeJours, statsPeriode, usage30Jours } from './statsRespiration'

// Heure locale : « 2026-11-12T09:30:00 » sans décalage est interprétée par new Date en heure locale, mais l'horodatage de la base
// est en UTC ; on construit donc l'instant à partir de l'heure locale voulue.
const instant = (jour: string, heure: number, minute = 0) => {
  const [a, m, j] = jour.split('-').map(Number)
  return new Date(a, m - 1, j, heure, minute).toISOString()
}

const s = (date: string, dureeSec: number, methodeId = 'coherence', heure = 8, nom = methodeId) => ({
  date, dureeSec, methodeId, methodeNom: nom, creeLe: instant(date, heure),
})

describe('momentDe', () => {
  it.each([
    [4, 'nuit'], [5, 'matin'], [10, 'matin'], [11, 'midi'], [13, 'midi'], [14, 'soir'], [20, 'soir'], [21, 'nuit'], [23, 'nuit'],
  ])('%i h -> %s', (h, moment) => expect(momentDe(instant('2026-11-12', h, 30))).toBe(moment))

  it('horodatage absent ou illisible : null ; format Postgres accepté', () => {
    expect(momentDe('')).toBeNull()
    expect(momentDe('pas une date')).toBeNull()
    expect(momentDe('2026-11-12 08:00:00.123456+00')).not.toBeNull()
  })
})

describe('bilan de la semaine', () => {
  // Jeudi 12 novembre 2026 ; objectif de 5 minutes par jour
  const AUJ = '2026-11-12'
  const seances = [
    s('2026-11-09', 300), s('2026-11-10', 180), s('2026-11-11', 330), s('2026-11-11', 120),
    s('2026-11-02', 600), s('2026-11-05', 200), s('2026-11-06', 900),
  ]

  it('états des jours : atteint, partiel, vide, aujourd’hui, à venir', () => {
    const b = bilanSemaine(seances, AUJ, 5)
    expect(b.jours.map((j) => j.etat)).toEqual(['atteint', 'partiel', 'atteint', 'aujourdhui', 'avenir', 'avenir', 'avenir'])
    expect(b.jours.map((j) => j.minutes)).toEqual([5, 3, 8, 0, 0, 0, 0]) // le 11 : 330 + 120 s = 7,5 min, arrondi à 8
    expect(b.joursAtteints).toBe(2)
  })

  it('un jour passé sans séance est « vide » ; objectif plus haut : moins de jours atteints', () => {
    const b = bilanSemaine([s('2026-11-11', 300)], AUJ, 5)
    expect(b.jours.map((j) => j.etat).slice(0, 3)).toEqual(['vide', 'vide', 'atteint'])
    expect(bilanSemaine(seances, AUJ, 10).joursAtteints).toBe(0)
  })

  it('totaux de la semaine et du même point de la précédente (lundi à jeudi, pas la semaine pleine)', () => {
    const b = bilanSemaine(seances, AUJ, 5)
    expect([b.secondes, b.seances]).toEqual([300 + 180 + 330 + 120, 4])
    // Semaine du 2 au 5 novembre : le 6 novembre (vendredi) est après le point de comparaison
    expect([b.secondesPrecedentes, b.seancesPrecedentes]).toEqual([800, 2])
  })
})

describe('jours de suite', () => {
  it('jusqu’à aujourd’hui, ou jusqu’à hier s’il n’est pas encore fait', () => {
    expect(serieDeJours([s('2026-11-12', 300), s('2026-11-11', 300), s('2026-11-10', 300)], '2026-11-12')).toBe(3)
    expect(serieDeJours([s('2026-11-11', 300), s('2026-11-10', 300)], '2026-11-12')).toBe(2)
    expect(serieDeJours([s('2026-11-09', 300)], '2026-11-12')).toBe(0)
    expect(serieDeJours([], '2026-11-12')).toBe(0)
  })
})

describe('usage des méthodes', () => {
  const AUJ = '2026-11-12'
  const seances = [
    ...Array.from({ length: 5 }, (_, i) => s(`2026-11-0${i + 1}`, 300, 'coherence')),
    s('2026-11-10', 300, 'box'), s('2026-11-11', 300, 'box'), s('2026-10-01', 300, 'box'), // la dernière est hors des 30 jours
  ]

  it('séances par méthode sur 30 jours, aujourd’hui compris', () => {
    const u = usage30Jours(seances, AUJ)
    expect([u.get('coherence'), u.get('box')]).toEqual([5, 2])
    expect(usage30Jours([s('2026-10-14', 300, 'x'), s('2026-10-13', 300, 'x')], AUJ).get('x')).toBe(1) // le 13 octobre est le 31e jour
  })

  it('préférée : la plus pratiquée, trois séances au moins', () => {
    expect(methodePreferee(seances, AUJ)).toEqual({ methodeId: 'coherence', nombre: 5 })
    expect(methodePreferee([s('2026-11-10', 300, 'box'), s('2026-11-11', 300, 'box')], AUJ)).toBeNull()
    expect(methodePreferee([], AUJ)).toBeNull()
  })

  it('à égalité, la plus récemment pratiquée', () => {
    const egal = [s('2026-11-01', 300, 'a'), s('2026-11-02', 300, 'a'), s('2026-11-03', 300, 'a'), s('2026-11-05', 300, 'b'), s('2026-11-06', 300, 'b'), s('2026-11-07', 300, 'b')]
    expect(methodePreferee(egal, AUJ)!.methodeId).toBe('b')
  })
})

describe('statistiques de période', () => {
  const MAINT = new Date(2026, 10, 12, 12, 0)
  const seances = [
    s('2026-11-10', 300, 'coherence', 8, 'Cohérence cardiaque'),
    s('2026-11-11', 600, 'coherence', 12, 'Cohérence cardiaque'),
    s('2026-11-12', 240, '4_7_8', 22, '4-7-8'),
    s('2026-10-20', 300, 'coherence', 19, 'Cohérence cardiaque'),
    s('2026-10-22', 300, 'coherence', 7, 'Cohérence cardiaque'),
    s('2026-09-01', 900, '4_7_8', 3, '4-7-8'), // avant la période précédente
  ]

  it('un mois : totaux, moyenne, jours, plus longue série, moments et méthodes', () => {
    const st = statsPeriode(seances, '30j', MAINT)
    expect(st.secondes).toBe(300 + 600 + 240 + 300 + 300)
    expect(st.nombre).toBe(5)
    expect(st.jours).toBe(5)
    expect(st.moyenneSec).toBeCloseTo(348, 5)
    expect(st.plusLongueSerie).toBe(3) // 10, 11 et 12 novembre
    expect(st.moments).toEqual({ matin: 2, midi: 1, soir: 1, nuit: 1 })
    expect(st.methodes.map((m) => [m.nom, m.nombre, m.secondes])).toEqual([['Cohérence cardiaque', 4, 1500], ['4-7-8', 1, 240]])
  })

  it('période précédente de même durée ; « Tout » n’en a pas', () => {
    expect(statsPeriode(seances, '30j', MAINT).secondesPrecedentes).toBe(0) // 11 sept. au 11 oct. : rien (la séance du 1er sept. est plus ancienne)
    expect(statsPeriode(seances, 'tout', MAINT).secondesPrecedentes).toBeNull()
    expect(statsPeriode(seances, 'tout', MAINT).nombre).toBe(6)
  })

  it('sans séance : zéros, jamais de division par zéro', () => {
    const st = statsPeriode([], '30j', MAINT)
    expect(st).toMatchObject({ secondes: 0, nombre: 0, jours: 0, moyenneSec: 0, plusLongueSerie: 0, methodes: [] })
  })

  it('un nom de méthode renommée : le plus récent est retenu', () => {
    const st = statsPeriode([s('2026-11-01', 300, 'perso', 8, 'Ancien nom'), s('2026-11-05', 300, 'perso', 8, 'Nouveau nom')], '30j', MAINT)
    expect(st.methodes).toEqual([{ methodeId: 'perso', nom: 'Nouveau nom', nombre: 2, secondes: 600 }])
  })
})

describe('minutes par semaine', () => {
  it('quatre semaines du lundi au dimanche, la dernière en cours', () => {
    const w = minutesParSemaine([s('2026-10-20', 600), s('2026-10-28', 300), s('2026-11-03', 300), s('2026-11-10', 420), s('2026-11-11', 60)], '2026-11-12', 4)
    expect(w.map((x) => x.debut)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'])
    expect(w.map((x) => x.secondes)).toEqual([600, 300, 300, 480])
    expect(w.map((x) => x.courante)).toEqual([false, false, false, true])
  })
})
