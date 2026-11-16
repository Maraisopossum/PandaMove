// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientSupabase } from '../../core/db/clientSupabase'
import { adresseFonctionWidget, creerJeton, ilYaDepuis, listerJetons } from '../../core/widget/jetons'
import { WidgetAndroid } from './WidgetAndroid'

afterEach(cleanup)

const MAINT = new Date('2026-11-15T12:00:00Z')
const JETON = `pmw_${'cd34'.repeat(16)}`
const ligne = (id: string, nom: string, extra: Record<string, unknown> = {}) => ({ id, nom, ecriture_eau: false, created_at: '2026-11-10T08:00:00Z', derniere_lecture_at: null, ...extra })

// Client factice : table jetons_widget en mémoire + fonctions SQL (creer, revoquer, regler)
function client(initial: ReturnType<typeof ligne>[] = [], erreurRpc: { message: string; code?: string } | null = null) {
  const lignes = [...initial]
  const rpc = vi.fn(async (fonction: string, args: Record<string, unknown> = {}) => {
    if (erreurRpc) return { data: null, error: erreurRpc }
    if (fonction === 'creer_jeton_widget') {
      lignes.push(ligne(`id${lignes.length + 1}`, String(args.p_nom), { ecriture_eau: args.p_ecriture_eau }))
      return { data: JETON, error: null }
    }
    if (fonction === 'revoquer_jeton_widget') lignes.splice(lignes.findIndex((l) => l.id === args.p_id), 1)
    if (fonction === 'regler_eau_jeton_widget') lignes.find((l) => l.id === args.p_id)!.ecriture_eau = args.p_actif === true
    return { data: null, error: null }
  })
  const from = vi.fn(() => {
    const requete = { select: () => requete, is: () => requete, order: async () => ({ data: lignes, error: null }) }
    return requete
  })
  return { c: { from, rpc } as unknown as ClientSupabase, rpc, from, lignes }
}

const monter = (c: ClientSupabase, adresse: string | null = 'https://abc.supabase.co/functions/v1/widget-nutrition') =>
  render(<WidgetAndroid client={c} maintenant={() => MAINT} adresse={adresse} />)

describe('accès aux jetons (core/widget)', () => {
  it('formate l’ancienneté de la dernière lecture', () => {
    expect(ilYaDepuis(null, MAINT)).toBeNull()
    expect(ilYaDepuis('pas une date', MAINT)).toBeNull()
    expect(ilYaDepuis('2026-11-15T11:59:50Z', MAINT)).toBe('à l’instant')
    expect(ilYaDepuis('2026-11-15T11:48:00Z', MAINT)).toBe('il y a 12 min')
    expect(ilYaDepuis('2026-11-15T09:00:00Z', MAINT)).toBe('il y a 3 h')
    expect(ilYaDepuis('2026-11-10T12:00:00Z', MAINT)).toBe('il y a 5 j')
  })

  it('déduit l’adresse de la fonction de celle de Supabase', () => {
    expect(adresseFonctionWidget('https://abc.supabase.co/')).toBe('https://abc.supabase.co/functions/v1/widget-nutrition')
    expect(adresseFonctionWidget('')).toBeNull()
    expect(adresseFonctionWidget('abc')).toBeNull()
  })

  it('liste les jetons actifs ; migration absente : liste illisible (null) et message clair à la création', async () => {
    const { c } = client([ligne('a', 'Téléphone', { derniere_lecture_at: '2026-11-15T11:00:00Z' })])
    expect(await listerJetons(c)).toEqual([{ id: 'a', nom: 'Téléphone', ecritureEau: false, creeLe: '2026-11-10T08:00:00Z', derniereLectureLe: '2026-11-15T11:00:00Z' }])
    const casse = { from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: null, error: { code: '42P01', message: 'relation absente' } }) }) }) }) } as unknown as ClientSupabase
    expect(await listerJetons(casse)).toBeNull()
    await expect(creerJeton(client([], { message: 'x', code: 'PGRST202' }).c, 'N', false)).rejects.toThrow(/migration 0021/)
  })
})

