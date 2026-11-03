import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  convertirSemaines, extraireLitteral, extraireProgramme, FICHIER_SOURCE_PAR_DEFAUT, retirerDoublonRavensberg, validerSemaines,
} from './extraire-programme-2027.mjs'

const racineWeb = join(dirname(fileURLToPath(import.meta.url)), '..')

// Page minimale qui ressemble au fichier réel : un littéral `weeks` suivi de `const strengthA`
const page = (semaines, fin = ';\nconst strengthA=[') => `<script>\nconst weeks=${JSON.stringify(semaines)}${fin}\n["x"]];\n</script>`

const semaine = (n, start, end, events) => ({ n, start, end, label: `Semaine ${n}`, events })
const evenement = (date, type, titre, detail, consigne, optionnelle) => {
  const e = [date, type, titre, detail, consigne]
  if (optionnelle !== undefined) e.push(optionnelle)
  return e
}

describe('extraireLitteral', () => {
  const semaines = [semaine(1, '2026-11-02', '2026-11-08', [evenement('2026-11-03', 'run', 'Footing facile', '40 min · Z1', 'Facile.')])]

  it('lit le littéral entre « const weeks= » et le repère de fin (fins de ligne \\n)', () => {
    expect(extraireLitteral(page(semaines))).toEqual(semaines)
  })

  it('accepte aussi les fins de ligne \\r\\n (fichier enregistré sous Windows)', () => {
    expect(extraireLitteral(page(semaines, ';\r\nconst strengthA=['))).toEqual(semaines)
  })

  it('accepte une indentation devant « const strengthA »', () => {
    expect(extraireLitteral(page(semaines, ';\n  const strengthA=['))).toEqual(semaines)
  })

  it.each([
    ['« const weeks= » absent', '<script>const autre=[]</script>', /const weeks=/],
    ['repère de fin absent', '<script>const weeks=[]\nconst reste=1</script>', /repère de fin/],
    ['littéral qui n’est pas du JSON (clés sans guillemets)', '<script>const weeks=[{n:1}];\nconst strengthA=[</script>', /JSON/],
  ])('échoue sans rien produire : %s', (_nom, html, message) => {
    expect(() => extraireLitteral(html)).toThrow(message)
  })
})

describe('validerSemaines — le format inattendu est refusé', () => {
  const ok = () => [semaine(1, '2026-11-02', '2026-11-08', [evenement('2026-11-03', 'run', 'Footing', '40 min · Z1', 'Facile.')])]
  const avec = (modif) => {
    const s = ok()
    modif(s)
    return s
  }

  it('accepte un programme conforme, optionnelle facultative', () => {
    expect(() => validerSemaines(ok())).not.toThrow()
    expect(() => validerSemaines(avec((s) => s[0].events[0].push(true)))).not.toThrow()
  })

  it.each([
    ['racine qui n’est pas une liste', () => ({}), /liste de semaines/],
    ['semaine sans numéro', (s) => delete s[0].n, /semaine/i],
    ['événement qui n’est pas un tableau', (s) => (s[0].events[0] = 'x'), /événement/i],
    ['événement trop court', (s) => s[0].events[0].pop(), /5 ou 6/],
    ['événement trop long', (s) => s[0].events[0].push(true, 'x'), /5 ou 6/],
    ['date inexistante (30 février)', (s) => (s[0].events[0][0] = '2026-02-30'), /date/i],
    ['date hors de sa semaine', (s) => (s[0].events[0][0] = '2026-11-20'), /hors de/],
    ['type inconnu', (s) => (s[0].events[0][1] = 'swim'), /type/i],
    ['titre vide', (s) => (s[0].events[0][2] = '  '), /titre/i],
    ['détail qui n’est pas du texte', (s) => (s[0].events[0][3] = 40), /détail|texte/i],
    ['consigne qui n’est pas du texte', (s) => (s[0].events[0][4] = null), /consigne|texte/i],
    ['« optionnelle » qui n’est pas un booléen', (s) => s[0].events[0].push('oui'), /booléen/i],
  ])('%s', (_nom, modif, message) => {
    const donnees = _nom.startsWith('racine') ? modif() : avec(modif)
    expect(() => validerSemaines(donnees)).toThrow(message)
  })
})

