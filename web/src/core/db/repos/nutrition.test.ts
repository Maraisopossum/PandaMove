import { describe, expect, it } from 'vitest'
import { createTestDb } from '../../../test/sqliteDb'
import {
  ajouterEau, ajouterEntree, ajouterEntrees, alimentsFrequents, basculerFavori, copierRepas, creerAliment, enregistrerObjectifsNutrition, ErreurNutrition, lireAliment, lireAlimentParCodeBarres,
  lireEntree, lireJour, lireObjectifsNutrition, lireTotauxParJour, listerAliments, modifierAliment, modifierEntree, restaurerEntree, supprimerAliment, supprimerEntree,
} from './nutrition'

const apport = (kcal: number) => ({ kcal, proteines: kcal / 20, glucides: kcal / 10, lipides: kcal / 40, fibres: 1 })
const entree = (over: Partial<Parameters<typeof ajouterEntree>[1]> = {}) => ({ date: '2026-11-15', repas: 'dejeuner' as const, nom: 'Riz', quantiteG: 150, apport: apport(195), ...over })
const aliment = { nom: 'Skyr', kcal100: 63, proteines100: 11, glucides100: 4, lipides100: 0.2 }

describe('aliments personnels', () => {
  it('se créent, se relisent, se modifient et se suppriment logiquement', async () => {
    const db = createTestDb()
    const id = await creerAliment(db, { ...aliment, marque: ' Danone ', codeBarres: '3017620422003', portionG: 150, portionLabel: '1 pot' })
    expect(await lireAliment(db, id)).toMatchObject({ nom: 'Skyr', marque: 'Danone', codeBarres: '3017620422003', portionG: 150, portionLabel: '1 pot', kcal100: 63, favori: false, source: 'manuel', fibres100: null })
    await modifierAliment(db, id, { ...aliment, kcal100: 65 })
    expect((await lireAliment(db, id))?.kcal100).toBe(65)
    await supprimerAliment(db, id)
    expect(await lireAliment(db, id)).toBeNull()
    expect(await listerAliments(db)).toEqual([])
    await expect(supprimerAliment(db, id)).rejects.toMatchObject({ code: 'introuvable' })
  })

  it('met les favoris en premier et retrouve un aliment par code-barres', async () => {
    const db = createTestDb()
    const a = await creerAliment(db, { ...aliment, nom: 'Zèbre', codeBarres: '12345678' })
    const b = await creerAliment(db, { ...aliment, nom: 'Abricot' })
    expect((await listerAliments(db)).map((x) => x.nom)).toEqual(['Abricot', 'Zèbre'])
    await basculerFavori(db, a)
    expect((await listerAliments(db)).map((x) => x.nom)).toEqual(['Zèbre', 'Abricot'])
    await basculerFavori(db, a)
    expect((await lireAliment(db, a))?.favori).toBe(false)
    expect((await lireAlimentParCodeBarres(db, '12345678'))?.id).toBe(a)
    expect(await lireAlimentParCodeBarres(db, '99999999')).toBeNull()
    expect(b).not.toBe(a)
  })

  it.each([
    [{ ...aliment, nom: '  ' }, /nom/],
    [{ ...aliment, nom: 'x'.repeat(201) }, /trop long/],
    [{ ...aliment, kcal100: -1 }, /énergie/],
    [{ ...aliment, kcal100: 1001 }, /énergie/],
    [{ ...aliment, proteines100: 101 }, /protéines/],
    [{ ...aliment, portionG: 0 }, /portion/],
    [{ ...aliment, codeBarres: 'abc' }, /Code-barres/],
    [{ ...aliment, kcal100: Number.NaN }, /énergie/],
  ])('refuse une saisie invalide %#', async (saisie, message) => {
    await expect(creerAliment(createTestDb(), saisie)).rejects.toThrow(message)
    await expect(creerAliment(createTestDb(), saisie)).rejects.toBeInstanceOf(ErreurNutrition)
  })
})

