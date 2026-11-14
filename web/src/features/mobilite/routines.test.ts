// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { EXERCICES, SEANCES_TYPES, TOUS_TYPES } from './donnees'
import { genererSeance } from './generer'
import { grilleQuatreSemaines, serieJours, totauxQuatreSemaines } from './regularite'
import {
  ajouterRoutine, detailRoutine, ecrireRoutines, etiquettes, lireRoutines, nomSuggere, renommerRoutine, retirerRoutine, type Routine,
} from './routines'
import { CHOIX_PAR_DEFAUT, normaliserChoix, type SeanceFaite } from './stockage'
import { suggerer } from './suggestion'

afterEach(() => localStorage.clear())

const choix = (partiel: Partial<typeof CHOIX_PAR_DEFAUT> = {}) => ({ ...CHOIX_PAR_DEFAUT, ...partiel })
const faite = (date: string, dureeS = 600): SeanceFaite => ({ date, dureeS, exercices: 8, zones: [], sport: null })

describe('types d’exercices dans le générateur', () => {
  const types = (plan: ReturnType<typeof genererSeance>) => new Set(plan.etapes.map((e) => e.exercice.type))

  it('« Mobilité seule » : aucun étirement, sur toutes les graines', () => {
    for (let graine = 1; graine <= 30; graine++) {
      const plan = genererSeance({ minutes: 10, zones: [], moment: 'avant', types: ['mobilite', 'activation'], graine })
      expect(plan.etapes.length).toBeGreaterThan(0)
      expect(types(plan).has('etirement')).toBe(false)
    }
  })

  it('un seul type : tous les exercices en sont, même après un remplacement', async () => {
    const { remplacerEtape } = await import('./generer')
    const plan = genererSeance({ minutes: 10, zones: ['hanches', 'epaules'], moment: 'libre', types: ['etirement'], graine: 3 })
    expect([...types(plan)]).toEqual(['etirement'])
    const autre = remplacerEtape(plan, 0)
    expect(autre.etapes.every((e) => e.exercice.type === 'etirement')).toBe(true)
  })

  it('types absents ou vides : les trois types sont admis', () => {
    const sans = genererSeance({ minutes: 20, zones: [], moment: 'libre', graine: 5 })
    const vide = genererSeance({ minutes: 20, zones: [], moment: 'libre', types: [], graine: 5 })
    expect(vide.etapes.map((e) => e.exercice.id)).toEqual(sans.etapes.map((e) => e.exercice.id))
  })

  it('combinaison sans exercice (zone sans activation) : séance vide, jamais d’erreur', () => {
    const plan = genererSeance({ minutes: 10, zones: ['quadriceps'], moment: 'libre', types: ['activation'], graine: 1 })
    expect(plan.etapes).toEqual([])
  })

  it('la séance type « Mobilité seule » existe, sans étirement, et le catalogue compte bien trois types', () => {
    const seule = SEANCES_TYPES.find((s) => s.id === 'seule')!
    expect(seule.types).toEqual(['mobilite', 'activation'])
    expect(new Set(EXERCICES.map((e) => e.type))).toEqual(new Set(TOUS_TYPES))
  })
})

describe('choix normalisé', () => {
  it('types invalides ou vides : les trois ; types valides conservés dans l’ordre du filtre', () => {
    expect(normaliserChoix({ types: ['x'] }).types).toEqual(TOUS_TYPES)
    expect(normaliserChoix({ types: [] }).types).toEqual(TOUS_TYPES)
    expect(normaliserChoix({ types: ['etirement', 'mobilite'] }).types).toEqual(['mobilite', 'etirement'])
    expect(normaliserChoix(null)).toEqual(CHOIX_PAR_DEFAUT)
    expect(normaliserChoix('nimporte quoi')).toEqual(CHOIX_PAR_DEFAUT)
  })
})