describe('convertirSemaines', () => {
  const une = (type, titre, detail, consigne, optionnelle, date = '2026-11-03') =>
    convertirSemaines([semaine(1, '2026-11-02', '2026-11-08', [evenement(date, type, titre, detail, consigne, optionnelle)])])[0]

  it('course et vélo : run donne « course », bike donne « velo »', () => {
    expect(une('run', 'Footing', '40 min · Z1', 'x').genre).toBe('course')
    expect(une('bike', 'Vélo', '30 min · Z1', 'x').genre).toBe('velo')
  })

  it('garde le détail « durée · zone » tel quel, sans le couper', () => {
    expect(une('run', 'Tempo', '50 min · 3 × 5 min Z3 basse', 'x').detail).toBe('50 min · 3 × 5 min Z3 basse')
    expect(une('run', 'Pi', '14,065 km · objectif 1 h 10', 'x').detail).toBe('14,065 km · objectif 1 h 10')
    expect(une('run', 'Rav', '10 km · endurance fondamentale', 'x').detail).toBe('10 km · endurance fondamentale')
  })

  it('un détail vide devient null', () => {
    expect(une('run', 'Footing', '  ', 'x').detail).toBeNull()
  })

  it('la clé est w{semaine}|e{rang}, avec le rang dans la semaine du fichier brut', () => {
    const [a, b] = convertirSemaines([
      semaine(7, '2026-12-14', '2026-12-20', [evenement('2026-12-15', 'run', 'A', 'x · y', 'z'), evenement('2026-12-17', 'bike', 'B', 'x · y', 'z')]),
    ])
    expect([a.cle, b.cle]).toEqual(['w7|e0', 'w7|e1'])
  })

  describe('optionnelle', () => {
    it('vraie quand le 6e élément est vrai', () => {
      expect(une('bike', 'Vélo de reprise', '30 min · Z1', 'Facile.', true).optionnelle).toBe(true)
    })

    it('fausse par défaut, et quand le 6e élément est faux', () => {
      expect(une('run', 'Footing', '40 min · Z1', 'Facile.').optionnelle).toBe(false)
      expect(une('run', 'Footing', '40 min · Z1', 'Facile.', false).optionnelle).toBe(false)
    })

    it.each([['Facultatif.'], ['Optionnel.'], ['Très facile, facultatif si fatigue.'], ['FACULTATIF'], ['optionnelle selon la forme']])(
      'vraie quand la consigne contient « facultatif » ou « optionnel » : %s',
      (consigne) => {
        expect(une('run', 'Footing entretien', '30 min · Z1', consigne).optionnelle).toBe(true)
      },
    )
  })

  describe('jalon, déduit du titre sans tenir compte de la casse', () => {
    it.each([
      ['run', '10 KM DU RAVENSBERG avec ta femme', 'Ravensberg'],
      ['run', 'Pi Marathon — relais', 'Pi Marathon'],
      ['run', 'PI MARATHON', 'Pi Marathon'],
      ['bike', 'LILLE-HARDELOT', 'Lille-Hardelot'],
      ['bike', 'Lille Hardelot', 'Lille-Hardelot'],
    ])('%s « %s » donne le jalon « %s »', (type, titre, jalon) => {
      expect(une(type, titre, 'x · y', 'z').jalon).toBe(jalon)
    })

    it.each([
      ['run', 'Footing facile'],
      ['bike', 'Vélo endurance'],
      ['run', 'LILLE-HARDELOT'], // Lille-Hardelot est une sortie vélo : une course à pied de ce nom n'est pas le jalon
    ])('%s « %s » n’est pas un jalon', (type, titre) => {
      expect(une(type, titre, 'x · y', 'z').jalon).toBeNull()
    })
  })

  describe('doublon du Ravensberg (semaine 12)', () => {
    const rav = (date) => evenement(date, 'run', '10 KM DU RAVENSBERG avec ta femme', '10 km · endurance fondamentale', 'Course plaisir.')
    const programme = (extra12 = []) => [
      semaine(12, '2027-01-18', '2027-01-24', [rav('2027-01-24'), ...extra12]),
      semaine(13, '2027-01-25', '2027-01-31', [evenement('2027-01-26', 'run', 'Footing facile', '30 min · Z1', 'x'), rav('2027-01-31')]),
    ]

    const retirer = (semaines) => retirerDoublonRavensberg(convertirSemaines(semaines))

    it('retire l’entrée de la semaine 12 et garde celle de la semaine 13', () => {
      const entrees = retirer(programme())
      expect(entrees.map((e) => e.cle)).toEqual(['w13|e0', 'w13|e1'])
      expect(entrees.filter((e) => e.jalon === 'Ravensberg').map((e) => e.date)).toEqual(['2027-01-31'])
    })

    it('les autres clés de la semaine 12 ne bougent pas après le retrait (rang calculé sur le fichier brut)', () => {
      const entrees = retirer(programme([evenement('2027-01-22', 'run', 'Footing', '30 min · Z1', 'x')]))
      expect(entrees.map((e) => e.cle)).toEqual(['w12|e1', 'w13|e0', 'w13|e1'])
    })

    it('échoue si le doublon est absent (le fichier a changé, rien n’est produit)', () => {
      const sansDoublon = [semaine(13, '2027-01-25', '2027-01-31', [rav('2027-01-31')])]
      expect(() => retirer(sansDoublon)).toThrow(/doublon/i)
    })

    it('échoue si la semaine 12 contient deux Ravensberg', () => {
      expect(() => retirer(programme([rav('2027-01-23')]))).toThrow(/doublon/i)
    })
  })
})

