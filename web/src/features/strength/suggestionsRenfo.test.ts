import { describe, expect, it } from 'vitest'
import type { Db } from '../../core/db/Db'
import { MUSCLE_GROUPS, type MuscleGroup } from '../../core/db/types'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'
import { bilanInstance, resumesInstancesTerminees, tonnageBlocs7Jours, volumeVide, type BlocTonnage, type ResumeInstanceJouee } from '../stats/statsQueries'
import {
  alerteCharge, libelleDernierePratique, lireGroupesParSeance, resumesParSeance, suggererSeances, zonesEchauffement,
} from './suggestionsRenfo'

const volume = (partiel: Partial<Record<MuscleGroup, number>>) => ({ ...volumeVide(), ...partiel })
const seances = (m: Record<string, MuscleGroup[]>) => new Map(Object.entries(m))

describe('suggererSeances', () => {
  const v = volume({ PECTORAUX: 18, DOS: 16, EPAULES: 10, TRICEPS: 9, QUADRICEPS: 4, FESSIERS: 4, BICEPS: 8 })
  const modeles = seances({
    pull: ['DOS', 'BICEPS'],
    push: ['PECTORAUX', 'EPAULES', 'TRICEPS'],
    jambes: ['QUADRICEPS', 'FESSIERS', 'ISCHIO'],
  })

  it('classe en tête la séance qui travaille les groupes en retard, avec une explication chiffrée', () => {
    const s = suggererSeances(v, modeles)
    expect(s[0].seanceId).toBe('jambes')
    expect(s[0].enRetard.map((g) => [g.libelle, g.series])).toEqual([['Ischio-jambiers', 0], ['Quadriceps', 4], ['Fessiers', 4]])
    expect(s[0].explication).toContain('sont les moins travaillés ces deux semaines')
    expect(s[0].explication).toContain('contre 18 pour pectoraux')
    expect(s[0].plusTravailles.map((g) => g.groupe)).toEqual(['PECTORAUX', 'DOS', 'EPAULES'])
  })

  it('une séance qui ne touche aucun groupe en retard n’est jamais suggérée', () => {
    const s = suggererSeances(v, modeles)
    expect(s.map((x) => x.seanceId)).not.toContain('pull')
    expect(s.map((x) => x.seanceId)).not.toContain('push')
  })

  it('deux groupes à égalité : « N séries chacun » ; un seul : verbe au singulier', () => {
    const e = suggererSeances(volume({ PECTORAUX: 18, DOS: 16, QUADRICEPS: 4, FESSIERS: 4 }), seances({ j: ['QUADRICEPS', 'FESSIERS'] }))
    expect(e[0].explication).toMatch(/Quadriceps et fessiers sont les moins travaillés ces deux semaines \(4 séries chacun contre 18 pour pectoraux\)\./)
    const un = suggererSeances(volume({ PECTORAUX: 18, DOS: 16, MOLLETS: 2 }), seances({ m: ['MOLLETS'] }))
    expect(un[0].explication).toMatch(/^Mollets est le moins travaillé/)
  })

  it('moins de 8 séries sur la période, ou aucune : aucune suggestion', () => {
    expect(suggererSeances(volume({ PECTORAUX: 5, QUADRICEPS: 1 }), modeles)).toEqual([])
    expect(suggererSeances(volume({}), modeles)).toEqual([])
  })

  it('à score égal, l’ordre est stable (identifiant) ; « Autre » ne compte jamais comme retard', () => {
    const egal = suggererSeances(volume({ PECTORAUX: 20, MOLLETS: 1 }), seances({ b: ['MOLLETS'], a: ['MOLLETS'], z: ['AUTRE'] }))
    expect(egal.map((x) => x.seanceId)).toEqual(['a', 'b'])
  })

  it('tous les groupes équilibrés : rien à suggérer', () => {
    const tous = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 10])) as Record<MuscleGroup, number>
    expect(suggererSeances(tous, modeles)).toEqual([])
  })
})

describe('alerteCharge', () => {
  const bloc = (i: number, kg: number): BlocTonnage => ({ debut: `d${i}`, fin: `f${i}`, tonnageKg: kg })
  it('hausse de 30 % ou plus sur la moyenne des blocs précédents', () => {
    expect(alerteCharge([bloc(0, 5000), bloc(1, 6000), bloc(2, 5000), bloc(3, 6000), bloc(4, 7600)])).toEqual({ pourcentage: 38 }) // moyenne 5 500
    expect(alerteCharge([bloc(0, 5000), bloc(1, 6000), bloc(2, 5000), bloc(3, 6000), bloc(4, 7150)])).toEqual({ pourcentage: 30 })
  })
  it('sous le seuil, baisse, ou pas assez d’historique : rien', () => {
    expect(alerteCharge([bloc(0, 5000), bloc(1, 6000), bloc(2, 5000), bloc(3, 6000), bloc(4, 7000)])).toBeNull()
    expect(alerteCharge([bloc(0, 5000), bloc(1, 6000), bloc(2, 5000), bloc(3, 6000), bloc(4, 3000)])).toBeNull()
    expect(alerteCharge([bloc(0, 0), bloc(1, 0), bloc(2, 0), bloc(3, 4000), bloc(4, 9000)])).toBeNull() // un seul bloc précédent non vide
    expect(alerteCharge([bloc(0, 5000), bloc(1, 9000)])).toBeNull()
    expect(alerteCharge([])).toBeNull()
  })
})

