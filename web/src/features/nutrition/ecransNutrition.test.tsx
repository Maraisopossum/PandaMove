// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientSupabase } from '../../core/db/clientSupabase'
import type { Db } from '../../core/db/Db'
import { ajouterEau, ajouterEntree, creerAliment, enregistrerObjectifsNutrition, lireJour, lireObjectifsNutrition, listerAliments } from '../../core/db/repos/nutrition'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
let client: ClientSupabase
const reduireImage = vi.fn()
vi.mock('../../core/db/client', () => ({ getDb: () => base, getSupabase: () => client }))
vi.mock('../../core/nutrition/photo', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../core/nutrition/photo')>()), reduireImage: (f: Blob) => reduireImage(f) }))

import AjouterAlimentScreen from './AjouterAlimentScreen'
import AlimentFormScreen from './AlimentFormScreen'
import BilanNutritionScreen from './BilanNutritionScreen'
import EntreeScreen from './EntreeScreen'
import MesAlimentsScreen from './MesAlimentsScreen'
import NutritionScreen from './NutritionScreen'
import ObjectifsNutritionScreen from './ObjectifsNutritionScreen'
import PhotoAssietteScreen from './PhotoAssietteScreen'

const AUJOURDHUI = '2026-11-15'
const apport = (kcal: number, p = 10, g = 20, l = 5) => ({ kcal, proteines: p, glucides: g, lipides: l, fibres: 1 })

function Lieu() {
  const l = useLocation()
  return <p data-testid="lieu">{l.pathname}{l.search}</p>
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 12, 30, 0))
  base = createTestDb()
  client = { appelerFonction: vi.fn() } as unknown as ClientSupabase
  reduireImage.mockReset()
})
afterEach(() => {
  cleanup()
  localStorage.removeItem('pandamove.nutrition.ia')
  vi.useRealTimers()
})

const monter = (chemin: string) =>
  render(
    <MemoryRouter initialEntries={[chemin]}>
      <Routes>
        <Route path="/nutrition" element={<><NutritionScreen aujourdhui={AUJOURDHUI} /><Lieu /></>} />
        <Route path="/nutrition/ajouter" element={<><AjouterAlimentScreen aujourdhui={AUJOURDHUI} /><Lieu /></>} />
        <Route path="/nutrition/photo" element={<><PhotoAssietteScreen aujourdhui={AUJOURDHUI} client={client} /><Lieu /></>} />
        <Route path="/nutrition/entree/:id" element={<><EntreeScreen /><Lieu /></>} />
        <Route path="/nutrition/objectifs" element={<><ObjectifsNutritionScreen /><Lieu /></>} />
        <Route path="/nutrition/bilan" element={<BilanNutritionScreen aujourdhui={AUJOURDHUI} />} />
        <Route path="/nutrition/aliments" element={<MesAlimentsScreen />} />
        <Route path="/nutrition/aliments/new" element={<><AlimentFormScreen /><Lieu /></>} />
        <Route path="/nutrition/aliments/:id" element={<AlimentFormScreen />} />
      </Routes>
    </MemoryRouter>,
  )

