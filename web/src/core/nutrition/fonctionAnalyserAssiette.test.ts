import { describe, expect, it, vi } from 'vitest'
import { ErreurAnalyse, executer, lireDemande, nettoyerAnalyse, TAILLE_IMAGE_MAX, type PortsAnalyse } from '../../../supabase/functions/analyser-assiette/analyse'
import { analyserAssiette, apportEstime } from './photo'
import type { ClientSupabase } from '../db/clientSupabase'

const image = 'A'.repeat(200)
const brut = {
  est_un_repas: true,
  remarque: ' Huile de cuisson probable. ',
  aliments: [
    { nom: ' Riz blanc ', quantite_g: 148.6, kcal_100: 130, proteines_100: 2.74, glucides_100: 28, lipides_100: 0.3, fibres_100: 0.4, confiance: 'haute' },
    { nom: 'Poulet', quantite_g: '120', kcal_100: 165, proteines_100: 31, glucides_100: 0, lipides_100: 3.6, confiance: 'bizarre' },
  ],
}

describe('lecture de la demande', () => {
  it('accepte une image base64 et une indication courte', () => {
    expect(lireDemande({ image, mediaType: 'image/jpeg', indication: '  sans sauce  ' })).toEqual({ image, mediaType: 'image/jpeg', indication: 'sans sauce' })
    expect(lireDemande({ image, mediaType: 'image/webp' }).indication).toBeNull()
    expect(lireDemande({ image, mediaType: 'image/png', indication: 'x'.repeat(500) }).indication).toHaveLength(200)
  })

  it.each([
    [null, 400], ['x', 400], [{ image, mediaType: 'image/gif' }, 400], [{ mediaType: 'image/jpeg' }, 400], [{ image: 'court', mediaType: 'image/jpeg' }, 400],
    [{ image: '<script>'.repeat(30), mediaType: 'image/jpeg' }, 400], [{ image: 'A'.repeat(TAILLE_IMAGE_MAX + 1), mediaType: 'image/jpeg' }, 413],
  ])('refuse %j', (corps, statut) => {
    expect(() => lireDemande(corps)).toThrow(ErreurAnalyse)
    try {
      lireDemande(corps)
    } catch (e) {
      expect((e as ErreurAnalyse).statut).toBe(statut)
    }
  })
})

describe('nettoyage de la réponse du modèle', () => {
  it('normalise noms, quantités et valeurs, confiance inconnue = moyenne', () => {
    const r = nettoyerAnalyse(brut)
    expect(r.estUnRepas).toBe(true)
    expect(r.remarque).toBe('Huile de cuisson probable.')
    expect(r.aliments[0]).toEqual({ nom: 'Riz blanc', quantiteG: 149, kcal100: 130, proteines100: 2.7, glucides100: 28, lipides100: 0.3, fibres100: 0.4, confiance: 'haute' })
    expect(r.aliments[1]).toMatchObject({ nom: 'Poulet', quantiteG: 120, fibres100: null, confiance: 'moyenne' })
  })

  it('borne les valeurs absurdes et écarte les lignes inexploitables', () => {
    const r = nettoyerAnalyse({
      est_un_repas: true,
      aliments: [
        { nom: 'Géant', quantite_g: 99_999, kcal_100: 5000, proteines_100: 500, glucides_100: -4, lipides_100: 1, confiance: 'faible' },
        { nom: '', quantite_g: 10, kcal_100: 1, proteines_100: 0, glucides_100: 0, lipides_100: 0 },
        { nom: 'Sans énergie', quantite_g: 10, proteines_100: 0, glucides_100: 0, lipides_100: 0 },
        'texte', null,
      ],
    })
    expect(r.aliments).toHaveLength(1)
    expect(r.aliments[0]).toMatchObject({ quantiteG: 5000, kcal100: 1000, proteines100: 100, glucides100: 0, confiance: 'faible' })
  })

  it('garde au plus 12 aliments ; une liste vide n’est pas un repas', () => {
    const beaucoup = Array.from({ length: 20 }, (_, i) => ({ nom: `A${i}`, quantite_g: 10, kcal_100: 10, proteines_100: 1, glucides_100: 1, lipides_100: 1, confiance: 'haute' }))
    expect(nettoyerAnalyse({ est_un_repas: true, aliments: beaucoup }).aliments).toHaveLength(12)
    expect(nettoyerAnalyse({ est_un_repas: true, aliments: [] }).estUnRepas).toBe(false)
    expect(nettoyerAnalyse({ est_un_repas: false, aliments: brut.aliments }).estUnRepas).toBe(false)
    expect(() => nettoyerAnalyse(null)).toThrow(ErreurAnalyse)
  })
})