describe('routines', () => {
  it('ajoute en tête, refuse un nom vide, tronque un nom trop long', () => {
    const a = ajouterRoutine([], '  Pause bureau ', choix({ minutes: 5 }), 'r1')
    expect(a.map((r) => r.nom)).toEqual(['Pause bureau'])
    expect(ajouterRoutine(a, '   ', choix(), 'r2')).toBe(a)
    const b = ajouterRoutine(a, 'x'.repeat(80), choix(), 'r2')
    expect(b[0].id).toBe('r2')
    expect(b[0].nom).toHaveLength(40)
  })

  it('plafonne à 20 routines', () => {
    let liste: Routine[] = []
    for (let i = 0; i < 25; i++) liste = ajouterRoutine(liste, `R${i}`, choix(), `id${i}`)
    expect(liste).toHaveLength(20)
  })

  it('renomme et retire ; un nom vide ne renomme pas', () => {
    const liste = ajouterRoutine(ajouterRoutine([], 'A', choix(), 'a'), 'B', choix(), 'b')
    expect(renommerRoutine(liste, 'a', 'Nouveau').find((r) => r.id === 'a')!.nom).toBe('Nouveau')
    expect(renommerRoutine(liste, 'a', ' ')).toBe(liste)
    expect(retirerRoutine(liste, 'a').map((r) => r.id)).toEqual(['b'])
  })

  it('écrit, relit ; stockage corrompu ou entrées invalides : ignorés', () => {
    const liste = ajouterRoutine([], 'Après la course', choix({ minutes: 12, moment: 'apres', zones: ['hanches'], types: ['etirement'] }), 'r1')
    ecrireRoutines(liste)
    expect(lireRoutines()).toEqual(liste)
    localStorage.setItem('pandamove.mobilite.routines', JSON.stringify([{ id: 'ok', nom: 'Bonne', choix: { minutes: 7, types: ['activation'] } }, { id: '', nom: 'sans id' }, { id: 'x', nom: ' ' }, null, 3]))
    expect(lireRoutines().map((r) => [r.id, r.choix.minutes, r.choix.types])).toEqual([['ok', 7, ['activation']]])
    localStorage.setItem('pandamove.mobilite.routines', 'pas du json')
    expect(lireRoutines()).toEqual([])
  })

  it('nom proposé : séance type, sinon zones, sinon « Ma routine »', () => {
    expect(nomSuggere(choix({ sport: 'seule', minutes: 10 }))).toBe('Mobilité seule · 10 min')
    expect(nomSuggere(choix({ zones: ['hanches', 'fessiers', 'cou'], minutes: 8 }))).toBe('Hanches, Fessiers · 8 min')
    expect(nomSuggere(choix({ minutes: 5 }))).toBe('Ma routine · 5 min')
  })

  it('étiquettes : types seulement s’ils sont filtrés, puis zones ; « Tout le corps » sans zone', () => {
    expect(etiquettes(choix())).toEqual(['Tout le corps'])
    expect(etiquettes(choix({ types: ['mobilite', 'activation'], zones: ['hanches', 'fessiers', 'cou'] }))).toEqual(['Mobilité', 'Activation', 'Hanches', 'Fessiers'])
    expect(etiquettes(choix({ zones: ['cou', 'epaules', 'hanches', 'fessiers', 'mollets'] }), 3)).toEqual(['Cou', 'Épaules', 'Hanches'])
  })

  it('détail de la carte : durée, nombre d’exercices, moment', () => {
    const d = detailRoutine(choix({ minutes: 8, moment: 'avant', types: ['mobilite', 'activation'] }))
    expect(d).toMatch(/^8 min · \d+ exercices? · avant le sport$/)
  })
})