describe('journal', () => {
  it('invite à définir des objectifs quand il n’y en a pas, et montre les quatre repas vides', async () => {
    monter('/nutrition')
    expect(await screen.findByText(/Aucun objectif défini/)).toBeTruthy()
    for (const r of ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']) expect(screen.getByRole('heading', { name: new RegExp(r) })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Photographier mon assiette' }).getAttribute('href')).toBe('/nutrition/photo?date=2026-11-15')
  })

  it('totalise le jour, répartit par repas et compare à l’objectif', async () => {
    await enregistrerObjectifsNutrition(base, { kcal: 2000, proteinesG: 150, glucidesG: 200, lipidesG: 60, eauMl: 2000 })
    await ajouterEntree(base, { date: AUJOURDHUI, repas: 'dejeuner', nom: 'Riz', quantiteG: 150, apport: apport(500, 30) })
    await ajouterEntree(base, { date: AUJOURDHUI, repas: 'diner', nom: 'Poulet', quantiteG: 120, apport: apport(400, 40) })
    await ajouterEntree(base, { date: '2026-11-14', repas: 'diner', nom: 'Hier', quantiteG: 1, apport: apport(999) })
    monter('/nutrition')
    const anneau = await screen.findByRole('img', { name: /900 kilocalories consommées sur 2\s000, il en reste 1\s100/ })
    expect(anneau).toBeTruthy()
    const dejeuner = screen.getByRole('heading', { name: /Déjeuner/ }).closest('section')!
    expect(within(dejeuner).getByText('Riz')).toBeTruthy()
    expect(within(dejeuner).getByText(/500 kcal/, { selector: 'span.plans__sous' })).toBeTruthy()
    expect(screen.queryByText('Hier')).toBeNull()
  })

  it('ajoute de l’eau et annule le dernier ajout', async () => {
    monter('/nutrition')
    fireEvent.click(await screen.findByRole('button', { name: '+ 250 ml' }))
    fireEvent.click(screen.getByRole('button', { name: '+ 500 ml' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: /Hydratation/ }).textContent).toContain('750'))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler le dernier' }))
    await waitFor(async () => expect((await lireJour(base, AUJOURDHUI)).filter((e) => e.repas === 'eau')).toHaveLength(1))
  })

  it('change de jour avec les flèches et copie le repas de la veille', async () => {
    await ajouterEntree(base, { date: '2026-11-14', repas: 'dejeuner', nom: 'Pâtes d’hier', quantiteG: 200, apport: apport(300) })
    monter('/nutrition')
    fireEvent.click(await screen.findByRole('button', { name: 'Copier celui d’hier' }))
    expect(await screen.findByText('Pâtes d’hier')).toBeTruthy()
    expect((await lireJour(base, AUJOURDHUI))[0].source).toBe('copie')
    fireEvent.click(screen.getByRole('button', { name: 'Jour précédent' }))
    await waitFor(() => expect(screen.getByTestId('lieu').textContent).toBe('/nutrition?date=2026-11-14'))
    expect(await screen.findByText('Hier')).toBeTruthy()
  })
})

describe('refonte du journal : accueil du panda, suppression visible avec annulation', () => {
  it('accueille selon l’heure, montre le bilan et le panda de chaque repas (décoratif)', async () => {
    await enregistrerObjectifsNutrition(base, { kcal: 2400, proteinesG: 150, glucidesG: 280, lipidesG: 75, eauMl: 2500 })
    await ajouterEntree(base, { date: AUJOURDHUI, repas: 'dejeuner', nom: 'Riz', quantiteG: 150, apport: apport(988) })
    monter('/nutrition')
    expect(await screen.findByText('Bon appétit')).toBeTruthy()
    expect(screen.getByText(/Il reste 1\s412 kcal pour aujourd’hui/)).toBeTruthy()
    // 1 image pour le bilan, 1 pour l'eau, 4 pour les repas : toutes décoratives (alt vide)
    const pandas = document.querySelectorAll('img.panda-illustration')
    expect(pandas.length).toBe(6)
    pandas.forEach((p) => expect(p.getAttribute('alt')).toBe(''))
  })

  it('objectif atteint : le titre change et le panda fête', async () => {
    await enregistrerObjectifsNutrition(base, { kcal: 2400, proteinesG: 150, glucidesG: 280, lipidesG: 75, eauMl: 2500 })
    await ajouterEntree(base, { date: AUJOURDHUI, repas: 'dejeuner', nom: 'Gros repas', quantiteG: 800, apport: apport(2386) })
    monter('/nutrition')
    expect(await screen.findByText('Objectif atteint, bravo !')).toBeTruthy()
    expect(document.querySelector('img.panda-illustration[src*="nutri-objectif"]')).not.toBeNull()
  })

  it('« Supprimer » est visible sur chaque ligne ; la suppression est immédiate et s’annule', async () => {
    await ajouterEntree(base, { date: AUJOURDHUI, repas: 'dejeuner', nom: 'Riz basmati', quantiteG: 180, apport: apport(234) })
    await ajouterEntree(base, { date: AUJOURDHUI, repas: 'dejeuner', nom: 'Poulet', quantiteG: 150, apport: apport(248) })
    monter('/nutrition')
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Riz basmati' }))
    // Pas de confirmation bloquante : la ligne disparaît et « Annuler » est proposé
    expect(await screen.findByText('« Riz basmati » supprimé')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('Riz basmati')).toBeNull())
    expect((await lireJour(base, AUJOURDHUI)).map((e) => e.nom)).toEqual(['Poulet'])
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(await screen.findByText('Riz basmati')).toBeTruthy()
    expect((await lireJour(base, AUJOURDHUI)).map((e) => e.nom).sort()).toEqual(['Poulet', 'Riz basmati'])
    expect(screen.queryByText('« Riz basmati » supprimé')).toBeNull()
  })

  it('un repas vide invite à ajouter, avec une phrase par repas', async () => {
    monter('/nutrition')
    expect(await screen.findByText('Rien pour l’instant. Une pomme, des amandes ?')).toBeTruthy()
    expect(screen.getByText('Le dîner n’est pas encore noté.')).toBeTruthy()
  })
})

