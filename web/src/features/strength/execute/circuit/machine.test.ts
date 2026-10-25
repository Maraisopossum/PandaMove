import { describe, expect, it } from 'vitest'
import {
  affichage, arreter, avancer, demarrer, PAUSE_COTE_SEC,
  type EtatCircuit, type ExercicePlan, type PlanCircuit,
} from './machine'

const exo = (id: string, tours: number, secondes: number, o: { bilateral?: boolean; faites?: number[] } = {}): ExercicePlan => {
  const n = tours * (o.bilateral ? 2 : 1)
  return {
    id, nom: 'Nom ' + id, toursPrevus: tours,
    lignes: Array.from({ length: n }, (_, i) => ({
      numero: i + 1, libelle: String(i + 1), cote: o.bilateral ? (i % 2 === 0 ? 'G' : 'D') : '', secondes, chargeKg: null, faite: (o.faites ?? []).includes(i + 1),
    })),
  }
}
const circuit = (exercices: ExercicePlan[], inter = 20, fin = 120): PlanCircuit => ({ mode: 'circuit', exercices, reposInterSec: inter, reposFinTourSec: fin })
const T0 = 1_000_000

// Fait avancer l'horloge pas à pas (1 s) et collecte les effets
function derouler(etat: EtatCircuit, depuis: number, jusqua: number) {
  const effets: ReturnType<typeof avancer>['effets'] = []
  let e = etat
  for (let t = depuis; t <= jusqua; t += 1000) {
    const r = avancer(e, t)
    e = r.etat
    effets.push(...r.effets)
  }
  return { etat: e, effets }
}
const valide = (exerciceId: string, numero: number, secondes: number, cote = '') => ({ type: 'valider', exerciceId, numero, secondes, cote, chargeKg: null })

describe('décompte 3-2-1', () => {
  it('affiche 3, 2, 1 puis passe à l’exercice, sans rien valider', () => {
    let e = demarrer(circuit([exo('a', 1, 30)]), { exIdx: 0, numero: 1 }, T0)
    expect(affichage(e, T0)).toMatchObject({ phase: 'decompte', restantSec: 3, nomExercice: 'Nom a' })
    expect(affichage(e, T0 + 1000)?.restantSec).toBe(2)
    expect(affichage(e, T0 + 2999)?.restantSec).toBe(1)
    const r = avancer(e, T0 + 2999)
    expect(r.effets).toEqual([])
    expect(affichage(r.etat, T0 + 2999)?.phase).toBe('decompte')
    e = avancer(e, T0 + 3000).etat
    expect(affichage(e, T0 + 3000)).toMatchObject({ phase: 'actif', restantSec: 30 })
  })
})

describe('exercice actif', () => {
  it('le temps restant est recalculé depuis l’heure de début (arrondi au-dessus)', () => {
    const e = avancer(demarrer(circuit([exo('a', 1, 30)]), { exIdx: 0, numero: 1 }, T0), T0 + 3000).etat
    expect(affichage(e, T0 + 3000)?.restantSec).toBe(30)
    expect(affichage(e, T0 + 3001)?.restantSec).toBe(30)
    expect(affichage(e, T0 + 4000)?.restantSec).toBe(29)
    expect(affichage(e, T0 + 32_999)?.restantSec).toBe(1)
  })
  it('niveau d’alerte : normal > 10 s, attention de 10 à 4 s, urgent à 3 s et moins', () => {
    const e = avancer(demarrer(circuit([exo('a', 1, 30)]), { exIdx: 0, numero: 1 }, T0), T0 + 3000).etat
    expect(affichage(e, T0 + 3000 + 19_000)?.niveau).toBe('normal') // 11 s
    expect(affichage(e, T0 + 3000 + 20_000)?.niveau).toBe('attention') // 10 s
    expect(affichage(e, T0 + 3000 + 26_000)?.niveau).toBe('attention') // 4 s
    expect(affichage(e, T0 + 3000 + 27_000)?.niveau).toBe('urgent') // 3 s
  })
  it('à la fin du minuteur : une seule validation avec la durée, puis repos', () => {
    const e = demarrer(circuit([exo('a', 1, 30), exo('b', 1, 30)]), { exIdx: 0, numero: 1 }, T0)
    const r = avancer(e, T0 + 3000 + 30_000)
    expect(r.effets).toEqual([valide('a', 1, 30)])
    expect(affichage(r.etat, T0 + 33_000)).toMatchObject({ phase: 'repos', restantSec: 20, repos: { nature: 'inter', prochain: 'Nom b' } })
    // rappeler au même instant ne revalide pas
    expect(avancer(r.etat, T0 + 33_000).effets).toEqual([])
  })
})

