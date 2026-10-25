import { describe, expect, it } from 'vitest'
import type { Seance } from '../../core/db/types'
import { filtrerSeances, SEUIL_RECHERCHE } from './rechercheSeances'

const s = (id: string, nom: string, groupes: string[], notes = ''): Seance => ({
  id, nom, groupesMusculaires: JSON.stringify(groupes), dureeEstimeeMin: 45, notes, seanceCategory: 'STRENGTH', createdAt: 'c',
  isArchived: false, updatedAt: 'u',
})

const liste = [
  s('1', 'Pull', ['DOS', 'BICEPS']),
  s('2', 'Épaules lourdes', ['EPAULES'], 'Développé militaire'),
  s('3', 'Jambes', ['QUADRICEPS', 'FESSIERS']),
]

describe('filtrerSeances', () => {
  it('requête vide ou blanche : tout, ordre conservé', () => {
    expect(filtrerSeances(liste, '').map((x) => x.id)).toEqual(['1', '2', '3'])
    expect(filtrerSeances(liste, '   ').map((x) => x.id)).toEqual(['1', '2', '3'])
  })
  it('nom, sans accent ni casse', () => {
    expect(filtrerSeances(liste, 'epaule').map((x) => x.id)).toEqual(['2'])
    expect(filtrerSeances(liste, 'PULL').map((x) => x.id)).toEqual(['1'])
  })
  it('groupes musculaires (libellé français) et notes', () => {
    expect(filtrerSeances(liste, 'fessiers').map((x) => x.id)).toEqual(['3'])
    expect(filtrerSeances(liste, 'militaire').map((x) => x.id)).toEqual(['2'])
  })
  it('tous les mots doivent correspondre', () => {
    expect(filtrerSeances(liste, 'dos biceps').map((x) => x.id)).toEqual(['1'])
    expect(filtrerSeances(liste, 'dos jambes')).toEqual([])
  })
  it('seuil : la recherche n\'apparaît qu\'à partir de 6 modèles', () => {
    expect(SEUIL_RECHERCHE).toBe(6)
  })
})