describe('resumesParSeance et libellés', () => {
  const inst = (instanceId: string, seanceId: string, date: string, tonnageKg: number): ResumeInstanceJouee => ({ instanceId, seanceId, date, tonnageKg, series: 20, dureeS: 3000 })
  it('dernière fois et tendance de tonnage avec l’avant-dernière', () => {
    const r = resumesParSeance([inst('a', 's1', '2026-10-20', 6000), inst('b', 's1', '2026-11-10', 6240), inst('c', 's2', '2026-11-01', 3000)])
    expect(r.get('s1')).toEqual({ derniere: '2026-11-10', tendance: 4 })
    expect(r.get('s2')).toEqual({ derniere: '2026-11-01', tendance: null })
    expect(r.get('s3')).toBeUndefined()
  })
  it('tendance nulle quand un tonnage est à zéro (poids du corps)', () => {
    expect(resumesParSeance([inst('a', 's', '2026-10-01', 0), inst('b', 's', '2026-10-08', 900)]).get('s')!.tendance).toBeNull()
  })
  it('libellés : aujourd’hui, hier, il y a N jours', () => {
    expect(libelleDernierePratique('2026-11-14', '2026-11-14')).toBe('Aujourd’hui')
    expect(libelleDernierePratique('2026-11-13', '2026-11-14')).toBe('Hier')
    expect(libelleDernierePratique('2026-11-10', '2026-11-14')).toBe('il y a 4 jours')
  })
})

describe('zonesEchauffement', () => {
  it('zones du corps des groupes de la séance, dans l’ordre du corps', () => {
    expect(zonesEchauffement(['QUADRICEPS', 'FESSIERS', 'ISCHIO', 'MOLLETS'])).toEqual(['hanches', 'fessiers', 'quadriceps', 'ischios', 'mollets'])
  })
  it('au plus cinq zones, les plus fréquentes d’abord ; « Autre » n’en donne aucune', () => {
    const z = zonesEchauffement(['PECTORAUX', 'DOS', 'EPAULES', 'TRAPEZES', 'BICEPS', 'LOMBAIRES'])
    expect(z).toHaveLength(5)
    expect(z).toContain('epaules')
    expect(zonesEchauffement(['AUTRE'])).toEqual([])
    expect(zonesEchauffement([])).toEqual([])
  })
})

// ── Lectures en base ────────────────────────────────────────────────────────────────────────────────────────

const b = { user_id: 'u1', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }
let n = 0
const exercice = (db: Db, id: string, name: string, groupes: string[]) =>
  inserer(db, 'exercises', { ...b, id, name, category: 'OTHER', muscle_groups: JSON.stringify(groupes), muscle_primary: '', is_favorite: 0, is_custom: 1, is_bodyweight: 0 })
const modele = (db: Db, id: string, nom: string, archivee = 0) => inserer(db, 'seances', { ...b, id, nom, is_archived: archivee, created_at: 'c' })
const exoModele = (db: Db, id: string, seanceId: string, exerciseId: string) =>
  inserer(db, 'exercices_seance', { ...b, id, seance_id: seanceId, exercise_id: exerciseId, instance_seance_id: null, position: 0, reps_type: 'REPS' })
const joue = (db: Db, id: string, seanceId: string, date: string, termine = 1) =>
  inserer(db, 'instances_seance', { ...b, id, seance_id: seanceId, date, is_completed: termine, duration_seconds: 3000 })