describe('ajout d’un aliment', () => {
  it('cherche dans la base intégrée, ajuste la quantité et ajoute au repas demandé', async () => {
    monter('/nutrition/ajouter?repas=diner')
    fireEvent.change(await screen.findByLabelText(/Rechercher un aliment/), { target: { value: 'riz blanc' } })
    fireEvent.click(await screen.findByRole('button', { name: /Riz blanc cuit/ }))
    // portion de 150 g par défaut : 195 kcal
    expect(await screen.findByText('195 kcal')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter 50 grammes' }))
    expect(screen.getByText('260 kcal')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au dîner/ }))
    await waitFor(() => expect(screen.getByTestId('lieu').textContent).toBe('/nutrition'))
    const jour = await lireJour(base, AUJOURDHUI)
    expect(jour).toHaveLength(1)
    expect(jour[0]).toMatchObject({ nom: 'Riz blanc cuit', repas: 'diner', quantiteG: 200, source: 'base', apport: { kcal: 260 } })
  })

  it('propose les aliments fréquents, avec leur dernière quantité', async () => {
    await ajouterEntree(base, { date: '2026-11-13', repas: 'collation', nom: 'Banane', quantiteG: 120, apport: apport(108, 1.2, 24, 0.2) })
    monter('/nutrition/ajouter')
    fireEvent.click(await screen.findByRole('button', { name: /Banane/ }))
    expect(await screen.findByText('108 kcal')).toBeTruthy()
    expect((screen.getByLabelText('Quantité (g)') as HTMLInputElement).value).toBe('120')
  })

  it('retrouve un aliment personnel et le choisit', async () => {
    await creerAliment(base, { nom: 'Skyr maison', kcal100: 60, proteines100: 11, glucides100: 4, lipides100: 0.2, portionG: 150, portionLabel: '1 pot', favori: true })
    monter('/nutrition/ajouter')
    fireEvent.click(await screen.findByRole('button', { name: /Skyr maison/ }))
    expect(await screen.findByRole('button', { name: /1 portion : 1 pot, 150 g/ })).toBeTruthy()
    expect(screen.getByText('90 kcal')).toBeTruthy()
  })

  it('cherche en ligne seulement sur demande, et garde le produit dans Mes aliments', async () => {
    const produit = { code: '3017620422003', product_name: 'Pâte à tartiner', brands: 'Marque', serving_quantity: 15, nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6, carbohydrates_100g: 57, fat_100g: 31 } }
    const f = vi.fn(async () => new Response(JSON.stringify({ products: [produit] })))
    vi.stubGlobal('fetch', f)
    try {
      monter('/nutrition/ajouter')
      fireEvent.change(await screen.findByLabelText(/Rechercher un aliment/), { target: { value: 'tartiner' } })
      expect(f).not.toHaveBeenCalled()
      fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }))
      fireEvent.click(await screen.findByRole('button', { name: /Pâte à tartiner · Marque/ }))
      expect((screen.getByLabelText(/Garder dans Mes aliments/) as HTMLInputElement).checked).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: /Ajouter au/ }))
      await waitFor(async () => expect(await listerAliments(base)).toHaveLength(1))
      expect((await listerAliments(base))[0]).toMatchObject({ nom: 'Pâte à tartiner', codeBarres: '3017620422003', source: 'off' })
      expect((await lireJour(base, AUJOURDHUI))[0]).toMatchObject({ source: 'off', quantiteG: 15 })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('signale une recherche en ligne impossible sans bloquer le reste', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
    try {
      monter('/nutrition/ajouter')
      fireEvent.change(await screen.findByLabelText(/Rechercher un aliment/), { target: { value: 'yaourt' } })
      fireEvent.click(await screen.findByRole('button', { name: 'Chercher en ligne' }))
      expect((await screen.findByRole('alert')).textContent).toMatch(/réseau/)
      expect(screen.getByRole('button', { name: /Yaourt nature/ })).toBeTruthy()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('saisie rapide : ajoute des valeurs totales sans quantité', async () => {
    monter('/nutrition/ajouter?repas=dejeuner')
    fireEvent.click(await screen.findByRole('button', { name: /Saisie rapide/ }))
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Burger resto' } })
    fireEvent.change(screen.getByLabelText('Énergie (kcal)'), { target: { value: '850' } })
    fireEvent.change(screen.getByLabelText('Protéines (g)'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au déjeuner/ }))
    await waitFor(async () => expect(await lireJour(base, AUJOURDHUI)).toHaveLength(1))
    expect((await lireJour(base, AUJOURDHUI))[0]).toMatchObject({ nom: 'Burger resto', quantiteG: 0, source: 'manuel', apport: { kcal: 850, proteines: 40 } })
  })
})