describe('journal', () => {
  it('lit les lignes d’un jour dans l’ordre de saisie, sans les jours voisins ni les lignes supprimées', async () => {
    const db = createTestDb()
    const a = await ajouterEntree(db, entree({ nom: 'Riz' }))
    await new Promise((r) => setTimeout(r, 3))
    const b = await ajouterEntree(db, entree({ nom: 'Poulet', repas: 'diner' }))
    await ajouterEntree(db, entree({ date: '2026-11-14', nom: 'Hier' }))
    await supprimerEntree(db, b)
    expect((await lireJour(db, '2026-11-15')).map((e) => e.nom)).toEqual(['Riz'])
    expect(await lireEntree(db, a)).toMatchObject({ repas: 'dejeuner', quantiteG: 150, apport: { kcal: 195 }, source: 'manuel', alimentId: null })
    expect(await lireEntree(db, b)).toBeNull()
  })

  it('une suppression s’annule : la ligne revient, une ligne jamais supprimée ou inconnue est refusée', async () => {
    const db = createTestDb()
    const a = await ajouterEntree(db, entree({ nom: 'Riz' }))
    await supprimerEntree(db, a)
    expect(await lireEntree(db, a)).toBeNull()
    await restaurerEntree(db, a)
    expect(await lireEntree(db, a)).toMatchObject({ nom: 'Riz' })
    await expect(restaurerEntree(db, a)).rejects.toBeInstanceOf(ErreurNutrition)
    await expect(restaurerEntree(db, 'inconnue')).rejects.toBeInstanceOf(ErreurNutrition)
  })

  it('l’eau est une ligne à part, qui ne compte pas dans les apports', async () => {
    const db = createTestDb()
    await ajouterEau(db, '2026-11-15', 250)
    await ajouterEau(db, '2026-11-15', 500)
    await ajouterEntree(db, entree())
    const jour = await lireJour(db, '2026-11-15')
    expect(jour.filter((e) => e.repas === 'eau').map((e) => e.quantiteG).sort((x, y) => x - y)).toEqual([250, 500])
    const [t] = await lireTotauxParJour(db, '2026-11-15', '2026-11-15')
    expect(t).toMatchObject({ date: '2026-11-15', eauMl: 750, apport: { kcal: 195 } })
    await expect(ajouterEau(db, '2026-11-15', 0)).rejects.toThrow(/quantité d’eau/)
    await expect(ajouterEau(db, '2026-13-45', 250)).rejects.toThrow(/Date/)
  })

  it('modifie la quantité et le repas d’une entrée, jamais sa date', async () => {
    const db = createTestDb()
    const id = await ajouterEntree(db, entree())
    await modifierEntree(db, id, { repas: 'diner', quantiteG: 300, apport: apport(390) })
    expect(await lireEntree(db, id)).toMatchObject({ date: '2026-11-15', repas: 'diner', quantiteG: 300, apport: { kcal: 390 } })
    await expect(modifierEntree(db, 'inconnu', { repas: 'diner', quantiteG: 1, apport: apport(1) })).rejects.toMatchObject({ code: 'introuvable' })
  })

  it.each([
    [{ nom: '' }, /nom/], [{ quantiteG: -1 }, /quantité/], [{ apport: apport(20_001) }, /énergie/], [{ date: '2026-02-30' }, /Date/], [{ repas: 'brunch' as never }, /Repas/],
  ])('refuse une entrée invalide %#', async (surcharge, message) => {
    await expect(ajouterEntree(createTestDb(), entree(surcharge))).rejects.toThrow(message)
  })

  it('ajoute plusieurs entrées en tout ou rien', async () => {
    const db = createTestDb()
    const ids = await ajouterEntrees(db, [entree({ nom: 'A' }), entree({ nom: 'B', source: 'ia' })])
    expect(ids).toHaveLength(2)
    await expect(ajouterEntrees(db, [entree({ nom: 'C' }), entree({ nom: '' })])).rejects.toThrow()
    expect((await lireJour(db, '2026-11-15')).map((e) => e.nom).sort()).toEqual(['A', 'B'])
    expect((await lireJour(db, '2026-11-15')).find((e) => e.nom === 'B')?.source).toBe('ia')
  })

  it('copie un repas vers un autre jour, avec la source « copie »', async () => {
    const db = createTestDb()
    await ajouterEntree(db, entree({ date: '2026-11-14', nom: 'Pâtes' }))
    await ajouterEntree(db, entree({ date: '2026-11-14', nom: 'Salade', repas: 'diner' }))
    expect(await copierRepas(db, '2026-11-14', 'dejeuner', '2026-11-15')).toBe(1)
    expect(await copierRepas(db, '2026-11-10', 'dejeuner', '2026-11-15')).toBe(0)
    const jour = await lireJour(db, '2026-11-15')
    expect(jour).toHaveLength(1)
    expect(jour[0]).toMatchObject({ nom: 'Pâtes', repas: 'dejeuner', source: 'copie' })
  })

  it('classe les aliments fréquents par nombre de saisies, avec la dernière quantité', async () => {
    const db = createTestDb()
    await ajouterEntree(db, entree({ date: '2026-11-10', nom: 'Banane', quantiteG: 100 }))
    await ajouterEntree(db, entree({ date: '2026-11-12', nom: 'banane', quantiteG: 120 }))
    await ajouterEntree(db, entree({ date: '2026-11-13', nom: 'Riz' }))
    await ajouterEntree(db, entree({ date: '2026-09-01', nom: 'Trop ancien' }))
    await ajouterEau(db, '2026-11-13', 250)
    const f = await alimentsFrequents(db, '2026-10-01')
    expect(f.map((x) => [x.nom, x.fois])).toEqual([['banane', 2], ['Riz', 1]])
    expect(f[0].quantiteG).toBe(120)
  })

  it('totalise par jour sur une période', async () => {
    const db = createTestDb()
    await ajouterEntree(db, entree({ date: '2026-11-13', apport: apport(500) }))
    await ajouterEntree(db, entree({ date: '2026-11-15', apport: apport(300) }))
    await ajouterEntree(db, entree({ date: '2026-11-15', apport: apport(200) }))
    await ajouterEntree(db, entree({ date: '2026-11-20', apport: apport(999) }))
    const t = await lireTotauxParJour(db, '2026-11-13', '2026-11-15')
    expect(t.map((j) => [j.date, j.apport.kcal])).toEqual([['2026-11-13', 500], ['2026-11-15', 500]])
  })
})

