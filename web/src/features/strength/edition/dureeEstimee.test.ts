import { describe, expect, it } from 'vitest'
import { brouillonVide, nouveauBloc, nouvelExercice, type BlocDraft, type ExerciceDraft, type ItemDraft, type SeanceDraft } from '../draft'
import { detailDuree, dureeEstimeeMin, dureeEstimeeSec, dureeSerieSec, libelleDuree, libelleSecondes, repsVisees } from './dureeEstimee'

const exo = (id: string, patch: Partial<ExerciceDraft> = {}): ExerciceDraft => ({
  ...nouvelExercice(id, { id, name: id, muscles: [], equipment: [], isBodyweight: false }, null),
  nombreSeriesPrevues: 3, repsCibles: '10', tempsReposSec: 90, ...patch,
})
const libre = (e: ExerciceDraft): ItemDraft => ({ kind: 'libre', exercice: e })
const bloc = (type: BlocDraft['type'], exercices: ExerciceDraft[], patch: Partial<BlocDraft> = {}): ItemDraft => ({
  kind: 'bloc', bloc: { ...nouveauBloc(`b-${type}`, type), exercices, ...patch },
})
const seance = (...items: ItemDraft[]): SeanceDraft => ({ ...brouillonVide('s'), items })

describe('repsVisees', () => {
  it('premier nombre, milieu d’une plage, null si illisible', () => {
    expect(repsVisees('12')).toBe(12)
    expect(repsVisees('8-12')).toBe(10)
    expect(repsVisees('8 à 12')).toBe(10)
    expect(repsVisees('30-45')).toBe(37.5)
    expect(repsVisees('45s')).toBe(45)
    expect(repsVisees('')).toBeNull()
    expect(repsVisees('max')).toBeNull()
    expect(repsVisees('0')).toBeNull()
  })
})

describe('dureeSerieSec', () => {
  it('répétitions : reps × 3 s, minimum 20 s', () => {
    expect(dureeSerieSec(exo('a', { repsCibles: '10' }))).toBe(30)
    expect(dureeSerieSec(exo('a', { repsCibles: '5' }))).toBe(20)
  })
  it('plage de répétitions : milieu', () => {
    expect(dureeSerieSec(exo('a', { repsCibles: '8-12' }))).toBe(30)
  })
  it('repsCibles vide : 10 répétitions', () => {
    expect(dureeSerieSec(exo('a', { repsCibles: '' }))).toBe(30)
  })
  it('tempo : somme des chiffres par répétition', () => {
    expect(dureeSerieSec(exo('a', { repsCibles: '10', tempo: '3-1-1' }))).toBe(50)
    expect(dureeSerieSec(exo('a', { repsCibles: '10', tempo: 'abc' }))).toBe(30)
  })
  it('exercice en durée : la durée cible telle quelle (plage = moyenne, « 45s » accepté)', () => {
    expect(dureeSerieSec(exo('a', { repsType: 'DURATION', repsCibles: '45' }))).toBe(45)
    expect(dureeSerieSec(exo('a', { repsType: 'DURATION', repsCibles: '45s' }))).toBe(45)
    expect(dureeSerieSec(exo('a', { repsType: 'DURATION', repsCibles: '30-45' }))).toBe(37.5)
    expect(dureeSerieSec(exo('a', { repsType: 'DURATION', repsCibles: '' }))).toBe(30)
  })
  it('bilatéral : doublé', () => {
    expect(dureeSerieSec(exo('a', { isBilateral: true }))).toBe(60)
    expect(dureeSerieSec(exo('a', { repsType: 'DURATION', repsCibles: '30', isBilateral: true }))).toBe(60)
  })
})