describe('extraireProgramme', () => {
  it('va du HTML aux entrées converties', () => {
    const html = page([
      semaine(12, '2027-01-18', '2027-01-24', [evenement('2027-01-24', 'run', '10 KM DU RAVENSBERG', '10 km · endurance fondamentale', 'x')]),
      semaine(13, '2027-01-25', '2027-01-31', [evenement('2027-01-31', 'run', '10 KM DU RAVENSBERG', '10 km · endurance fondamentale', 'x')]),
    ])
    expect(extraireProgramme(html)).toEqual([
      {
        cle: 'w13|e0', genre: 'course', date: '2027-01-31', titre: '10 KM DU RAVENSBERG', consigne: 'x',
        detail: '10 km · endurance fondamentale', optionnelle: false, jalon: 'Ravensberg',
      },
    ])
  })
})

// Fichier réel et JSON versionné : le JSON committé est exactement ce que le script produit à partir du HTML.
const source = join(racineWeb, '..', 'support', 'Programme_endurance_PandaMove_2027_Zwift_KICKR.html')
describe.skipIf(!existsSync(source))('fichier réel du programme 2027', () => {
  const entrees = () => extraireProgramme(readFileSync(source, 'utf8'))

  it('chemin par défaut du script = ce fichier', () => {
    expect(FICHIER_SOURCE_PAR_DEFAUT).toBe(source)
  })

  it('produit 113 entrées, dont 3 jalons et 7 optionnelles, avec des clés uniques', () => {
    const e = entrees()
    expect(e).toHaveLength(113)
    expect(new Set(e.map((x) => x.cle)).size).toBe(113)
    expect(e.filter((x) => x.jalon).map((x) => `${x.date}:${x.jalon}`)).toEqual([
      '2027-01-31:Ravensberg', '2027-03-14:Pi Marathon', '2027-06-06:Lille-Hardelot',
    ])
    expect(e.filter((x) => x.optionnelle)).toHaveLength(7)
  })

  it('le JSON versionné est à jour (relancer le script s’il diffère)', () => {
    const versionne = JSON.parse(readFileSync(join(racineWeb, 'src', 'features', 'calendar', 'seancesCardio', 'programme2027.json'), 'utf8'))
    expect(versionne).toEqual(entrees())
  })
})
