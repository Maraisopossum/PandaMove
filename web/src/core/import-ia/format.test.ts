import { describe, expect, it } from 'vitest'
import { TYPES_BLOC, nouveauBloc, nouvelExercice } from '../../features/strength/draft'
import { SYSTEMES_PROGRESSION, TYPES_EXERCICE, activerProgression } from '../../features/strength/edition/progressionConfig'
import { MUSCLE_GROUPS } from '../db/types'
import {
  DEFAUTS, FORMAT_ID, GROUPES, SYSTEMES, TYPES_BLOC_IA, TYPES_EXERCICE_IA, VERSION_FORMAT, formaterChemin, validerFichierIA,
} from './format'

const exo = (extra: Record<string, unknown> = {}) => ({ exercice: 'Squat', series: 3, reps: '8-12', ...extra })
const fichier = (blocs: unknown[] = [{ type: 'LIBRE', exercices: [exo()] }], extra: Record<string, unknown> = {}) => ({
  format: FORMAT_ID, version: VERSION_FORMAT, seances: [{ nom: 'Jambes', blocs, ...extra }],
})
const textes = (brut: unknown) => validerFichierIA(brut).erreurs.map((e) => e.texte)

describe('valeurs autorisées = celles du code (aucune dérive)', () => {
  it('types de bloc, systèmes, types d\'exercice et groupes viennent des modules existants', () => {
    expect(TYPES_BLOC_IA).toEqual(['LIBRE', ...TYPES_BLOC])
    expect(SYSTEMES).toEqual(SYSTEMES_PROGRESSION.map((s) => s.valeur))
    expect(TYPES_EXERCICE_IA).toEqual(TYPES_EXERCICE.map((t) => t.valeur))
    expect(GROUPES).toEqual([...MUSCLE_GROUPS])
  })

  it("les défauts documentés sont ceux de l'éditeur", () => {
    const e = nouvelExercice('x', { id: 'e', name: 'n', muscles: [], equipment: [], isBodyweight: false }, null)
    expect(e.tempsReposSec).toBe(DEFAUTS.reposSec)
    expect(e.seuilDeload).toBe(DEFAUTS.seuilDeload)
    const b = nouveauBloc('b', 'CIRCUIT')
    expect(b.tempsReposInterSec).toBe(DEFAUTS.reposInterExercicesSec)
    expect(b.tempsReposFinRoundSec).toBe(DEFAUTS.reposFinTourSec)
    expect(b.nombreSeriesPrevues).toBe(DEFAUTS.tours)
    const p = activerProgression(e)
    expect([p.systemeProgression, p.repsMin, p.repsMax, p.incrementKg]).toEqual([
      DEFAUTS.systeme, DEFAUTS.repsMin, DEFAUTS.repsMax, DEFAUTS.incrementKg,
    ])
  })
})

