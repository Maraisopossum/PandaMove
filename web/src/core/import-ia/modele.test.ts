import { beforeEach, describe, expect, it } from 'vitest'
import { TYPES_BLOC } from '../../features/strength/draft'
import { SYSTEMES_PROGRESSION, TYPES_EXERCICE } from '../../features/strength/edition/progressionConfig'
import { createTestDb } from '../../test/sqliteDb'
import { catalogueDeBase } from '../catalogue/catalogueDeBase'
import { installerCatalogueDeBase } from '../catalogue/installerCatalogue'
import { normalizeSearch } from '../common/normalizeSearch'
import type { Db } from '../db/Db'
import { creerExercice } from '../db/repos/exercises'
import { listSeanceTemplates } from '../db/repos/seances'
import { MUSCLE_GROUPS } from '../db/types'
import { analyserTexteIA } from './analyser'
import { appliquerImportIA, lireContextePlan } from './apply'
import { DEFAUTS, FORMAT_ID, NB_SEANCES_MAX, TYPES_BLOC_IA, validerFichierIA } from './format'
import { EXEMPLE, genererModeleIA, lireExercicesPersonnalises, listeExercices, schemaJson } from './modele'
import { planifierImportIA } from './planifier'

const USER = '11111111-1111-4111-8111-111111111111'

describe('genererModeleIA', () => {
  const m = genererModeleIA({ exercicesPersonnalises: [{ name: 'Dips lestés maison', musclePrimary: 'TRICEPS' }] })

  it('est pur : deux appels identiques donnent le même résultat', () => {
    expect(genererModeleIA()).toEqual(genererModeleIA())
  })

  it('contient le rôle, la règle de sortie, le schéma, les règles, l\'exemple et la demande', () => {
    expect(m.consigne).toMatch(/Tu es un coach/)
    expect(m.consigne).toMatch(/Réponds \*\*UNIQUEMENT par un bloc JSON valide\*\*/)
    expect(m.consigne).toMatch(/aucun commentaire/)
    expect(m.consigne).toContain('## Schéma du fichier')
    expect(m.consigne).toContain('## Règles de bon sens')
    expect(m.consigne).toContain('## Exemple complet')
    expect(m.consigne).toContain('## Exercices disponibles')
    expect(m.consigne.trimEnd().endsWith('Ma demande : …')).toBe(true)
    expect(m.consigne).toContain(m.exemple)
  })

  it('le tableau des champs liste chaque champ avec type, obligation et bornes', () => {
    expect(m.consigne).toContain('| `seances[].blocs[].exercices[].series` | entier | oui, sauf CIRCUIT | de 1 à 20 |')
    expect(m.consigne).toContain('| `seances[].blocs[].type` | texte | oui |')
    expect(m.consigne).toContain('| `seances[].notes` | texte | non | 2000 caractères max |')
    expect(m.consigne).toContain('| `seances[].blocs[].exercices[].reps` | texte ou entier |')
    expect(m.consigne).toContain('`seances[].blocs[].exercices[].progression.systeme`')
    expect(m.consigne).toContain('`seances[].blocs[].exercices[].muscles.principal`')
  })

  it('aucune dérive : toute valeur d\'énumération de la consigne et du schéma est celle du code', () => {
    const enums: string[][] = []
    const parcourir = (n: unknown) => {
      if (Array.isArray(n)) n.forEach(parcourir)
      else if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>
        if (Array.isArray(o.enum)) enums.push(o.enum as string[])
        Object.values(o).forEach(parcourir)
      }
    }
    parcourir(JSON.parse(m.schema))
    const attendues = [
      [...TYPES_BLOC_IA], // seances[].blocs[].type
      SYSTEMES_PROGRESSION.map((s) => s.valeur),
      TYPES_EXERCICE.map((t) => t.valeur),
      [...MUSCLE_GROUPS], // principal
      [...MUSCLE_GROUPS], // secondaires
    ]
    expect(enums).toHaveLength(attendues.length)
    for (const a of attendues) expect(enums).toContainEqual(a)
    expect(TYPES_BLOC_IA).toEqual(['LIBRE', ...TYPES_BLOC])
    for (const valeur of attendues.flat()) expect(m.consigne).toContain(`\`${valeur}\``)
    // Chaque valeur en MAJUSCULES citée dans les cellules « Valeurs » est connue du code
    const connues = new Set<string>([...attendues.flat(), 'PDC'])
    const cellules = m.consigne.split('\n').filter((l) => l.startsWith('| `')).map((l) => l.split('|')[4] ?? '')
    for (const c of cellules) for (const [, v] of c.matchAll(/`([A-Z_]+)`/g)) expect(connues.has(v)).toBe(true)
  })

  it('les défauts annoncés sont ceux de DEFAUTS', () => {
    expect(m.consigne).toContain(`repos entre séries ${DEFAUTS.reposSec} s`)
    expect(m.consigne).toContain(`${DEFAUTS.tours} tours`)
    expect(m.consigne).toContain(`+${DEFAUTS.incrementKg} kg`)
    expect(m.consigne).toContain(`1 à ${NB_SEANCES_MAX} séances`)
  })

  it('liste les exercices du catalogue de base et les personnalisés, groupés par muscle principal', () => {
    for (const e of catalogueDeBase()) expect(m.consigne).toContain(`- ${e.name}\n`.replace(/\n$/, ''))
    expect(m.consigne).toContain('### PECTORAUX (Pectoraux)')
    expect(m.consigne).toMatch(/### TRICEPS \(Triceps\)[\s\S]*- Dips lestés maison/)
    const liste = listeExercices([{ name: 'développé COUCHÉ barre', musclePrimary: 'PECTORAUX' }])
    expect(liste.match(/Développé couché barre/gi)).toHaveLength(1) // pas de doublon avec le catalogue
  })

  it('schema.json : JSON valide, objets fermés, titre', () => {
    const s = JSON.parse(m.schema) as ReturnType<typeof schemaJson>
    expect(s.title).toMatch(/séances/)
    expect(s.additionalProperties).toBe(false)
    expect(s.required).toEqual(['format', 'version', 'seances'])
    expect(s.properties?.format.const).toBe(FORMAT_ID)
  })

  it('exemple.json : JSON valide, identique à l\'exemple de la consigne, sans le moindre commentaire', () => {
    expect(JSON.parse(m.exemple)).toEqual(EXEMPLE)
    expect(m.exemple).not.toMatch(/\/\/|\/\*/)
  })
})

