// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../../../core/db/Db'
import { lireSorties } from '../../../core/db/repos/sorties'
import { createTestDb } from '../../../test/sqliteDb'
import { convertirActiviteFit, ErreurImportFit, reduire, type ActiviteFit } from './convertirFit'
import { extraireFitDuZip } from './lireFichier'
import { useImportFit } from './useImportFit'

const points = (n: number, avec: Partial<ActiviteFit['records'] extends (infer R)[] | undefined ? R : never> = {}) =>
  Array.from({ length: n }, (_, i) => ({ timestamp: new Date(Date.UTC(2026, 10, 5, 7, 37, i)), distance: i * 3, speed: 3, altitude: 25, ...avec }))

// Course Suunto : session complète, cadence en foulées par minute
const suunto = (): ActiviteFit => ({
  file_ids: [{ manufacturer: 'suunto' }],
  sessions: [{ sport: 'running', start_time: new Date('2026-11-05T07:37:22Z'), total_elapsed_time: 3106.76, total_timer_time: 3022.15, total_distance: 7232, total_ascent: 44, total_descent: 39, avg_heart_rate: 141, max_heart_rate: 165, avg_power: 201, max_power: 372, normalized_power: 207, avg_cadence: 81 }],
  laps: [{ total_distance: 1000, total_timer_time: 397, avg_heart_rate: 150 }],
  records: points(10, { position_lat: 50.65, position_long: 3.07, heart_rate: 140 }),
})

// Vélo Garmin sans capteur : ni FC ni puissance, session sans vitesse moyenne
const garmin = (): ActiviteFit => ({
  file_ids: [{ manufacturer: 'garmin' }],
  sessions: [{ sport: 'cycling', sub_sport: 'road', start_time: new Date('2026-09-30T05:43:37Z'), total_elapsed_time: 1917.5, total_timer_time: 1826.5, total_distance: 10559.28, total_ascent: 48, avg_cadence: 73 }],
  records: points(10, { position_lat: 50.66, position_long: 3.07 }),
})

// Vélo MyWoosh : capteurs complets, GPS fictif
const mywoosh = (): ActiviteFit => ({
  file_ids: [{ manufacturer: 'mywhoosh' }],
  sessions: [{ sport: 'cycling', sub_sport: 'virtual_activity', start_time: new Date('2026-11-07T18:55:06Z'), total_elapsed_time: 1685, total_timer_time: 1685, total_distance: 7024.17, avg_heart_rate: 103, max_heart_rate: 113, avg_power: 91, max_power: 98, avg_cadence: 71 }],
  records: points(10, { position_lat: -19.25, position_long: 146.7, heart_rate: 100, power: 90 }),
})

describe('convertirActiviteFit', () => {
  it('course Suunto : métriques de la session, cadence doublée en pas par minute, tracé conservé', () => {
    const s = convertirActiviteFit(suunto())
    expect(s).toMatchObject({ sport: 'course', source: 'suunto', enSalle: false, dureeS: 3107, dureeDeplacementS: 3022, distanceM: 7232, fcMoy: 141, fcMax: 165, puissanceMoyW: 201, puissanceNormW: 207, cadenceMoy: 162, denivelePosM: 44, deniveleNegM: 39 })
    expect(JSON.parse(s.tours as string)).toEqual([{ distanceM: 1000, dureeS: 397, fcMoy: 150 }])
    expect(JSON.parse(s.trace as string)).toHaveLength(10)
    expect(s.empreinte).toBe('course|2026-11-05T07:37:22.000Z|3107')
  })

  it('vélo Garmin sans capteur : pas de FC ni de puissance, cadence telle quelle, source garmin', () => {
    const s = convertirActiviteFit(garmin())
    expect(s).toMatchObject({ sport: 'velo', source: 'garmin', enSalle: false, titre: 'Sortie vélo', fcMoy: null, fcMax: null, puissanceMoyW: null, cadenceMoy: 73, distanceM: 10559 })
  })

  it('vélo Garmin avec cardiofréquencemètre : FC calculée sur les points quand la session ne la donne pas', () => {
    const fit = garmin()
    fit.records = points(10, { position_lat: 50.66, position_long: 3.07, heart_rate: 130 }).map((p, i) => (i === 9 ? { ...p, heart_rate: 150 } : p))
    expect(convertirActiviteFit(fit)).toMatchObject({ fcMoy: 132, fcMax: 150 })
  })

  it('vélo MyWoosh : sortie en salle, sans tracé (GPS fictif), source mywoosh', () => {
    const s = convertirActiviteFit(mywoosh())
    expect(s).toMatchObject({ source: 'mywoosh', enSalle: true, titre: 'Sortie vélo en salle', fcMoy: 103, puissanceMoyW: 91 })
    expect(s.trace).toBeNull()
  })

  it('refuse un sport non pris en charge, une session absente et une date introuvable', () => {
    const marche = suunto()
    marche.sessions![0].sport = 'walking'
    expect(() => convertirActiviteFit(marche)).toThrow(ErreurImportFit)
    expect(() => convertirActiviteFit({})).toThrow('session absente')
    const sansDate = suunto()
    delete sansDate.sessions![0].start_time
    expect(() => convertirActiviteFit(sansDate)).toThrow('Date de départ')
  })

  it('ne dépasse pas les bornes de la base (FC absurde ignorée, FC max jamais sous la moyenne)', () => {
    const fit = suunto()
    fit.sessions![0].avg_heart_rate = 999
    fit.sessions![0].max_heart_rate = 120
    fit.records = points(5, { position_lat: 1, position_long: 1, heart_rate: 130 })
    expect(convertirActiviteFit(fit)).toMatchObject({ fcMoy: 130, fcMax: 130 })
  })
})