describe('modification d’une ligne', () => {
  it('recalcule les apports en gardant les proportions, change de repas', async () => {
    const id = await ajouterEntree(base, { date: AUJOURDHUI, repas: 'dejeuner', nom: 'Riz', quantiteG: 100, apport: apport(130, 2.7, 28, 0.3) })
    monter(`/nutrition/entree/${id}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter 50 grammes' }))
    expect(screen.getByText('195 kcal')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Repas'), { target: { value: 'diner' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.getByTestId('lieu').textContent).toBe('/nutrition?date=2026-11-15'))
    expect((await lireJour(base, AUJOURDHUI))[0]).toMatchObject({ repas: 'diner', quantiteG: 150, apport: { kcal: 195 } })
  })

  it('supprime après confirmation', async () => {
    const id = await ajouterEntree(base, { date: AUJOURDHUI, repas: 'dejeuner', nom: 'Riz', quantiteG: 100, apport: apport(130) })
    monter(`/nutrition/entree/${id}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer cette ligne' }))
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))
    await waitFor(async () => expect(await lireJour(base, AUJOURDHUI)).toHaveLength(0))
  })

  it('une ligne saisie sans quantité n’est pas recalculée', async () => {
    const id = await ajouterEntree(base, { date: AUJOURDHUI, repas: 'dejeuner', nom: 'Burger', quantiteG: 0, apport: apport(850) })
    monter(`/nutrition/entree/${id}`)
    expect(await screen.findByText(/ne se recalculent pas/)).toBeTruthy()
    expect(screen.queryByLabelText('Quantité (g)')).toBeNull()
  })

  it('signale une ligne qui n’existe plus', async () => {
    monter('/nutrition/entree/inconnue')
    expect((await screen.findByRole('alert')).textContent).toMatch(/n’existe plus/)
  })
})