describe('dureeEstimeeSec / dureeEstimeeMin', () => {
  it('séance vide : 0', () => {
    expect(dureeEstimeeSec(seance())).toBe(0)
    expect(dureeEstimeeMin(seance())).toBe(0)
    expect(dureeEstimeeMin(seance(bloc('SUPERSET', [])))).toBe(0)
  })

  it('séance simple : 3 × 10 reps, repos 90 s = 3 × (30 + 90) = 6 min', () => {
    const s = seance(libre(exo('a')))
    expect(dureeEstimeeSec(s)).toBe(360)
    expect(dureeEstimeeMin(s)).toBe(6)
  })

  it('arrondi à la minute supérieure', () => {
    // 3 × (20 + 90) = 330 s = 5,5 min
    expect(dureeEstimeeMin(seance(libre(exo('a', { repsCibles: '5' }))))).toBe(6)
  })

  it('plage de répétitions : même durée que le milieu', () => {
    expect(dureeEstimeeSec(seance(libre(exo('a', { repsCibles: '8-12' }))))).toBe(360)
  })

  it('exercice en durée : 3 × (45 + 90) = 405 s = 7 min', () => {
    const s = seance(libre(exo('a', { repsType: 'DURATION', repsCibles: '45s' })))
    expect(dureeEstimeeSec(s)).toBe(405)
    expect(dureeEstimeeMin(s)).toBe(7)
  })

  it('bilatéral : 3 × (60 + 90) = 450 s = 8 min', () => {
    expect(dureeEstimeeMin(seance(libre(exo('a', { isBilateral: true }))))).toBe(8)
  })

  it('deux exercices libres : transition de 30 s entre eux', () => {
    const s = seance(libre(exo('a')), libre(exo('b')))
    expect(dureeEstimeeSec(s)).toBe(360 + 30 + 360)
    expect(dureeEstimeeMin(s)).toBe(13)
  })

  it('superset : repos inter entre exercices d’un tour, repos de fin à chaque tour', () => {
    // tour = 30 + 20 + 30 ; + fin de tour 120 ; × 3 tours = 600 s
    const s = seance(bloc('SUPERSET', [exo('a'), exo('b')], { tempsReposInterSec: 20, tempsReposFinRoundSec: 120 }))
    expect(dureeEstimeeSec(s)).toBe(600)
    expect(dureeEstimeeMin(s)).toBe(10)
  })

  it('superset : le repos propre de l’exercice est remplacé par ceux du bloc', () => {
    const a = dureeEstimeeSec(seance(bloc('SUPERSET', [exo('a', { tempsReposSec: 0 }), exo('b', { tempsReposSec: 600 })])))
    const b = dureeEstimeeSec(seance(bloc('SUPERSET', [exo('a'), exo('b')])))
    expect(a).toBe(b)
  })

  it('superset à séries inégales : le dernier tour ne contient que l’exercice restant', () => {
    // tours 1-2 : 30 + 20 + 30 + 120 = 200 ; tour 3 : 30 + 120 = 150
    const s = seance(bloc('SUPERSET', [exo('a', { nombreSeriesPrevues: 3 }), exo('b', { nombreSeriesPrevues: 2 })], { tempsReposInterSec: 20, tempsReposFinRoundSec: 120 }))
    expect(dureeEstimeeSec(s)).toBe(550)
  })

  it('circuit : tours × (somme des durées + repos inter) + repos de fin de tour', () => {
    // 3 exos de 40 s, inter 20 s (2 intervalles), fin 120 s : (120 + 40 + 120) × 3 tours = 840 s
    const exos = ['a', 'b', 'c'].map((id) => exo(id, { repsType: 'DURATION', repsCibles: '40' }))
    const s = seance(bloc('CIRCUIT', exos, { nombreSeriesPrevues: 3, tempsReposInterSec: 20, tempsReposFinRoundSec: 120 }))
    expect(dureeEstimeeSec(s)).toBe(840)
    expect(dureeEstimeeMin(s)).toBe(14)
  })

  it('bloc Échauffement : exercices à la suite ; sa durée saisie l’emporte', () => {
    expect(dureeEstimeeSec(seance(bloc('ECHAUFFEMENT', [exo('a'), exo('b')])))).toBe(360 + 30 + 360)
    expect(dureeEstimeeSec(seance(bloc('ECHAUFFEMENT', [exo('a')], { dureeMin: 10 })))).toBe(600)
  })

  it('exercice libre + bloc : une transition entre les deux', () => {
    const s = seance(libre(exo('a')), bloc('SUPERSET', [exo('b'), exo('c')], { tempsReposInterSec: 20, tempsReposFinRoundSec: 120 }))
    expect(dureeEstimeeSec(s)).toBe(360 + 30 + 600)
    expect(dureeEstimeeMin(s)).toBe(17)
  })
})

describe('detailDuree', () => {
  it('une ligne par exercice ou bloc, et le total des transitions', () => {
    const d = detailDuree(seance(libre(exo('a')), bloc('SUPERSET', [exo('b'), exo('c')], { tempsReposInterSec: 20, tempsReposFinRoundSec: 120 })))
    expect(d.lignes.map((l) => [l.libelle, l.sec])).toEqual([['a', 360], ['Superset', 600]])
    expect(d.transitionsSec).toBe(30)
    expect(d.totalSec).toBe(990)
  })
})

describe('libellés', () => {
  it('durée en minutes ou « — » pour une séance vide', () => {
    expect(libelleDuree(52)).toBe('≈ 52 min')
    expect(libelleDuree(0)).toBe('—')
  })
  it('lignes du détail', () => {
    expect(libelleSecondes(30)).toBe('30 s')
    expect(libelleSecondes(360)).toBe('6 min')
    expect(libelleSecondes(75)).toBe('1 min')
  })
})
