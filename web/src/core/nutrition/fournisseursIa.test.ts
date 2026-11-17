import { describe, expect, it } from 'vitest'
import { ErreurAnalyse, NOM_OUTIL } from '../../../supabase/functions/analyser-assiette/analyse'
import { choisirFournisseur, construireRequete, extraireSortie, fournisseursConfigures, lireFournisseur, listePublique, choisirModeleRecent, requeteListeModeles } from '../../../supabase/functions/analyser-assiette/fournisseurs'
import { fournisseurInitial, listerFournisseursIa } from './photo'
import type { ClientSupabase } from '../db/clientSupabase'

const env = (valeurs: Record<string, string>) => (nom: string) => valeurs[nom]
const demande = { image: 'A'.repeat(200), mediaType: 'image/jpeg' as const, indication: 'sans sauce' }
const sortie = { est_un_repas: true, aliments: [{ nom: 'Riz', quantite_g: 150 }] }

describe('fournisseurs d’IA configurés', () => {
  it('ne retient que les fournisseurs dont la clé existe, dans l’ordre Anthropic, Gemini, OpenAI', () => {
    const f = fournisseursConfigures(env({ OPENAI_API_KEY: 'o', ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: '  ' }))
    expect(f.map((x) => x.id)).toEqual(['anthropic', 'openai'])
    expect(fournisseursConfigures(env({}))).toEqual([])
  })

  it('le modèle se change par secret ; l’ancien ANALYSE_MODELE vaut pour Anthropic', () => {
    expect(fournisseursConfigures(env({ ANTHROPIC_API_KEY: 'a' }))[0].modele).toBe('claude-sonnet-5-5')
    expect(fournisseursConfigures(env({ ANTHROPIC_API_KEY: 'a', ANALYSE_MODELE: 'ancien' }))[0].modele).toBe('ancien')
    expect(fournisseursConfigures(env({ ANTHROPIC_API_KEY: 'a', ANALYSE_MODELE: 'ancien', ANALYSE_MODELE_ANTHROPIC: 'neuf' }))[0].modele).toBe('neuf')
    expect(fournisseursConfigures(env({ GEMINI_API_KEY: 'g', ANALYSE_MODELE_GEMINI: 'gemini-x' }))[0].modele).toBe('gemini-x')
  })

  it('lit le fournisseur demandé et refuse une valeur inconnue', () => {
    expect(lireFournisseur({ fournisseur: 'gemini' })).toBe('gemini')
    expect(lireFournisseur({})).toBeNull()
    expect(lireFournisseur(null)).toBeNull()
    expect(() => lireFournisseur({ fournisseur: 'pirate' })).toThrow(ErreurAnalyse)
  })

  it('choisit le fournisseur demandé, sinon le défaut du serveur, sinon le premier ; 400 si non configuré, 503 si aucun', () => {
    const f = fournisseursConfigures(env({ ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g' }))
    expect(choisirFournisseur('gemini', f).id).toBe('gemini')
    expect(choisirFournisseur(null, f, 'gemini').id).toBe('gemini')
    expect(choisirFournisseur(null, f, 'openai').id).toBe('anthropic')
    expect(choisirFournisseur(null, f).id).toBe('anthropic')
    expect(() => choisirFournisseur('openai', f)).toThrowError(expect.objectContaining({ statut: 400 }))
    expect(() => choisirFournisseur(null, [])).toThrowError(expect.objectContaining({ statut: 503 }))
  })

  it('la liste publique ne contient jamais les clés', () => {
    const liste = listePublique(fournisseursConfigures(env({ ANTHROPIC_API_KEY: 'secret-a', OPENAI_API_KEY: 'secret-o' })), 'openai')
    expect(liste.defaut).toBe('openai')
    expect(liste.fournisseurs.map((x) => x.id)).toEqual(['anthropic', 'openai'])
    expect(JSON.stringify(liste)).not.toMatch(/secret/)
    expect(listePublique([])).toEqual({ defaut: null, fournisseurs: [] })
  })
})

describe('requêtes envoyées à chaque fournisseur', () => {
  const f = (cles: Record<string, string>, id: string) => fournisseursConfigures(env(cles)).find((x) => x.id === id)!

  it('Anthropic : outil disponible (non forcé, refusé par les modèles récents), image en base64, clé dans x-api-key', () => {
    const r = construireRequete(f({ ANTHROPIC_API_KEY: 'cle-a' }, 'anthropic'), demande)
    const corps = JSON.parse(r.body)
    expect(r.url).toBe('https://api.anthropic.com/v1/messages')
    expect(r.headers['x-api-key']).toBe('cle-a')
    expect(corps.tool_choice).toEqual({ type: 'auto' })
    expect(corps.tools[0].name).toBe(NOM_OUTIL)
    expect(corps.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg' } })
    expect(corps.messages[0].content[1].text).toContain('sans sauce')
  })

  it('Gemini : modèle dans l’adresse, clé dans l’en-tête (jamais dans l’adresse), appel de fonction imposé', () => {
    const r = construireRequete(f({ GEMINI_API_KEY: 'cle-g', ANALYSE_MODELE_GEMINI: 'gemini-x' }, 'gemini'), demande)
    const corps = JSON.parse(r.body)
    expect(r.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-x:generateContent')
    expect(r.url).not.toContain('cle-g')
    expect(r.headers['x-goog-api-key']).toBe('cle-g')
    expect(corps.toolConfig.functionCallingConfig).toEqual({ mode: 'ANY', allowedFunctionNames: [NOM_OUTIL] })
    expect(corps.contents[0].parts[0]).toMatchObject({ inlineData: { mimeType: 'image/jpeg' } })
  })

  it('OpenAI : image en data URL, fonction imposée, clé dans Authorization', () => {
    const r = construireRequete(f({ OPENAI_API_KEY: 'cle-o' }, 'openai'), demande)
    const corps = JSON.parse(r.body)
    expect(r.url).toBe('https://api.openai.com/v1/chat/completions')
    expect(r.headers.authorization).toBe('Bearer cle-o')
    expect(corps.tool_choice).toEqual({ type: 'function', function: { name: NOM_OUTIL } })
    expect(corps.messages[1].content[1].image_url.url.startsWith('data:image/jpeg;base64,')).toBe(true)
  })
})

describe('lecture de la réponse de chaque fournisseur', () => {
  it('Anthropic : entrée du bloc tool_use', () => {
    expect(extraireSortie('anthropic', { content: [{ type: 'text', text: 'ok' }, { type: 'tool_use', name: NOM_OUTIL, input: sortie }] })).toEqual(sortie)
  })

  it('Gemini : arguments du functionCall', () => {
    expect(extraireSortie('gemini', { candidates: [{ content: { parts: [{ functionCall: { name: NOM_OUTIL, args: sortie } }] } }] })).toEqual(sortie)
  })

  it('OpenAI : arguments JSON de l’appel de fonction', () => {
    expect(extraireSortie('openai', { choices: [{ message: { tool_calls: [{ function: { name: NOM_OUTIL, arguments: JSON.stringify(sortie) } }] } }] })).toEqual(sortie)
  })

  it.each([
    ['anthropic', { content: [] }], ['anthropic', null], ['gemini', { candidates: [] }], ['gemini', { candidates: [{ content: { parts: [{ text: 'bla' }] } }] }],
    ['openai', { choices: [{ message: { content: 'bla' } }] }], ['openai', { choices: [{ message: { tool_calls: [{ function: { name: NOM_OUTIL, arguments: '{pas du json' } }] } }] }],
  ] as const)('%s : réponse sans résultat exploitable = 502', (id, json) => {
    expect(() => extraireSortie(id, json)).toThrowError(expect.objectContaining({ statut: 502 }))
  })
})

describe('côté application : liste et choix', () => {
  const client = (reponse: () => Promise<Response>) => ({ appelerFonction: reponse }) as unknown as ClientSupabase
  const liste = { defaut: 'gemini', fournisseurs: [{ id: 'anthropic', libelle: 'Claude', modele: 'm' }, { id: 'gemini', libelle: 'Gemini', modele: 'n' }] }

  it('rend la liste du serveur ; une erreur ou une réponse inattendue donne une liste vide', async () => {
    expect(await listerFournisseursIa(client(async () => new Response(JSON.stringify(liste))))).toEqual(liste)
    expect((await listerFournisseursIa(client(async () => new Response('{}', { status: 404 })))).fournisseurs).toEqual([])
    expect((await listerFournisseursIa(client(async () => { throw new TypeError('offline') }))).fournisseurs).toEqual([])
    expect((await listerFournisseursIa(client(async () => new Response(JSON.stringify({ fournisseurs: [1, null, { id: 'x' }] }))))).fournisseurs).toEqual([])
  })

  it('présélectionne le dernier choix s’il existe encore, sinon le défaut du serveur, sinon le premier', () => {
    expect(fournisseurInitial(liste, 'anthropic')).toBe('anthropic')
    expect(fournisseurInitial(liste, 'openai')).toBe('gemini')
    expect(fournisseurInitial({ ...liste, defaut: null }, null)).toBe('anthropic')
    expect(fournisseurInitial({ defaut: null, fournisseurs: [] }, 'gemini')).toBeNull()
  })
})

describe('retrouver un modèle retiré (404)', () => {
  it('Gemini : le Flash le plus récent qui sait générer', () => {
    const json = {
      models: [
        { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.10-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-3.9-flash-lite', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-4-flash', supportedGenerationMethods: ['embedContent'] },
      ],
    }
    expect(choisirModeleRecent('gemini', json)).toBe('gemini-3.10-flash')
  })

  it('Anthropic : le Sonnet le plus récent ; OpenAI : le GPT numéroté le plus récent', () => {
    expect(choisirModeleRecent('anthropic', { data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-4-5' }, { id: 'claude-sonnet-5-5' }] })).toBe('claude-sonnet-5-5')
    expect(choisirModeleRecent('openai', { data: [{ id: 'gpt-4o' }, { id: 'gpt-5' }, { id: 'gpt-5-mini' }, { id: 'gpt-4.1' }] })).toBe('gpt-5')
  })

  it('liste vide ou illisible : null ; la requête de liste porte la clé dans un en-tête', () => {
    expect(choisirModeleRecent('gemini', null)).toBeNull()
    expect(choisirModeleRecent('openai', { data: [] })).toBeNull()
    const f = fournisseursConfigures(env({ GEMINI_API_KEY: 'cle-g' }))[0]
    const l = requeteListeModeles(f)
    expect(l.url).not.toContain('cle-g')
    expect(l.headers['x-goog-api-key']).toBe('cle-g')
  })
})