describe('photo de l’assiette', () => {
  const fichier = () => new File([new Uint8Array([1, 2, 3])], 'assiette.jpg', { type: 'image/jpeg' })
  const reponse = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut })
  // L'écran demande d'abord la liste des services d'IA (action « fournisseurs »), puis envoie la photo : une réponse neuve par appel.
  const repondre = (corps: unknown, statut = 200) => async (_nom: string, demande: { action?: string }) =>
    demande.action === 'fournisseurs' ? reponse({ defaut: null, fournisseurs: [] }) : reponse(corps, statut)
  const appelsAnalyse = () => (client.appelerFonction as ReturnType<typeof vi.fn>).mock.calls.filter((c) => (c[1] as { image?: string }).image)
  const riz = { nom: 'Riz blanc', quantiteG: 150, kcal100: 130, proteines100: 2.7, glucides100: 28, lipides100: 0.3, fibres100: null, confiance: 'haute' }
  const sauce = { nom: 'Sauce', quantiteG: 30, kcal100: 200, proteines100: 1, glucides100: 10, lipides100: 18, fibres100: null, confiance: 'faible' }

  beforeEach(() => {
    reduireImage.mockResolvedValue({ base64: 'AAAA', mediaType: 'image/jpeg' })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} }))
  })

  it('analyse la photo, montre les aliments corrigeables puis les ajoute au journal en source « ia »', async () => {
    ;(client.appelerFonction as ReturnType<typeof vi.fn>).mockImplementation(repondre({ estUnRepas: true, aliments: [riz, sauce], remarque: 'Huile probable.' }))
    monter('/nutrition/photo?repas=dejeuner')
    const entree = (await screen.findByText('Prendre une photo')).querySelector('input')!
    fireEvent.change(entree, { target: { files: [fichier()] } })
    expect(await screen.findByText(/ce que j’ai reconnu/i)).toBeTruthy()
    expect(screen.getByText('Huile probable.')).toBeTruthy()
    expect(screen.getByText('À vérifier')).toBeTruthy()
    // corrige la quantité de la sauce (30 g → 10 g) et retire rien d'autre
    fireEvent.click(screen.getByRole('button', { name: 'Retirer 10 grammes de Sauce' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retirer 10 grammes de Sauce' }))
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au déjeuner/ }))
    await waitFor(() => expect(screen.getByTestId('lieu').textContent).toBe('/nutrition'))
    const jour = await lireJour(base, AUJOURDHUI)
    expect(jour.map((e) => [e.nom, e.quantiteG, e.source, e.repas])).toEqual([['Riz blanc', 150, 'ia', 'dejeuner'], ['Sauce', 10, 'ia', 'dejeuner']])
    expect(appelsAnalyse()[0][1]).toMatchObject({ image: 'AAAA', mediaType: 'image/jpeg' })
  })

  it('retire une ligne reconnue à tort', async () => {
    ;(client.appelerFonction as ReturnType<typeof vi.fn>).mockImplementation(repondre({ estUnRepas: true, aliments: [riz, sauce], remarque: null }))
    monter('/nutrition/photo')
    fireEvent.change((await screen.findByText('Prendre une photo')).querySelector('input')!, { target: { files: [fichier()] } })
    fireEvent.click(await screen.findByRole('button', { name: 'Retirer Sauce' }))
    fireEvent.click(screen.getByRole('button', { name: /Ajouter au/ }))
    await waitFor(async () => expect(await lireJour(base, AUJOURDHUI)).toHaveLength(1))
  })

  it('une photo sans nourriture propose de recommencer ou de saisir à la main', async () => {
    ;(client.appelerFonction as ReturnType<typeof vi.fn>).mockImplementation(repondre({ estUnRepas: false, aliments: [], remarque: 'C’est un paysage.' }))
    monter('/nutrition/photo')
    fireEvent.change((await screen.findByText('Prendre une photo')).querySelector('input')!, { target: { files: [fichier()] } })
    expect(await screen.findByText('Rien d’identifiable')).toBeTruthy()
    expect(screen.getByText('C’est un paysage.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Saisir à la main' })).toBeTruthy()
  })

  it('affiche l’erreur du serveur (quota, non configuré) et revient au choix de la photo', async () => {
    ;(client.appelerFonction as ReturnType<typeof vi.fn>).mockImplementation(repondre({ erreur: 'Limite atteinte : 30 analyses de photo par jour.' }, 429))
    monter('/nutrition/photo')
    fireEvent.change((await screen.findByText('Prendre une photo')).querySelector('input')!, { target: { files: [fichier()] } })
    expect((await screen.findByRole('alert')).textContent).toContain('Limite atteinte')
    expect(screen.getByText('Prendre une photo')).toBeTruthy()
    expect(await lireJour(base, AUJOURDHUI)).toHaveLength(0)
  })

  it('signale une photo illisible par le navigateur', async () => {
    reduireImage.mockRejectedValue(new Error('Le navigateur ne peut pas préparer la photo.'))
    monter('/nutrition/photo')
    fireEvent.change((await screen.findByText('Prendre une photo')).querySelector('input')!, { target: { files: [fichier()] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/préparer la photo/)
    expect(appelsAnalyse()).toHaveLength(0)
  })

  it('propose le choix du service d’IA quand plusieurs sont configurés, le mémorise et l’envoie avec la photo', async () => {
    const services = { defaut: 'anthropic', fournisseurs: [{ id: 'anthropic', libelle: 'Claude (Anthropic)', modele: 'm1' }, { id: 'gemini', libelle: 'Gemini (Google)', modele: 'm2' }] }
    ;(client.appelerFonction as ReturnType<typeof vi.fn>).mockImplementation(async (_nom: string, demande: { action?: string }) =>
      demande.action === 'fournisseurs' ? reponse(services) : reponse({ estUnRepas: true, aliments: [riz], remarque: null }))
    monter('/nutrition/photo')
    const choix = (await screen.findByLabelText('Analyser avec')) as HTMLSelectElement
    expect(choix.value).toBe('anthropic')
    fireEvent.change(choix, { target: { value: 'gemini' } })
    expect(localStorage.getItem('pandamove.nutrition.ia')).toBe('gemini')
    fireEvent.change(screen.getByText('Prendre une photo').querySelector('input')!, { target: { files: [fichier()] } })
    expect(await screen.findByText(/ce que j’ai reconnu/i)).toBeTruthy()
    expect(appelsAnalyse()[0][1]).toMatchObject({ fournisseur: 'gemini' })
  })

  it('reprend le dernier service choisi sur l’appareil, et masque le choix quand un seul est configuré', async () => {
    localStorage.setItem('pandamove.nutrition.ia', 'openai')
    const deux = { defaut: 'anthropic', fournisseurs: [{ id: 'anthropic', libelle: 'Claude (Anthropic)', modele: 'm1' }, { id: 'openai', libelle: 'ChatGPT (OpenAI)', modele: 'm3' }] }
    ;(client.appelerFonction as ReturnType<typeof vi.fn>).mockImplementation(async () => reponse(deux))
    const { unmount } = monter('/nutrition/photo')
    expect(((await screen.findByLabelText('Analyser avec')) as HTMLSelectElement).value).toBe('openai')
    unmount()
    ;(client.appelerFonction as ReturnType<typeof vi.fn>).mockImplementation(async () => reponse({ defaut: 'gemini', fournisseurs: [{ id: 'gemini', libelle: 'Gemini (Google)', modele: 'm2' }] }))
    monter('/nutrition/photo')
    expect(await screen.findByText(/Service d’analyse : Gemini \(Google\)/)).toBeTruthy()
    expect(screen.queryByLabelText('Analyser avec')).toBeNull()
  })
})