describe('régularité', () => {
  // Jeudi 12 novembre 2026 : la grille va du lundi 19 octobre au dimanche 15 novembre
  const AUJ = '2026-11-12'

  it('jours de suite : jusqu’à aujourd’hui, ou jusqu’à hier si aujourd’hui n’est pas encore fait', () => {
    expect(serieJours([], AUJ)).toBe(0)
    expect(serieJours([faite('2026-11-12'), faite('2026-11-11'), faite('2026-11-10')], AUJ)).toBe(3)
    expect(serieJours([faite('2026-11-11'), faite('2026-11-10')], AUJ)).toBe(2)
    expect(serieJours([faite('2026-11-10')], AUJ)).toBe(0) // avant-hier : la série est rompue
    expect(serieJours([faite('2026-11-12'), faite('2026-11-12'), faite('2026-11-10')], AUJ)).toBe(1) // deux séances le même jour : un jour
  })

  it('grille : 28 jours du lundi d’il y a trois semaines au dimanche en cours, avec jours à venir', () => {
    const g = grilleQuatreSemaines([faite('2026-10-19'), faite('2026-11-12'), faite('2026-11-12')], AUJ)
    expect(g).toHaveLength(28)
    expect([g[0].dateIso, g[27].dateIso]).toEqual(['2026-10-19', '2026-11-15'])
    expect(g[0].fait).toBe(true)
    expect(g.find((j) => j.dateIso === '2026-11-12')).toMatchObject({ fait: true, nombre: 2, avenir: false })
    expect(g.find((j) => j.dateIso === '2026-11-13')!.avenir).toBe(true)
    expect(g.filter((j) => j.avenir)).toHaveLength(3)
  })

  it('totaux des quatre semaines : séances et minutes arrondies, hors séances plus anciennes', () => {
    expect(totauxQuatreSemaines([faite('2026-10-19', 900), faite('2026-11-12', 1000), faite('2026-10-18', 5000)], AUJ)).toEqual({ seances: 2, minutes: 32 })
  })
})

describe('suggestion du jour', () => {
  const AUJ = '2026-11-12'
  const sortie = (sport: 'course' | 'velo', date: string, dureeS: number | null) => ({ sport, date, dureeS })
  const routineApres = (id: string, sport: 'velo' | 'course' | null): Routine => ({ id, nom: `Après ${id}`, choix: choix({ moment: 'apres', sport, minutes: 12 }) })

  it('après un vélo de 98 minutes hier : lance la routine « après » du même sport', () => {
    const s = suggerer([sortie('velo', '2026-11-11', 5880)], [], [routineApres('course', 'course'), routineApres('velo', 'velo')], AUJ)!
    expect(s.texte).toBe('Sortie vélo de 1 h 38 hier. Une routine de 12 min aidera à relâcher.')
    expect(s.libelleAction).toBe('Lancer « Après velo »')
    expect(s.choix.sport).toBe('velo')
  })

  it('sans routine : séance type du sport, étirements après le sport', () => {
    const s = suggerer([sortie('course', AUJ, 4200)], [], [], AUJ)!
    expect(s.texte).toBe('Course de 1 h 10 aujourd’hui. Une routine de 10 min aidera à relâcher.')
    expect(s.libelleAction).toBe('Lancer une séance de 10 min')
    expect(s.choix).toMatchObject({ sport: 'course', moment: 'apres', minutes: 10 })
    expect(s.choix.zones).toContain('mollets')
  })

  it('routine « après le sport » d’un autre sport : prise à défaut', () => {
    const s = suggerer([sortie('velo', '2026-11-11', 4000)], [], [routineApres('course', 'course')], AUJ)!
    expect(s.libelleAction).toBe('Lancer « Après course »')
  })

  it('rien : sortie courte, trop ancienne, sans durée, ou séance de mobilité déjà faite aujourd’hui', () => {
    expect(suggerer([sortie('velo', '2026-11-11', 3599)], [], [], AUJ)).toBeNull()
    expect(suggerer([sortie('velo', '2026-11-10', 9000)], [], [], AUJ)).toBeNull()
    expect(suggerer([sortie('velo', AUJ, null)], [], [], AUJ)).toBeNull()
    expect(suggerer([sortie('velo', '2026-11-11', 9000)], [faite(AUJ)], [], AUJ)).toBeNull()
  })

  it('plusieurs grosses sorties : la plus longue', () => {
    const s = suggerer([sortie('course', '2026-11-11', 3700), sortie('velo', AUJ, 7200)], [], [], AUJ)!
    expect(s.texte.startsWith('Sortie vélo de 2 h')).toBe(true)
  })
})