describe('section Widget Android du profil', () => {
  it('sans widget : explique et propose d’en relier un', async () => {
    monter(client().c)
    expect(await screen.findByText('Aucun widget relié pour l’instant.')).toBeTruthy()
    expect(screen.getByText(/jamais un nom d’aliment/)).toBeTruthy()
  })

  it('relie un widget : le jeton n’est montré qu’une fois, avec l’adresse, puis disparaît', async () => {
    const { c, rpc } = client()
    monter(c)
    fireEvent.click(await screen.findByRole('button', { name: 'Relier un widget' }))
    const creer = screen.getByRole('button', { name: 'Créer le jeton' }) as HTMLButtonElement
    expect(creer.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Nom du widget'), { target: { value: '  Mon Pixel  ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Ajouter de l’eau depuis le widget/ }))
    fireEvent.click(creer)
    const groupe = await screen.findByRole('group', { name: 'Jeton du nouveau widget' })
    expect(within(groupe).getByText(JETON)).toBeTruthy()
    expect(within(groupe).getByText('https://abc.supabase.co/functions/v1/widget-nutrition')).toBeTruthy()
    expect(rpc).toHaveBeenCalledWith('creer_jeton_widget', { p_nom: 'Mon Pixel', p_ecriture_eau: true })
    // Le widget apparaît dans la liste, sans le jeton
    expect(await screen.findByRole('list', { name: 'Widgets reliés' })).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Widgets reliés' })).queryByText(JETON)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'J’ai fini' }))
    expect(screen.queryByText(JETON)).toBeNull()
  })

  it('copie le jeton dans le presse-papiers', async () => {
    const ecrire = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText: ecrire } })
    monter(client().c)
    fireEvent.click(await screen.findByRole('button', { name: 'Relier un widget' }))
    fireEvent.change(screen.getByLabelText('Nom du widget'), { target: { value: 'Pixel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le jeton' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Copier le jeton' }))
    await waitFor(() => expect(ecrire).toHaveBeenCalledWith(JETON))
    expect(await screen.findByText('Jeton copié.')).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('montre la dernière lecture, règle l’option eau et révoque après confirmation', async () => {
    const { c, rpc, lignes } = client([ligne('a', 'Pixel', { derniere_lecture_at: '2026-11-15T11:48:00Z' }), ligne('b', 'Tablette')])
    monter(c)
    const liste = await screen.findByRole('list', { name: 'Widgets reliés' })
    expect(liste.textContent).toContain('lu il y a 12 min')
    expect(liste.textContent).toContain('jamais lu')
    fireEvent.click(within(liste).getByRole('checkbox', { name: 'Ajouter de l’eau depuis Pixel' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('regler_eau_jeton_widget', { p_id: 'a', p_actif: true }))
    fireEvent.click(within(liste).getByRole('button', { name: 'Révoquer Tablette' }))
    fireEvent.click(within(liste).getByRole('button', { name: 'Confirmer la révocation' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('revoquer_jeton_widget', { p_id: 'b' }))
    expect(await screen.findByText('« Tablette » révoqué.')).toBeTruthy()
    expect(lignes.map((l) => l.nom)).toEqual(['Pixel'])
  })

  it('annuler la révocation ne révoque rien', async () => {
    const { c, rpc } = client([ligne('a', 'Pixel')])
    monter(c)
    fireEvent.click(await screen.findByRole('button', { name: 'Révoquer Pixel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByRole('button', { name: 'Révoquer Pixel' })).toBeTruthy()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('migration absente : message clair, rien ne casse', async () => {
    const casse = { from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: null, error: { code: '42P01', message: 'absente' } }) }) }) }), rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'absente' } }) } as unknown as ClientSupabase
    monter(casse)
    expect((await screen.findByRole('status')).textContent).toMatch(/migration 0021/)
    fireEvent.click(screen.getByRole('button', { name: 'Relier un widget' }))
    fireEvent.change(screen.getByLabelText('Nom du widget'), { target: { value: 'Pixel' } })
    fireEvent.click(screen.getByRole('button', { name: 'Créer le jeton' }))
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => /migration 0021/.test(a.textContent ?? ''))).toBe(true))
  })
})