describe("l'exemple généré est accepté et s'importe (aller-retour)", () => {
  let db: Db
  beforeEach(async () => {
    db = createTestDb()
    await installerCatalogueDeBase(db, USER)
  })

  it('accepté par le validateur, sans erreur ni avertissement', () => {
    const r = validerFichierIA(JSON.parse(genererModeleIA().exemple))
    expect(r.erreurs).toEqual([])
    expect(r.avertissements).toEqual([])
  })

  it('utilise tous les types de bloc, et seuls des noms du catalogue (hors le nouvel exercice annoncé)', () => {
    const blocs = EXEMPLE.seances.flatMap((s) => s.blocs)
    expect(new Set(blocs.map((b) => b.type))).toEqual(new Set(TYPES_BLOC_IA))
    const base = new Set(catalogueDeBase().map((e) => normalizeSearch(e.name)))
    const hors = blocs.flatMap((b) => b.exercices).map((e) => e.exercice).filter((n) => !base.has(normalizeSearch(n)))
    expect(hors).toEqual(['Étirement des pectoraux au mur'])
  })

  it('analyse du texte de la consigne : le bloc ```json de la consigne s\'importe tel quel', async () => {
    const m = genererModeleIA()
    const analyse = analyserTexteIA(m.consigne) // la consigne entière contient un seul bloc json
    expect(analyse.erreurs).toEqual([])
    const plan = planifierImportIA(analyse.donnees!, await lireContextePlan(db, USER))
    expect(plan.erreurs).toEqual([])
    expect(plan.seances.map((s) => s.statut)).toEqual(['nouvelle', 'nouvelle'])
    expect(plan.exercicesACreer.map((e) => e.nom)).toEqual(['Étirement des pectoraux au mur'])
    expect(plan.seances.flatMap((s) => s.reconnus).every((r) => r.via === 'exact')).toBe(true)
    expect(plan.seances.flatMap((s) => s.avertissements)).toEqual([])

    const r = await appliquerImportIA(db, plan, USER)
    expect(r).toEqual({ seances: 2, ignorees: 0, exercicesCrees: 1 })
    expect((await listSeanceTemplates(db)).map((s) => s.nom).sort()).toEqual(['Haut du corps – force', 'Jambes et gainage'])

    // Réimport : rien de nouveau
    const plan2 = planifierImportIA(analyse.donnees!, await lireContextePlan(db, USER))
    expect(await appliquerImportIA(db, plan2, USER)).toEqual({ seances: 0, ignorees: 2, exercicesCrees: 0 })
  })

  it('les exercices personnalisés de la base entrent dans la consigne', async () => {
    await creerExercice(db, USER, { name: 'Mon exercice perso', muscleGroups: ['DOS'], musclePrimary: 'DOS' })
    const perso = await lireExercicesPersonnalises(db)
    expect(perso).toEqual([{ name: 'Mon exercice perso', musclePrimary: 'DOS' }])
    expect(genererModeleIA({ exercicesPersonnalises: perso }).consigne).toMatch(/### DOS \(Dos\)[\s\S]*- Mon exercice perso/)
  })
})