describe('reduire', () => {
  it("garde le premier et le dernier élément et n'en renvoie pas plus que demandé", () => {
    const r = reduire(Array.from({ length: 1000 }, (_, i) => i), 300)
    expect(r).toHaveLength(300)
    expect([r[0], r[299]]).toEqual([0, 999])
    expect(reduire([1, 2, 3], 300)).toEqual([1, 2, 3])
  })
})

// Archive zip minimale à une entrée (méthode stockée ou deflate)
async function zip(nom: string, contenu: Uint8Array, deflate: boolean): Promise<Uint8Array> {
  const donnees = deflate ? new Uint8Array(await new Response(new Response(contenu as BodyInit).body!.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : contenu
  const n = new TextEncoder().encode(nom)
  const local = new Uint8Array(30 + n.length)
  const lv = new DataView(local.buffer)
  lv.setUint32(0, 0x04034b50, true)
  lv.setUint16(8, deflate ? 8 : 0, true)
  lv.setUint32(18, donnees.length, true)
  lv.setUint32(22, contenu.length, true)
  lv.setUint16(26, n.length, true)
  local.set(n, 30)
  const central = new Uint8Array(46 + n.length)
  const cv = new DataView(central.buffer)
  cv.setUint32(0, 0x02014b50, true)
  cv.setUint16(10, deflate ? 8 : 0, true)
  cv.setUint32(20, donnees.length, true)
  cv.setUint32(24, contenu.length, true)
  cv.setUint16(28, n.length, true)
  cv.setUint32(42, 0, true)
  central.set(n, 46)
  const fin = new Uint8Array(22)
  const fv = new DataView(fin.buffer)
  fv.setUint32(0, 0x06054b50, true)
  fv.setUint16(10, 1, true)
  fv.setUint32(12, central.length, true)
  fv.setUint32(16, local.length + donnees.length, true)
  return Uint8Array.from([...local, ...donnees, ...central, ...fin])
}

describe('extraireFitDuZip', () => {
  const contenu = Uint8Array.from({ length: 500 }, (_, i) => i % 7)
  it.each([false, true])('extrait le fichier .fit (deflate : %s)', async (deflate) => {
    expect(await extraireFitDuZip(await zip('123_ACTIVITY.fit', contenu, deflate))).toEqual(contenu)
  })
  it("refuse une archive sans .fit ou illisible", async () => {
    await expect(extraireFitDuZip(await zip('notes.txt', contenu, false))).rejects.toThrow('Aucun fichier .fit')
    await expect(extraireFitDuZip(new Uint8Array(40))).rejects.toThrow('illisible')
  })
})

describe('useImportFit', () => {
  let db: Db
  beforeEach(() => {
    db = createTestDb()
  })
  const fichier = (nom: string) => new File(['x'], nom)
  const lecture = (parNom: Record<string, ActiviteFit | Error>) => async (f: File) => {
    const v = parNom[f.name]
    if (v instanceof Error) throw v
    return v
  }

  it('importe, signale un doublon à la deuxième fois et un échec sans bloquer les autres fichiers', async () => {
    let relu = 0
    const { result } = renderHook(() =>
      useImportFit({ db, apres: () => void relu++, lire: lecture({ 'a.fit': suunto(), 'b.fit': garmin(), 'c.fit': new ErreurImportFit('Fichier FIT illisible ou endommagé.') }) }),
    )
    await act(() => result.current.importer([fichier('a.fit'), fichier('b.fit'), fichier('c.fit')]))
    expect(result.current.resultats.map((r) => r.etat)).toEqual(['importee', 'importee', 'erreur'])
    expect(relu).toBe(1)
    expect((await lireSorties(db)).map((s) => s.source).sort()).toEqual(['garmin', 'suunto'])

    await act(() => result.current.importer([fichier('a.fit')]))
    expect(result.current.resultats[0].etat).toBe('doublon')
    expect(await lireSorties(db)).toHaveLength(2)
    expect(relu).toBe(1)
  })
})

describe('lien avec une séance du calendrier', () => {
  it('propose les séances programmées proches du même sport, la plus proche d\'abord, puis lie et valide', async () => {
    const db = createTestDb()
    const { creer: creerCardio, lireParId } = await import('../../../core/db/repos/seancesCardio')
    await creerCardio(db, 'course', { id: 'c-loin', date: '2026-11-09', titre: 'Loin', consigne: null, detail: null, optionnelle: false, jalon: null })
    await creerCardio(db, 'course', { id: 'c-jour', date: '2026-11-05', titre: 'Du jour', consigne: null, detail: null, optionnelle: false, jalon: null })
    await creerCardio(db, 'course', { id: 'c-trop', date: '2026-11-20', titre: 'Trop loin', consigne: null, detail: null, optionnelle: false, jalon: null })
    await creerCardio(db, 'velo', { id: 'v-jour', date: '2026-11-05', titre: 'Vélo', consigne: null, detail: null, optionnelle: false, jalon: null })
    const { result } = renderHook(() => useImportFit({ db, lire: async () => suunto() }))
    await act(() => result.current.importer([new File(['x'], 'a.fit')]))
    const r = result.current.resultats[0]
    expect(r.candidats?.map((s) => s.id)).toEqual(['c-jour', 'c-loin'])

    await act(() => result.current.lier(r.sortieId as string, 'c-jour'))
    expect(result.current.resultats[0].liee?.id).toBe('c-jour')
    expect((await lireParId(db, 'course', 'c-jour'))?.isValidated).toBe(true)
    expect((await lireParId(db, 'course', 'c-loin'))?.isValidated).toBe(false)
    expect((await lireSorties(db))[0].seanceId).toBe('c-jour')
  })
})