describe('exécution', () => {
  const ports = (recentes: number, plafond = 30) =>
    ({ plafondParJour: plafond, analysesRecentes: vi.fn(async () => recentes), noterAnalyse: vi.fn(async () => {}), appelerModele: vi.fn(async () => brut) }) satisfies PortsAnalyse

  it('note l’analyse puis appelle le modèle', async () => {
    const p = ports(3)
    const r = await executer({ image, mediaType: 'image/jpeg', indication: null }, p)
    expect(r.aliments).toHaveLength(2)
    expect(p.noterAnalyse).toHaveBeenCalledOnce()
    expect(p.appelerModele).toHaveBeenCalledOnce()
  })

  it('refuse au-delà du plafond quotidien, sans appeler le modèle', async () => {
    const p = ports(30)
    await expect(executer({ image, mediaType: 'image/jpeg', indication: null }, p)).rejects.toMatchObject({ statut: 429 })
    expect(p.noterAnalyse).not.toHaveBeenCalled()
    expect(p.appelerModele).not.toHaveBeenCalled()
  })

  it('un échec du modèle compte quand même dans le quota', async () => {
    const p = ports(0)
    p.appelerModele.mockRejectedValueOnce(new ErreurAnalyse(502, 'panne'))
    await expect(executer({ image, mediaType: 'image/jpeg', indication: null }, p)).rejects.toMatchObject({ statut: 502 })
    expect(p.noterAnalyse).toHaveBeenCalledOnce()
  })
})

describe('côté application', () => {
  const client = (reponse: () => Promise<Response>) => ({ appelerFonction: vi.fn(reponse) }) as unknown as ClientSupabase & { appelerFonction: ReturnType<typeof vi.fn> }

  it('envoie l’image et rend les estimations', async () => {
    const c = client(async () => new Response(JSON.stringify({ estUnRepas: true, aliments: [{ nom: 'Riz', quantiteG: 150, kcal100: 130, proteines100: 2.7, glucides100: 28, lipides100: 0.3, fibres100: null, confiance: 'haute' }], remarque: null })))
    const r = await analyserAssiette(c, { base64: 'AAAA', mediaType: 'image/jpeg' }, '  sans sauce ')
    expect(r.aliments).toHaveLength(1)
    expect(c.appelerFonction).toHaveBeenCalledWith('analyser-assiette', { image: 'AAAA', mediaType: 'image/jpeg', indication: 'sans sauce' })
    expect(apportEstime(r.aliments[0])).toMatchObject({ kcal: 195, glucides: 42 })
  })

  it('traduit les erreurs : non déployée, quota, réseau', async () => {
    await expect(analyserAssiette(client(async () => new Response('{}', { status: 404 })), { base64: 'A', mediaType: 'image/jpeg' })).rejects.toThrow(/pas déployée/)
    await expect(analyserAssiette(client(async () => new Response(JSON.stringify({ erreur: 'Limite atteinte' }), { status: 429 })), { base64: 'A', mediaType: 'image/jpeg' })).rejects.toThrow('Limite atteinte')
    await expect(analyserAssiette(client(async () => { throw new TypeError('offline') }), { base64: 'A', mediaType: 'image/jpeg' })).rejects.toThrow(/réseau/)
  })
})
