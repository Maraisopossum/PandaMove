import { describe, expect, it } from 'vitest'
import { mapExerciceSeance, mapSerie } from '../../../core/db/repos/mappers'
import { messageFin } from './confirmationFin'
import { construireVue } from './vue'

function vue(series: ReturnType<typeof mapSerie>[], prevues = 3) {
  const e = [
    mapExerciceSeance({ id: 'a', exercise_id: 'x', position: 0, nombre_series_prevues: prevues }),
    mapExerciceSeance({ id: 'b', exercise_id: 'x', position: 1, nombre_series_prevues: 2 }),
  ]
  return construireVue([], e, series, new Map()).exercices
}
const faite = (id: string, ex: string, n: number) => mapSerie({ id, exercice_seance_id: ex, numero_serie: n, is_completed: 1 })

describe('messageFin : confirmation de « Terminer la séance » (texte Android, précisé si besoin)', () => {
  it('tout validé : le texte de l’Android seul', () => {
    const exercices = vue([faite('1', 'a', 1), faite('2', 'a', 2), faite('3', 'a', 3), faite('4', 'b', 1), faite('5', 'b', 2)])
    expect(messageFin(exercices)).toEqual({
      titre: 'Terminer la séance ?',
      lignes: ['Les résultats seront sauvegardés et la séance marquée comme terminée.'],
    })
  })

  it('séries non validées : leur nombre est rappelé (elles ne comptent pas)', () => {
    const m = messageFin(vue([faite('1', 'a', 1), faite('4', 'b', 1)]))
    expect(m.lignes).toEqual([
      'Les résultats seront sauvegardés et la séance marquée comme terminée.',
      '3 séries prévues ne sont pas validées : elles ne seront pas comptées.',
    ])
  })

  it('une seule série non validée : singulier', () => {
    const m = messageFin(vue([faite('1', 'a', 1), faite('2', 'a', 2), faite('3', 'a', 3), faite('4', 'b', 1)]))
    expect(m.lignes[1]).toBe('1 série prévue n’est pas validée : elle ne sera pas comptée.')
  })

  it('séance sans aucune série validée : avertissement en tête', () => {
    expect(messageFin(vue([])).lignes).toEqual([
      'Aucune série n’est validée : le rapport sera vide.',
      'Les résultats seront sauvegardés et la séance marquée comme terminée.',
    ])
  })

  it('séance sans exercice', () => {
    expect(messageFin([]).lignes).toEqual([
      'Aucune série n’est validée : le rapport sera vide.',
      'Les résultats seront sauvegardés et la séance marquée comme terminée.',
    ])
  })
})