describe('objectifs', () => {
  // Le poids (dernière pesée) et la taille viennent du Profil, jamais d'une saisie dans Nutrition
  beforeEach(() => {
    localStorage.setItem('pandamove.poids', JSON.stringify({ objectifKg: null, pesees: [{ date: '2026-11-10', kg: 80 }, { date: '2026-11-14', kg: 78.4 }] }))
    localStorage.setItem('pandamove.taille', '182')
  })
  afterEach(() => {
    localStorage.removeItem('pandamove.poids')
    localStorage.removeItem('pandamove.taille')
  })

  it('lit le poids (dernière pesée) et la taille du Profil, avec un lien pour les modifier', async () => {
    monter('/nutrition/objectifs')
    const bloc = await screen.findByRole('group', { name: 'Mensurations du Profil' })
    expect(bloc.textContent).toMatch(/78,4\skg.*14\/11\/2026.*182\scm/)
    expect(screen.queryByLabelText(/^Poids/)).toBeNull()
    expect(screen.queryByLabelText(/^Taille/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Modifier dans le Profil' }).getAttribute('href')).toBe('/profile')
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser cette proposition' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.getByTestId('lieu').textContent).toBe('/nutrition'))
    expect(JSON.parse((await lireObjectifsNutrition(base))!.profilJson!)).toMatchObject({ poidsKg: 78.4, tailleCm: 182 })
  })

  it('sans poids ni taille dans le Profil : pas de proposition, un renvoi vers le Profil', async () => {
    localStorage.clear()
    monter('/nutrition/objectifs')
    expect(await screen.findByText(/poids et votre taille ne sont pas renseignés/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Utiliser cette proposition' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Les renseigner dans le Profil' }).getAttribute('href')).toBe('/profile')
  })

  it('calcule une proposition, l’applique puis enregistre', async () => {
    monter('/nutrition/objectifs')
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser cette proposition' }))
    expect(screen.getByText(/Proposition appliquée/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(screen.getByTestId('lieu').textContent).toBe('/nutrition'))
    const o = await lireObjectifsNutrition(base)
    expect(o?.kcal).toBeGreaterThan(1500)
    expect(JSON.parse(o!.profilJson!)).toMatchObject({ sexe: 'homme', age: 35 })
  })

  it('relit les objectifs et le profil enregistrés', async () => {
    await enregistrerObjectifsNutrition(base, { kcal: 2222, proteinesG: 140, glucidesG: 250, lipidesG: 70, eauMl: 2750, profilJson: JSON.stringify({ sexe: 'femme', age: 28, tailleCm: 165, poidsKg: 60, activite: 'legere', but: 'perte' }) })
    monter('/nutrition/objectifs')
    expect(((await screen.findByLabelText(/^Énergie/)) as HTMLInputElement).value).toBe('2222')
    expect((screen.getByLabelText(/^Âge/) as HTMLInputElement).value).toBe('28')
  })

  it('refuse un profil hors limites sans proposition et signale un objectif invalide', async () => {
    monter('/nutrition/objectifs')
    fireEvent.change(await screen.findByLabelText(/^Âge/), { target: { value: '5' } })
    expect(screen.getByText(/L’âge doit être compris/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Utiliser cette proposition' })).toBeNull()
    fireEvent.change(screen.getByLabelText(/^Énergie/), { target: { value: '100' } })
    // La validation native du navigateur bloquerait déjà ce clic : on soumet le formulaire pour tester la règle métier
    fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form')!)
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => /énergie/i.test(a.textContent ?? ''))).toBe(true))
  })
})

describe('mes aliments', () => {
  it('crée un aliment, le met en favori puis le supprime', async () => {
    monter('/nutrition/aliments/new')
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'Mon granola' } })
    fireEvent.change(screen.getByLabelText('Énergie (kcal)'), { target: { value: '450' } })
    fireEvent.change(screen.getByLabelText('Protéines (g)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(async () => expect(await listerAliments(base)).toHaveLength(1))
    expect((await listerAliments(base))[0]).toMatchObject({ nom: 'Mon granola', kcal100: 450 })
    expect(await screen.findByRole('heading', { name: 'Mes aliments' })).toBeTruthy()
  })

  it('refuse un code-barres invalide', async () => {
    monter('/nutrition/aliments/new')
    fireEvent.change(await screen.findByLabelText('Nom'), { target: { value: 'X' } })
    fireEvent.change(screen.getByLabelText('Énergie (kcal)'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/Code-barres/), { target: { value: '12ab' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Code-barres/)
  })

  it('liste, bascule le favori et supprime avec confirmation', async () => {
    await creerAliment(base, { nom: 'Skyr', kcal100: 60, proteines100: 11, glucides100: 4, lipides100: 0.2 })
    monter('/nutrition/aliments')
    fireEvent.click(await screen.findByRole('button', { name: 'Mettre Skyr en favori' }))
    await waitFor(async () => expect((await listerAliments(base))[0].favori).toBe(true))
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Skyr' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }))
    await waitFor(async () => expect(await listerAliments(base)).toHaveLength(0))
  })
})

describe('bilan', () => {
  it('invite à noter ses repas quand il n’y a rien', async () => {
    monter('/nutrition/bilan')
    expect(await screen.findByText(/Rien n’est encore noté/)).toBeTruthy()
  })

  it('moyenne sur les jours saisis, jours dans la cible et eau', async () => {
    await enregistrerObjectifsNutrition(base, { kcal: 2000, proteinesG: 150, glucidesG: 200, lipidesG: 60, eauMl: 2000 })
    await ajouterEntree(base, { date: '2026-11-15', repas: 'dejeuner', nom: 'A', quantiteG: 1, apport: apport(2000) })
    await ajouterEntree(base, { date: '2026-11-14', repas: 'dejeuner', nom: 'B', quantiteG: 1, apport: apport(1000) })
    await ajouterEau(base, '2026-11-14', 1500)
    monter('/nutrition/bilan')
    expect(await screen.findByText(/2 jours sur 7/)).toBeTruthy()
    expect(screen.getByText(/1 jour à ±10 %/)).toBeTruthy()
    expect(screen.getByText(/1 500 ml en moyenne/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '30 jours' }))
    expect(await screen.findByText(/2 jours sur 30/)).toBeTruthy()
  })
})

describe('raccourcis et partage (appui long sur l’icône, widget)', () => {
  const eauDuJourEnBase = async () => (await lireJour(base, AUJOURDHUI)).filter((e) => e.repas === 'eau').reduce((s, e) => s + e.quantiteG, 0)

  it('?action=eau ajoute 250 ml une fois, retire le paramètre de l’adresse et propose d’annuler', async () => {
    monter('/nutrition?action=eau')
    expect(await screen.findByText(/250 ml ajoutés/)).toBeTruthy()
    expect(screen.getByTestId('lieu').textContent).toBe('/nutrition')
    expect(await eauDuJourEnBase()).toBe(250)
    // Un rechargement de l'adresse nettoyée ne réajoute rien
    cleanup()
    monter('/nutrition')
    await screen.findByText('Nutrition')
    expect(await eauDuJourEnBase()).toBe(250)
    expect(screen.queryByText(/250 ml ajoutés/)).toBeNull()
  })

  it('Annuler retire l’eau qui vient d’être ajoutée', async () => {
    monter('/nutrition?action=eau')
    const annuler = within(await screen.findByRole('status')).getByRole('button', { name: 'Annuler' })
    fireEvent.click(annuler)
    await waitFor(() => expect(screen.queryByText(/250 ml ajoutés/)).toBeNull())
    expect(await eauDuJourEnBase()).toBe(0)
  })

  it('une autre valeur de ?action est ignorée', async () => {
    monter('/nutrition?action=autre')
    await screen.findByText('Nutrition')
    expect(await eauDuJourEnBase()).toBe(0)
  })

  it('?partage=1 analyse la photo partagée, une seule fois', async () => {
    const magasin = new Map<string, Response>()
    vi.stubGlobal('caches', { open: async () => ({ match: async (k: string) => magasin.get(k), delete: async (k: string) => magasin.delete(k), put: async () => {} }) })
    magasin.set('/partage/image', new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } }))
    reduireImage.mockResolvedValue({ base64: 'AAAA', mediaType: 'image/jpeg' })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} }))
    ;(client.appelerFonction as ReturnType<typeof vi.fn>).mockImplementation(async (_n: string, d: { action?: string }) =>
      new Response(JSON.stringify(d.action === 'fournisseurs' ? { defaut: null, fournisseurs: [] } : { estUnRepas: true, aliments: [{ nom: 'Riz', quantiteG: 150, kcal100: 130, proteines100: 2.7, glucides100: 28, lipides100: 0.3, fibres100: null, confiance: 'haute' }], remarque: null })))
    monter('/nutrition/photo?partage=1')
    expect(await screen.findByText(/ce que j’ai reconnu/i)).toBeTruthy()
    expect(magasin.size).toBe(0)
    vi.unstubAllGlobals()
  })

  it('?partage=1 sans photo en attente : message clair, retour au choix de la photo', async () => {
    vi.stubGlobal('caches', { open: async () => ({ match: async () => undefined, delete: async () => true, put: async () => {} }) })
    monter('/nutrition/photo?partage=1')
    expect((await screen.findByRole('alert')).textContent).toMatch(/photo partagée n’a pas pu être lue/)
    expect(screen.getByText('Prendre une photo')).toBeTruthy()
    vi.unstubAllGlobals()
  })
})