describe('objectifs', () => {
  it('une seule ligne vivante : enregistrer met à jour', async () => {
    const db = createTestDb()
    expect(await lireObjectifsNutrition(db)).toBeNull()
    await enregistrerObjectifsNutrition(db, { kcal: 2500, proteinesG: 150, glucidesG: 280, lipidesG: 80, eauMl: 2500, profilJson: '{"age":35}' })
    await enregistrerObjectifsNutrition(db, { kcal: 2300.4, proteinesG: 150, glucidesG: 250, lipidesG: 75, eauMl: 2500 })
    expect(await lireObjectifsNutrition(db)).toMatchObject({ kcal: 2300, proteinesG: 150, glucidesG: 250, lipidesG: 75, eauMl: 2500, profilJson: null })
    expect((await db.getAll('SELECT id FROM objectifs_nutrition WHERE deleted_at IS NULL')).length).toBe(1)
  })

  it.each([[{ kcal: 100 }, /énergie/], [{ proteinesG: -1 }, /protéines/], [{ eauMl: 30_000 }, /eau/], [{ profilJson: 'x'.repeat(2001) }, /profil/]])('refuse des objectifs invalides %#', async (surcharge, message) => {
    await expect(enregistrerObjectifsNutrition(createTestDb(), { kcal: 2000, proteinesG: 100, glucidesG: 200, lipidesG: 60, eauMl: 2000, ...surcharge })).rejects.toThrow(message)
  })
})

