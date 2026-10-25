import { describe, expect, it } from 'vitest'
import { composer, ratioContraste } from '../../../app/contraste'
import { mapBloc, mapExerciceSeance, mapSerie } from '../../../core/db/repos/mappers'
import {
  COULEURS_BLOC, construireNav, couleursBloc, exerciceTermine, indexParDefaut, libelleCourt,
  positionDefilement,
} from './navExercices'
import { construireVue, type ExerciceVue } from './vue'

const bloc = (id: string, position: number, type: string) => mapBloc({ id, nom: `Bloc ${id}`, position, type })
const ex = (id: string, blocId: string | null, position: number, extra: Record<string, unknown> = {}) =>
  mapExerciceSeance({ id, exercise_id: `x-${id}`, bloc_id: blocId, position, nombre_series_prevues: 2, ...extra })
const serie = (exId: string, n: number) => mapSerie({ is_completed: 1, id: `${exId}-${n}`, exercice_seance_id: exId, numero_serie: n })

function vue(blocs: ReturnType<typeof bloc>[], exos: ReturnType<typeof ex>[], series: ReturnType<typeof serie>[] = []) {
  const noms = new Map(exos.map((e) => [e.exerciseId, `Nom ${e.id}`]))
  return construireVue(blocs, exos, series, noms)
}

describe('couleursBloc', () => {
  it('une couleur par type de bloc, violet du module pour les autres', () => {
    expect(couleursBloc('SUPERSET')).toBe(COULEURS_BLOC.SUPERSET)
    expect(couleursBloc(null)).toBe(COULEURS_BLOC.AUTRE)
    expect(couleursBloc('INCONNU')).toBe(COULEURS_BLOC.AUTRE)
  })

  it('contrastes WCAG AA, thème clair : texte blanc sur la teinte pleine, teinte sur sa pastille à 10 %', () => {
    for (const [nom, c] of Object.entries(COULEURS_BLOC)) {
      expect(ratioContraste('#ffffff', c.clair), `${nom} blanc/plein`).toBeGreaterThanOrEqual(4.5)
      expect(ratioContraste(c.clair, composer({ couleur: c.clair, alpha: 0.1 }, '#ffffff')), `${nom} clair/teinte`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('thème sombre : teinte lisible sur sa pastille à 10 %, et texte sombre sur la teinte pleine', () => {
    for (const [nom, c] of Object.entries(COULEURS_BLOC)) {
      expect(ratioContraste(c.sombre, composer({ couleur: c.sombre, alpha: 0.1 }, '#1e1e22')), `${nom} texte`).toBeGreaterThanOrEqual(4.5)
      expect(ratioContraste('#1e1e22', c.sombre), `${nom} actif`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('libelleCourt', () => {
  const base = vue([], [ex('a', null, 0)]).exercices[0]
  const v = (extra: Partial<ExerciceVue>): ExerciceVue => ({ ...base, ...extra })

  it('premier mot du premier groupe musculaire, 4 lettres max, majuscules', () => {
    expect(libelleCourt(v({ muscles: ['PECTORAUX', 'TRICEPS'] }))).toBe('PECT')
    expect(libelleCourt(v({ muscles: ['AVANT_BRAS'] }))).toBe('AVAN')
    expect(libelleCourt(v({ muscles: ['dos'] }))).toBe('DOS')
  })
  it('sans muscle : 3 premières lettres du nom', () => {
    expect(libelleCourt(v({ muscles: [], nom: 'Squat' }))).toBe('SQU')
  })
  it('exercice bilatéral : 🔄', () => {
    expect(libelleCourt(v({ muscles: ['DOS'], isBilateral: true }))).toBe('🔄')
  })
})

describe('exercice terminé et actif par défaut', () => {
  const blocs = [bloc('b', 0, 'ECHAUFFEMENT')]
  const exos = [ex('a', 'b', 0), ex('b', 'b', 1), ex('c', 'b', 2)]

  it('terminé : toutes les séries prévues saisies', () => {
    const v = vue(blocs, exos, [serie('a', 1), serie('a', 2), serie('b', 1)])
    expect(v.exercices.map(exerciceTermine)).toEqual([true, false, false])
  })
  it('par défaut : premier non terminé, sinon le premier, sinon 0', () => {
    expect(indexParDefaut(vue(blocs, exos, [serie('a', 1), serie('a', 2)]).exercices)).toBe(1)
    const tous = [serie('a', 1), serie('a', 2), serie('b', 1), serie('b', 2), serie('c', 1), serie('c', 2)]
    expect(indexParDefaut(vue(blocs, exos, tous).exercices)).toBe(0)
    expect(indexParDefaut([])).toBe(0)
  })
})

describe('construireNav', () => {
  const blocs = [bloc('e', 0, 'ECHAUFFEMENT'), bloc('s1', 1, 'SUPERSET'), bloc('s2', 2, 'SUPERSET'), bloc('f', 3, 'AUTRE')]
  const exos = [ex('e1', 'e', 0), ex('s1a', 's1', 0), ex('s1b', 's1', 1), ex('s2a', 's2', 0), ex('f1', 'f', 0), ex('h1', null, 9)]
  const v = vue(blocs, exos, [serie('e1', 1)])
  const nav = construireNav(v.blocs, 's1b')

  it('un groupe par bloc ; encadré : échauffement/activation/récupération, superset/circuit à 2+ exercices', () => {
    expect(nav.map((g) => [g.cle, g.encadre])).toEqual([
      ['e', true], ['s1', true], ['s2', false], ['f', false], ['libre-h1', false],
    ])
  })
  it('couleur du bloc ; violet du module pour un bloc sans couleur propre', () => {
    expect(nav[0].couleurs).toBe(COULEURS_BLOC.ECHAUFFEMENT)
    expect(nav[1].couleurs).toBe(COULEURS_BLOC.SUPERSET)
    expect(nav[3].couleurs).toBe(COULEURS_BLOC.AUTRE)
  })
  it('badges : actif repéré, état en clair, nom accessible avec le bloc', () => {
    expect(nav[1].badges.map((x) => x.actif)).toEqual([false, true])
    expect(nav[0].badges[0]).toMatchObject({ id: 'e1', nom: 'Nom e1', termine: false, etat: '1 série sur 2 faite' })
    expect(nav[0].badges[0].nomAccessible).toBe('Nom e1, Bloc e, 1 série sur 2 faite')
  })
  it('exercice terminé : état « terminé »', () => {
    const fini = construireNav(vue(blocs, exos, [serie('e1', 1), serie('e1', 2)]).blocs, 'e1')
    expect(fini[0].badges[0]).toMatchObject({ termine: true, etat: 'terminé' })
  })
})

describe('positionDefilement', () => {
  it('groupe encadré : début du groupe calé sur le bord gauche, moins 16 px', () => {
    expect(positionDefilement({ largeurVue: 400, gauche: 500, largeur: 64, groupeGauche: 450 })).toBe(434)
  })
  it('hors groupe encadré : badge centré dans la barre', () => {
    expect(positionDefilement({ largeurVue: 400, gauche: 500, largeur: 64, groupeGauche: null })).toBe(332)
  })
  it('jamais négatif', () => {
    expect(positionDefilement({ largeurVue: 400, gauche: 10, largeur: 64, groupeGauche: null })).toBe(0)
  })
})
