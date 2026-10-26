import { describe, expect, it } from 'vitest'
import { aProgression, gardeSortieActive, optionsSortie, toutesSeriesValidees } from './sortie'
import type { ExerciceVue, SerieVue } from './vue'

const serie = (numero: number, terminee: boolean): SerieVue => ({
  id: `s${numero}`, numero, reps: 8, chargeKg: 50, rpe: null, updatedAt: 'u', valideeA: 'u', terminee, notes: '',
})
const exo = (nombreSeriesPrevues: number, series: SerieVue[], isBilateral = false) =>
  ({ nombreSeriesPrevues, series, isBilateral }) as unknown as ExerciceVue

describe('aProgression', () => {
  it('vrai dès qu’une série est validée', () => {
    expect(aProgression([exo(3, [serie(1, true)])])).toBe(true)
  })
  it('faux sans série, ou avec seulement des lignes non validées', () => {
    expect(aProgression([])).toBe(false)
    expect(aProgression([exo(3, [])])).toBe(false)
    expect(aProgression([exo(3, [serie(1, false)])])).toBe(false)
  })
})

describe('toutesSeriesValidees (allDone Android)', () => {
  it('vrai quand chaque exercice a toutes ses séries prévues validées', () => {
    expect(toutesSeriesValidees([exo(2, [serie(1, true), serie(2, true)])])).toBe(true)
  })
  it('faux s’il manque une série, ou si une ligne est non validée', () => {
    expect(toutesSeriesValidees([exo(2, [serie(1, true)])])).toBe(false)
    expect(toutesSeriesValidees([exo(2, [serie(1, true), serie(2, false)])])).toBe(false)
  })
  it('un exercice unilatéral compte deux lignes par série prévue', () => {
    expect(toutesSeriesValidees([exo(2, [serie(1, true), serie(2, true)], true)])).toBe(false)
    expect(toutesSeriesValidees([exo(2, [1, 2, 3, 4].map((n) => serie(n, true)), true)])).toBe(true)
  })
  it('faux sans exercice', () => {
    expect(toutesSeriesValidees([])).toBe(false)
  })
})

describe('gardeSortieActive', () => {
  const une = [exo(1, [serie(1, true)])]
  it('active tant que la séance n’est pas terminée', () => {
    expect(gardeSortieActive({ trouvee: true, terminee: false, exercices: [] })).toBe(true)
    expect(gardeSortieActive({ trouvee: true, terminee: false, exercices: [exo(3, [serie(1, true)])] })).toBe(true)
  })
  it('inactive : séance introuvable, terminée, ou toutes les séries validées (Android : isCompleted)', () => {
    expect(gardeSortieActive({ trouvee: false, terminee: false, exercices: [] })).toBe(false)
    expect(gardeSortieActive({ trouvee: true, terminee: true, exercices: [] })).toBe(false)
    expect(gardeSortieActive({ trouvee: true, terminee: false, exercices: une })).toBe(false)
  })
})

describe('optionsSortie', () => {
  it('avec progression : « Aller dans le menu » garde la séance en cours', () => {
    expect(optionsSortie(true)).toEqual({
      titre: 'Quitter la séance ?', rester: 'Rester ici', menu: 'Aller dans le menu', annuler: 'Annuler la séance',
      aide: 'Vos séries sont enregistrées : la séance reste en cours, vous pourrez la reprendre.',
    })
  })
  it('sans progression : « Quitter sans enregistrer »', () => {
    expect(optionsSortie(false)).toMatchObject({
      menu: 'Quitter sans enregistrer', aide: 'Aucune série n’est validée : la séance sera remise à zéro.',
    })
  })
})