describe('unités de mesure (migration 0022)', () => {
  const oeuf = { id: 'oeuf', libelle: 'œuf', pluriel: 'œufs', base: 60 }

  it('un aliment garde sa base et ses mesures ; la portion unique suit la première mesure', async () => {
    const db = createTestDb()
    const id = await creerAliment(db, { ...aliment, nom: 'Œuf', uniteBase: 'g', mesures: [oeuf] })
    expect(await lireAliment(db, id)).toMatchObject({ uniteBase: 'g', mesures: [oeuf], portionG: 60, portionLabel: '1 œuf' })
    const lait = await creerAliment(db, { ...aliment, nom: 'Lait', uniteBase: 'ml' })
    expect(await lireAliment(db, lait)).toMatchObject({ uniteBase: 'ml', mesures: [] })
  })

  it('modifier sans base ni mesures (formulaire actuel) garde celles enregistrées', async () => {
    const db = createTestDb()
    const id = await creerAliment(db, { ...aliment, nom: 'Lait', uniteBase: 'ml', mesures: [{ id: 'brique', libelle: 'brique', pluriel: 'briques', base: 1000 }] })
    await modifierAliment(db, id, { ...aliment, nom: 'Lait demi-écrémé', portionG: 250, portionLabel: '1 verre' })
    expect(await lireAliment(db, id)).toMatchObject({ nom: 'Lait demi-écrémé', uniteBase: 'ml', mesures: [{ id: 'brique', base: 1000 }], portionG: 250, portionLabel: '1 verre' })
    await modifierAliment(db, id, { ...aliment, uniteBase: 'g', mesures: [] })
    expect(await lireAliment(db, id)).toMatchObject({ uniteBase: 'g', mesures: [] })
  })

  it('un aliment sans mesures enregistrées reprend son ancienne portion', async () => {
    const db = createTestDb()
    const id = await creerAliment(db, { ...aliment, portionG: 125, portionLabel: '1 pot' })
    expect((await lireAliment(db, id))?.mesures).toEqual([{ id: 'portion', libelle: 'portion', pluriel: 'portions', base: 125, detail: '1 pot' }])
    const sans = await creerAliment(db, aliment)
    expect((await lireAliment(db, sans))?.mesures).toEqual([])
  })

  it('refuse une base inconnue et des mesures invalides', async () => {
    const db = createTestDb()
    await expect(creerAliment(db, { ...aliment, uniteBase: 'l' as 'g' })).rejects.toThrow(/Base inconnue/)
    await expect(creerAliment(db, { ...aliment, mesures: [{ ...oeuf, base: 0 }] })).rejects.toThrow(/entre 0 et 5000/)
    await expect(creerAliment(db, { ...aliment, mesures: [oeuf, oeuf] })).rejects.toThrow(/même nom/)
  })

  it('le journal garde la quantité saisie et son unité, jusque dans la copie et les fréquents', async () => {
    const db = createTestDb()
    const id = await ajouterEntree(db, entree({ nom: 'Œuf', quantiteG: 120, quantiteSaisie: 2, uniteSaisie: 'oeuf' }))
    expect(await lireEntree(db, id)).toMatchObject({ quantiteG: 120, quantiteSaisie: 2, uniteSaisie: 'oeuf' })
    await copierRepas(db, '2026-11-15', 'dejeuner', '2026-11-16')
    expect((await lireJour(db, '2026-11-16'))[0]).toMatchObject({ quantiteSaisie: 2, uniteSaisie: 'oeuf' })
    expect((await alimentsFrequents(db, '2026-11-01'))[0]).toMatchObject({ nom: 'Œuf', quantiteSaisie: 2, uniteSaisie: 'oeuf' })
  })

  it('une quantité sans unité (ou l’inverse) est ignorée, et modifier sans unité repasse en grammes', async () => {
    const db = createTestDb()
    const a = await ajouterEntree(db, entree({ quantiteSaisie: 2 }))
    const b = await ajouterEntree(db, entree({ uniteSaisie: 'oeuf' }))
    expect(await lireEntree(db, a)).toMatchObject({ quantiteSaisie: null, uniteSaisie: null })
    expect(await lireEntree(db, b)).toMatchObject({ quantiteSaisie: null, uniteSaisie: null })
    const c = await ajouterEntree(db, entree({ quantiteG: 120, quantiteSaisie: 2, uniteSaisie: 'oeuf' }))
    await modifierEntree(db, c, { repas: 'dejeuner', quantiteG: 90, apport: apport(130) })
    expect(await lireEntree(db, c)).toMatchObject({ quantiteG: 90, quantiteSaisie: null, uniteSaisie: null })
    await modifierEntree(db, c, { repas: 'dejeuner', quantiteG: 180, quantiteSaisie: 3, uniteSaisie: 'oeuf', apport: apport(260) })
    expect(await lireEntree(db, c)).toMatchObject({ quantiteG: 180, quantiteSaisie: 3, uniteSaisie: 'oeuf' })
  })

  it('une entrée d’eau n’a pas de saisie', async () => {
    const db = createTestDb()
    const id = await ajouterEau(db, '2026-11-15', 250)
    expect(await lireEntree(db, id)).toMatchObject({ quantiteG: 250, quantiteSaisie: null, uniteSaisie: null })
  })
})
