import { describe, expect, it, vi } from 'vitest'
import { codeBarresValide, ErreurOff, lireProduit, produitParCodeBarres, rechercherProduits } from './openFoodFacts'

const brut = {
  code: '3017620422003',
  product_name: 'Pâte à tartiner',
  brands: 'Nutella, Ferrero',
  serving_quantity: '15',
  serving_size: '15 g',
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9, fiber_100g: '3,4' },
}
const reponse = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut })

describe('lecture d’un produit Open Food Facts', () => {
  it('normalise un produit complet', () => {
    expect(lireProduit(brut)).toEqual({
      code: '3017620422003', nom: 'Pâte à tartiner', marque: 'Nutella', kcal: 539, proteines: 6.3, glucides: 57.5, lipides: 30.9, fibres: 3.4, portionG: 15, portionLabel: '15 g',
      uniteBase: 'g', mesures: [{ id: 'portion', libelle: 'portion', pluriel: 'portions', base: 15, detail: '15 g' }],
    })
  })

  it('nomme la portion de l’emballage et ajoute le paquet entier', () => {
    const p = lireProduit({ ...brut, serving_quantity: 25, serving_size: '2 biscuits (25 g)', product_quantity: '300', product_quantity_unit: 'g' })!
    expect(p.uniteBase).toBe('g')
    expect(p.mesures).toEqual([
      { id: 'biscuit', libelle: 'biscuit', pluriel: 'biscuits', base: 12.5, detail: '2 biscuits (25 g)' },
      { id: 'paquet', libelle: 'paquet', pluriel: 'paquets', base: 300 },
    ])
  })

  it('un liquide (contenance en cl ou L) a ses valeurs pour 100 ml, mesuré à la bouteille', () => {
    const p = lireProduit({ ...brut, serving_quantity: null, serving_size: null, quantity: '1,5 L' })!
    expect(p.uniteBase).toBe('ml')
    expect(p.mesures).toEqual([{ id: 'bouteille', libelle: 'bouteille', pluriel: 'bouteilles', base: 1500 }])
    const canette = lireProduit({ ...brut, serving_quantity: '330', serving_size: '1 canette (330 ml)', quantity: '33 cl' })!
    expect(canette.uniteBase).toBe('ml')
    // La canette entière vaut la portion : pas de doublon « bouteille »
    expect(canette.mesures).toEqual([{ id: 'canette', libelle: 'canette', pluriel: 'canettes', base: 330, detail: '1 canette (330 ml)' }])
  })

  it('sans contenance lisible : base en grammes et portion seule', () => {
    const p = lireProduit({ ...brut, quantity: 'grand format' })!
    expect(p.uniteBase).toBe('g')
    expect(p.mesures.map((m) => m.id)).toEqual(['portion'])
  })

  it('déduit l’énergie des kilojoules et borne les valeurs absurdes', () => {
    const p = lireProduit({ product_name: 'X', nutriments: { energy_100g: 1000, proteins_100g: 250, fat_100g: -3 } })!
    expect(p.kcal).toBe(239)
    expect(p.proteines).toBe(100)
    expect(p.lipides).toBe(0)
  })

  it.each([[null], ['x'], [{}], [{ product_name: 'X', nutriments: {} }], [{ nutriments: { 'energy-kcal_100g': 10, proteins_100g: 1 } }], [{ product_name: 'X', nutriments: { 'energy-kcal_100g': 10 } }]])('ignore un produit inexploitable : %j', (v) => {
    expect(lireProduit(v)).toBeNull()
  })
})

describe('appels', () => {
  it('valide le code-barres avant tout appel', async () => {
    expect(codeBarresValide('3017620422003')).toBe(true)
    expect(codeBarresValide('12ab')).toBe(false)
    const f = vi.fn()
    await expect(produitParCodeBarres('abc', f as unknown as typeof fetch)).rejects.toMatchObject({ code: 'introuvable' })
    expect(f).not.toHaveBeenCalled()
  })

  it('lit un produit par code-barres', async () => {
    const f = vi.fn(async () => reponse({ status: 1, product: brut }))
    const p = await produitParCodeBarres(' 3017620422003 ', f as unknown as typeof fetch)
    expect(p.nom).toBe('Pâte à tartiner')
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain('/api/v2/product/3017620422003.json')
  })

  it('distingue produit absent, produit sans valeurs et réseau', async () => {
    await expect(produitParCodeBarres('3017620422003', (async () => reponse({ status: 0 })) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'introuvable' })
    await expect(produitParCodeBarres('3017620422003', (async () => reponse({ status: 1, product: { product_name: 'X', nutriments: {} } })) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'incomplet' })
    await expect(produitParCodeBarres('3017620422003', (async () => reponse({}, 500)) as unknown as typeof fetch)).rejects.toMatchObject({ code: 'reseau' })
    await expect(produitParCodeBarres('3017620422003', (async () => { throw new TypeError('offline') }) as unknown as typeof fetch)).rejects.toBeInstanceOf(ErreurOff)
  })

  it('recherche par texte : n’appelle rien sous 2 caractères, écarte les produits sans valeurs', async () => {
    const f = vi.fn(async () => reponse({ products: [brut, { product_name: 'Sans valeurs', nutriments: {} }] }))
    expect(await rechercherProduits('a', f as unknown as typeof fetch)).toEqual([])
    expect(f).not.toHaveBeenCalled()
    const r = await rechercherProduits('pâte à tartiner', f as unknown as typeof fetch)
    expect(r).toHaveLength(1)
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain('search_terms=p%C3%A2te%20%C3%A0%20tartiner')
  })
})