describe('enchaînement', () => {
  it('2 exercices x 2 tours : repos inter, repos de fin de tour, puis fin sans repos', () => {
    const plan = circuit([exo('a', 2, 10), exo('b', 2, 10)], 5, 8)
    const { etat, effets } = derouler(demarrer(plan, { exIdx: 0, numero: 1 }, T0), T0, T0 + 200_000)
    expect(effets.map((x) => [x.exerciceId, x.numero])).toEqual([['a', 1], ['b', 1], ['a', 2], ['b', 2]])
    expect(etat).toMatchObject({ phase: 'inactif', fin: 'terminee' })
  })
  it('horodatage : exercice 3 s + 10 s, repos 5 s, exercice suivant sans nouveau décompte', () => {
    const plan = circuit([exo('a', 1, 10), exo('b', 1, 10)], 5, 8)
    let e = demarrer(plan, { exIdx: 0, numero: 1 }, T0)
    e = avancer(e, T0 + 13_000).etat // fin de a
    expect(affichage(e, T0 + 13_000)).toMatchObject({ phase: 'repos', restantSec: 5 })
    e = avancer(e, T0 + 18_000).etat // fin du repos
    expect(affichage(e, T0 + 18_000)).toMatchObject({ phase: 'actif', nomExercice: 'Nom b', restantSec: 10, position: { rang: 2, total: 2 } })
  })
  it('repos de fin de tour entre le dernier exercice et le premier du tour suivant', () => {
    const plan = circuit([exo('a', 2, 10), exo('b', 2, 10)], 5, 8)
    let e = demarrer(plan, { exIdx: 0, numero: 1 }, T0)
    e = derouler(e, T0, T0 + 3000 + 10_000 + 5000 + 10_000).etat // fin de b (tour 1)
    expect(affichage(e, T0 + 28_000)).toMatchObject({ phase: 'repos', restantSec: 8, repos: { nature: 'fin-tour', prochain: 'Nom a' } })
  })
  it('repos de 0 s : enchaînement immédiat', () => {
    const plan = circuit([exo('a', 1, 10), exo('b', 1, 10)], 0, 0)
    const r = avancer(demarrer(plan, { exIdx: 0, numero: 1 }, T0), T0 + 13_000)
    expect(affichage(r.etat, T0 + 13_000)).toMatchObject({ phase: 'actif', nomExercice: 'Nom b', restantSec: 10 })
  })
  it('tours inégaux : l’exercice qui reste enchaîne seul, avec un repos de fin de tour', () => {
    const plan = circuit([exo('a', 3, 10), exo('b', 2, 10)], 5, 8)
    const { etat, effets } = derouler(demarrer(plan, { exIdx: 0, numero: 1 }, T0), T0, T0 + 300_000)
    expect(effets.map((x) => `${x.exerciceId}${x.numero}`)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3'])
    expect(etat).toMatchObject({ phase: 'inactif', fin: 'terminee' })
  })
  it('numéro de série, total et position affichés', () => {
    const plan = circuit([exo('a', 3, 10), exo('b', 3, 10)])
    const e = avancer(demarrer(plan, { exIdx: 1, numero: 2 }, T0), T0 + 3000).etat
    expect(affichage(e, T0 + 3000)).toMatchObject({ serie: { numero: 2, total: 3, cote: '' }, position: { rang: 2, total: 2 } })
  })
  it('reprise : les lignes déjà faites sont sautées', () => {
    const plan = circuit([exo('a', 2, 10, { faites: [1] }), exo('b', 2, 10, { faites: [1, 2] })], 5, 8)
    const { etat, effets } = derouler(demarrer(plan, { exIdx: 0, numero: 2 }, T0), T0, T0 + 100_000)
    expect(effets.map((x) => `${x.exerciceId}${x.numero}`)).toEqual(['a2'])
    expect(etat).toMatchObject({ phase: 'inactif', fin: 'terminee' })
  })
})

describe('bilatéral', () => {
  it('côté G puis pause de changement de côté puis côté D, sans repos entre les deux', () => {
    const plan = circuit([exo('a', 1, 10, { bilateral: true }), exo('b', 1, 10)], 20, 120)
    let e = demarrer(plan, { exIdx: 0, numero: 1 }, T0)
    expect(affichage(avancer(e, T0 + 3000).etat, T0 + 3000)?.serie).toEqual({ numero: 1, total: 1, cote: 'G' })
    const r = avancer(e, T0 + 13_000)
    expect(r.effets).toEqual([valide('a', 1, 10, 'G')])
    expect(affichage(r.etat, T0 + 13_000)).toMatchObject({ phase: 'repos', restantSec: PAUSE_COTE_SEC, repos: { nature: 'cote', prochain: 'Nom a — côté D' } })
    e = avancer(r.etat, T0 + 13_000 + PAUSE_COTE_SEC * 1000).etat
    expect(affichage(e, T0 + 18_000)).toMatchObject({ phase: 'actif', serie: { numero: 1, total: 1, cote: 'D' } })
    const fin = avancer(e, T0 + 28_000)
    expect(fin.effets).toEqual([valide('a', 2, 10, 'D')])
    expect(affichage(fin.etat, T0 + 28_000)).toMatchObject({ phase: 'repos', repos: { nature: 'inter', prochain: 'Nom b' } })
  })
})

describe('minuteur seul', () => {
  const seul: PlanCircuit = { mode: 'seul', exercices: [exo('a', 3, 20)], reposInterSec: 0, reposFinTourSec: 0 }
  it('décompte, minuteur, validation, fin ; pas de position', () => {
    let e = demarrer(seul, { exIdx: 0, numero: 1 }, T0)
    e = avancer(e, T0 + 3000).etat
    expect(affichage(e, T0 + 3000)).toMatchObject({ mode: 'seul', phase: 'actif', position: null, serie: { numero: 1, total: 3, cote: '' } })
    const r = avancer(e, T0 + 23_000)
    expect(r.effets).toEqual([valide('a', 1, 20)])
    expect(r.etat).toMatchObject({ phase: 'inactif', fin: 'terminee' })
    expect(affichage(r.etat, T0 + 23_000)).toBeNull()
  })
})

describe('arrêt manuel', () => {
  it('garde ce qui est validé et n’émet plus rien', () => {
    const plan = circuit([exo('a', 2, 10), exo('b', 2, 10)])
    const { etat, effets } = derouler(demarrer(plan, { exIdx: 0, numero: 1 }, T0), T0, T0 + 20_000)
    expect(effets).toHaveLength(1)
    const stop = arreter(etat)
    expect(stop).toMatchObject({ phase: 'inactif', fin: 'arretee' })
    expect(avancer(stop, T0 + 500_000).effets).toEqual([])
  })
  it('pendant le décompte : rien n’a été validé', () => {
    const stop = arreter(demarrer(circuit([exo('a', 1, 10)]), { exIdx: 0, numero: 1 }, T0))
    expect(stop).toMatchObject({ phase: 'inactif', fin: 'arretee' })
  })
})

describe('onglet en arrière-plan', () => {
  it('rattrape plusieurs phases en un appel, chaque série validée exactement une fois, dans l’ordre', () => {
    const plan = circuit([exo('a', 2, 10), exo('b', 2, 10)], 5, 8)
    const e0 = demarrer(plan, { exIdx: 0, numero: 1 }, T0)
    // a1 (3-13), repos (13-18), b1 (18-28), repos fin tour (28-36), a2 (36-46), repos (46-51), b2 (51-61)
    const r = avancer(e0, T0 + 55_000)
    expect(r.effets.map((x) => `${x.exerciceId}${x.numero}`)).toEqual(['a1', 'b1', 'a2'])
    expect(affichage(r.etat, T0 + 55_000)).toMatchObject({ phase: 'actif', nomExercice: 'Nom b', restantSec: 6 })
    const suite = avancer(r.etat, T0 + 55_000)
    expect(suite.effets).toEqual([])
    const fin = avancer(r.etat, T0 + 70_000)
    expect(fin.effets.map((x) => `${x.exerciceId}${x.numero}`)).toEqual(['b2'])
    expect(fin.etat).toMatchObject({ phase: 'inactif', fin: 'terminee' })
  })
  it('un instant antérieur ne fait pas reculer la machine', () => {
    const e = avancer(demarrer(circuit([exo('a', 1, 10)]), { exIdx: 0, numero: 1 }, T0), T0 + 5000).etat
    expect(avancer(e, T0 + 1000).effets).toEqual([])
    expect(affichage(e, T0 + 1000)?.restantSec).toBe(10)
  })
})

describe('clé d’annonce', () => {
  it('change à chaque phase / ligne, pas à chaque seconde', () => {
    const e = avancer(demarrer(circuit([exo('a', 2, 30)]), { exIdx: 0, numero: 1 }, T0), T0 + 3000).etat
    expect(affichage(e, T0 + 5000)?.cle).toBe(affichage(e, T0 + 20_000)?.cle)
    const apres = avancer(e, T0 + 33_000).etat
    expect(affichage(apres, T0 + 33_000)?.cle).not.toBe(affichage(e, T0 + 5000)?.cle)
  })
})
