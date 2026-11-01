import { describe, expect, it } from 'vitest'
import type { ApercuSeanceIA } from '../../core/import-ia/planifier'
import { detailSeance, libelleBoutonImport, messageResultat, syntheseApercu } from './libellesIA'

const seance = (extra: Partial<ApercuSeanceIA> = {}): ApercuSeanceIA => ({
  index: 0, nom: 'S', nomFichier: 'S', renommee: false, statut: 'nouvelle', nbBlocs: 1, nbExercices: 1, nbSeries: 1, dureeMin: 0,
  reconnus: [], aCreer: [], avertissements: [], ...extra,
})

describe('libellés de l\'import IA', () => {
  it('résultat : accords au singulier et au pluriel', () => {
    expect(messageResultat({ seances: 3, ignorees: 0, exercicesCrees: 2 })).toBe('3 séances importées, 2 exercices créés.')
    expect(messageResultat({ seances: 1, ignorees: 0, exercicesCrees: 1 })).toBe('1 séance importée, 1 exercice créé.')
    expect(messageResultat({ seances: 2, ignorees: 0, exercicesCrees: 0 })).toBe('2 séances importées, aucun exercice créé.')
    expect(messageResultat({ seances: 0, ignorees: 1, exercicesCrees: 0 })).toBe('Aucune nouvelle séance : cette séance était déjà présente.')
    expect(messageResultat({ seances: 0, ignorees: 2, exercicesCrees: 0 })).toBe('Aucune nouvelle séance : ces séances étaient déjà présentes.')
  })

  it('bouton et synthèse', () => {
    expect(libelleBoutonImport(1)).toBe('Importer 1 séance')
    expect(libelleBoutonImport(3)).toBe('Importer 3 séances')
    expect(libelleBoutonImport(0)).toBe('Aucune séance à importer')
    expect(syntheseApercu([seance(), seance({ statut: 'deja-presente' })], 2)).toBe('1 séance à importer, 1 déjà présente (ignorée), 2 exercices à créer.')
  })

  it('détail d\'une séance', () => {
    expect(detailSeance(seance({ nbBlocs: 4, nbExercices: 6, nbSeries: 20, dureeMin: 45 }))).toBe('4 blocs · 6 exercices · 20 séries · ≈ 45 min')
    expect(detailSeance(seance())).toBe('1 bloc · 1 exercice · 1 série · —')
  })
})