describe('validerFichierIA', () => {
  it('accepte un fichier minimal', () => {
    const r = validerFichierIA(fichier())
    expect(r.erreurs).toEqual([])
    expect(r.donnees?.seances).toHaveLength(1)
    expect(r.avertissements).toEqual([])
  })

  it('formate les chemins', () => {
    expect(formaterChemin(['seances', 1, 'blocs', 0, 'exercices', 2, 'series'])).toBe('seances[1].blocs[0].exercices[2].series')
  })

  it('série 0 : message avec chemin lisible et bornes', () => {
    const brut = { ...fichier(), seances: [fichier().seances[0], { nom: 'B', blocs: [{ type: 'LIBRE', exercices: [exo(), exo(), exo({ series: 0 })] }] }] }
    expect(textes(brut)).toContain('seances[1].blocs[0].exercices[2].series : doit être un entier entre 1 et 20')
  })

  it('série décimale ou textuelle', () => {
    expect(textes(fichier([{ type: 'LIBRE', exercices: [exo({ series: 2.5 })] }]))[0]).toMatch(/series : doit être un entier entre 1 et 20/)
    expect(textes(fichier([{ type: 'LIBRE', exercices: [exo({ series: 'trois' })] }]))[0]).toMatch(/series : doit être un entier entre 1 et 20/)
  })

  it('enum inconnue : liste les valeurs permises', () => {
    const [t] = textes(fichier([{ type: 'PYRAMIDE', exercices: [exo()] }]))
    expect(t).toMatch(/^seances\[0\]\.blocs\[0\]\.type : doit valoir l'une de ces valeurs : LIBRE, ECHAUFFEMENT/)
  })

  it('bloc sans exercice', () => {
    expect(textes(fichier([{ type: 'SUPERSET', exercices: [] }]))).toContain('seances[0].blocs[0].exercices : doit contenir au moins 1 élément')
  })

  it('séance vide (aucun bloc) et fichier vide', () => {
    expect(textes(fichier([]))).toContain('seances[0].blocs : doit contenir au moins 1 élément')
    expect(textes({ format: FORMAT_ID, version: 1, seances: [] })).toContain('seances : doit contenir au moins 1 élément')
  })

  it('champs obligatoires manquants', () => {
    const t = textes({ format: FORMAT_ID, version: 1, seances: [{ blocs: [{ exercices: [{}] }] }] })
    expect(t).toContain('seances[0].nom : est obligatoire')
    expect(t).toContain('seances[0].blocs[0].type : est obligatoire')
    expect(t).toContain('seances[0].blocs[0].exercices[0].exercice : est obligatoire')
  })

  it('mauvais format ou version', () => {
    expect(textes({ format: 'autre', version: 1, seances: [] })).toContain('format : doit valoir « pandamove-seances-ia »')
    expect(textes({ format: FORMAT_ID, version: 2, seances: [] })).toContain('version : doit valoir 1 (seule version prise en charge)')
    expect(textes([1, 2])[0]).toMatch(/Fichier : doit être un objet JSON/)
  })

  it('plus de 20 séances', () => {
    const seances = Array.from({ length: 21 }, (_, i) => ({ nom: `S${i}`, blocs: [{ type: 'LIBRE', exercices: [exo()] }] }))
    expect(textes({ format: FORMAT_ID, version: 1, seances })).toContain('seances : doit contenir 20 éléments au maximum')
  })

  it('série obligatoire hors circuit, durée obligatoire en circuit', () => {
    expect(textes(fichier([{ type: 'SUPERSET', exercices: [{ exercice: 'A' }, exo()] }]))).toContain(
      'seances[0].blocs[0].exercices[0].series : doit être un entier entre 1 et 20 (obligatoire)',
    )
    expect(textes(fichier([{ type: 'CIRCUIT', exercices: [{ exercice: 'A' }] }]))).toContain(
      'seances[0].blocs[0].exercices[0].dureeSec : est obligatoire dans un CIRCUIT (durée en secondes)',
    )
    expect(validerFichierIA(fichier([{ type: 'CIRCUIT', tours: 3, exercices: [{ exercice: 'A', dureeSec: 30 }] }])).erreurs).toEqual([])
  })

  it('charge et chargeKg incompatibles ; PDC seul accepté ; autre texte refusé', () => {
    expect(textes(fichier([{ type: 'LIBRE', exercices: [exo({ charge: 'PDC', chargeKg: 10 })] }]))[0]).toMatch(/chargeKg : ne peut pas être combiné/)
    expect(validerFichierIA(fichier([{ type: 'LIBRE', exercices: [exo({ charge: 'PDC' })] }])).erreurs).toEqual([])
    expect(textes(fichier([{ type: 'LIBRE', exercices: [exo({ charge: '20 kg' })] }]))[0]).toMatch(/charge : doit valoir « PDC »/)
  })

  it('reps nombre ou texte ; plage de progression incohérente', () => {
    expect(validerFichierIA(fichier([{ type: 'LIBRE', exercices: [exo({ reps: 10 })] }])).erreurs).toEqual([])
    expect(
      textes(fichier([{ type: 'LIBRE', exercices: [exo({ progression: { activee: true, repsMin: 12, repsMax: 8 } })] }]))[0],
    ).toMatch(/progression\.repsMin : ne peut pas dépasser repsMax/)
  })

  it('muscles : code inconnu refusé', () => {
    expect(textes(fichier([{ type: 'LIBRE', exercices: [exo({ muscles: { principal: 'JAMBES' } })] }]))[0]).toMatch(
      /muscles\.principal : doit valoir l'une de ces valeurs : PECTORAUX/,
    )
  })

  it('champs inconnus : avertissement, pas une erreur', () => {
    const r = validerFichierIA({ ...fichier([{ type: 'LIBRE', coucou: 1, exercices: [exo({ rpe: 8, progression: { activee: false, x: 1 } })] }]), auteur: 'IA' })
    expect(r.erreurs).toEqual([])
    expect(r.avertissements).toEqual([
      'Fichier : champ inconnu « auteur » ignoré',
      'seances[0].blocs[0] : champ inconnu « coucou » ignoré',
      'seances[0].blocs[0].exercices[0] : champ inconnu « rpe » ignoré',
      'seances[0].blocs[0].exercices[0].progression : champ inconnu « x » ignoré',
    ])
  })
})