async function serie(db: Db, instanceId: string, exerciseId: string, reps: number, charge: number) {
  n++
  const es = `es-${instanceId}-${exerciseId}`
  await db.execute('INSERT OR IGNORE INTO exercices_seance (id, user_id, updated_at, deleted_at, seance_id, exercise_id, instance_seance_id, position, reps_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [es, 'u1', '2026-01-01T00:00:00Z', null, 's1', exerciseId, instanceId, 0, 'REPS'])
  await inserer(db, 'series_realisees', { ...b, id: `sr-${String(n).padStart(4, '0')}`, instance_seance_id: instanceId, exercice_seance_id: es, numero_serie: n, reps_realisees: reps, charge_kg: charge, is_completed: 1, notes: '' })
}

describe('lireGroupesParSeance', () => {
  it('muscle principal de chaque exercice des séances types actives, sans doublon', async () => {
    const db = createTestDb()
    await exercice(db, 'dc', 'Développé', ['PECTORAUX', 'TRICEPS'])
    await exercice(db, 'ec', 'Écartés', ['PECTORAUX'])
    await exercice(db, 'sq', 'Squat', ['QUADRICEPS'])
    await modele(db, 'push', 'Push')
    await modele(db, 'ancien', 'Ancien', 1) // archivée : ignorée
    await exoModele(db, 'e1', 'push', 'dc')
    await exoModele(db, 'e2', 'push', 'ec')
    await exoModele(db, 'e3', 'push', 'sq')
    await exoModele(db, 'e4', 'ancien', 'sq')
    const m = await lireGroupesParSeance(db)
    expect(m.get('push')).toEqual(['PECTORAUX', 'QUADRICEPS'])
    expect(m.has('ancien')).toBe(false)
  })
})

describe('tonnage par blocs de 7 jours, résumés et bilan', () => {
  async function jeu() {
    const db = createTestDb()
    await exercice(db, 'sq', 'Squat', ['QUADRICEPS'])
    await exercice(db, 'dc', 'Développé couché', ['PECTORAUX'])
    await modele(db, 's1', 'Jambes')
    await modele(db, 's2', 'Push')
    await joue(db, 'i1', 's1', '2026-10-20')
    await serie(db, 'i1', 'sq', 5, 100) // 500 ; 1RM 116,67
    await joue(db, 'i2', 's1', '2026-11-03')
    await serie(db, 'i2', 'sq', 5, 100) // 500
    await serie(db, 'i2', 'dc', 8, 60) // 480
    await joue(db, 'i3', 's1', '2026-11-12')
    await serie(db, 'i3', 'sq', 5, 105) // 525 ; 1RM 122,5 : record
    await serie(db, 'i3', 'dc', 8, 60) // 480 ; 1RM 76 : record face à 76 ? non (égal)
    await joue(db, 'i4', 's2', '2026-11-11', 0) // non terminée : ignorée
    return db
  }

  it('blocs glissants de 7 jours, le dernier se terminant aujourd’hui', async () => {
    const db = await jeu()
    const blocs = await tonnageBlocs7Jours(db, '2026-11-14', 5)
    expect(blocs.map((x) => [x.debut, x.fin])).toEqual([
      ['2026-10-11', '2026-10-17'], ['2026-10-18', '2026-10-24'], ['2026-10-25', '2026-10-31'], ['2026-11-01', '2026-11-07'], ['2026-11-08', '2026-11-14'],
    ])
    expect(blocs.map((x) => x.tonnageKg)).toEqual([0, 500, 0, 980, 1005])
  })

  it('résumés des séances terminées : tonnage, séries, plus récentes d’abord', async () => {
    const db = await jeu()
    const r = await resumesInstancesTerminees(db, '2026-10-01')
    expect(r.map((x) => [x.instanceId, x.seanceId, x.tonnageKg, x.series, x.dureeS])).toEqual([
      ['i3', 's1', 1005, 2, 3000], ['i2', 's1', 980, 2, 3000], ['i1', 's1', 500, 1, 3000],
    ])
    expect((await resumesInstancesTerminees(db, '2026-11-01', '2026-11-10')).map((x) => x.instanceId)).toEqual(['i2'])
  })

  it('bilan : séance précédente du même modèle et records (1RM supérieur aux séances antérieures)', async () => {
    const db = await jeu()
    const bilan = (await bilanInstance(db, 'i3'))!
    expect(bilan.courante).toMatchObject({ instanceId: 'i3', tonnageKg: 1005, series: 2 })
    expect(bilan.precedente).toMatchObject({ instanceId: 'i2', tonnageKg: 980 })
    // Squat : 105 × 5 -> 122,5 contre 116,67 avant : record. Développé couché : 60 × 8 = 76 comme avant : pas un record.
    expect(bilan.records.map((x) => [x.nom, x.chargeKg, x.reps, x.rmKg, x.ancienRmKg])).toEqual([['Squat', 105, 5, 122.5, 116.67]])
  })

  it('première séance du modèle : pas de précédente, pas de record ; séance non terminée ou inconnue : null', async () => {
    const db = await jeu()
    const premiere = (await bilanInstance(db, 'i1'))!
    expect(premiere.precedente).toBeNull()
    expect(premiere.records).toEqual([])
    expect(await bilanInstance(db, 'i4')).toBeNull()
    expect(await bilanInstance(db, 'inconnue')).toBeNull()
  })
})
