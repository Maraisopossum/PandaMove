import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { ignorerOnboarding } from './onboarding.ts'
import { exigerVariables } from './prerequis.ts'

// Isolation RLS vérifiée sur le VRAI Supabase (complément des tests PGlite de supabase/tests).
// Deux comptes de test distincts, fournis par variables d'environnement (jamais écrits en dur) :
//   E2E_EMAIL / E2E_PASSWORD (compte A) et E2E_EMAIL2 / E2E_PASSWORD2 (compte B).
// URL et clé publique Supabase lues dans web/.env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
// Prérequis : migrations 0001 à 0006 exécutées (0006 retire tout droit au rôle anon).

const VARIABLES = ['E2E_EMAIL', 'E2E_PASSWORD', 'E2E_EMAIL2', 'E2E_PASSWORD2']
const TABLES = [
  'exercises', 'seances', 'blocs_seance', 'exercices_seance',
  'instances_seance', 'series_realisees', 'objectifs_progression', 'user_settings',
]

const envVite = loadEnv('development', path.resolve(import.meta.dirname, '..'), 'VITE_')
const urlSupabase = process.env.VITE_SUPABASE_URL ?? envVite.VITE_SUPABASE_URL
const clePublique = process.env.VITE_SUPABASE_ANON_KEY ?? envVite.VITE_SUPABASE_ANON_KEY

const nouveauClient = () =>
  createClient(urlSupabase!, clePublique!, { auth: { persistSession: false, autoRefreshToken: false } })

async function connecter(email: string, motDePasse: string): Promise<{ client: SupabaseClient; userId: string }> {
  const client = nouveauClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password: motDePasse })
  if (error) throw error
  return { client, userId: data.user.id }
}

test.describe('RLS sur Supabase réel', () => {
  test.beforeEach(() => {
    exigerVariables(...VARIABLES)
    if (!urlSupabase || !clePublique) {
      throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont requis (web/.env.local)')
    }
  })

  test("le compte B ne lit ni ne modifie aucune ligne du compte A ; anon n'a aucun accès", async () => {
    const a = await connecter(process.env.E2E_EMAIL!, process.env.E2E_PASSWORD!)
    const b = await connecter(process.env.E2E_EMAIL2!, process.env.E2E_PASSWORD2!)
    expect(b.userId).not.toBe(a.userId)

    // A écrit une séance (user_id rempli par le défaut serveur auth.uid())
    const id = randomUUID()
    const insertion = await a.client.from('seances').insert({
      id, nom: `RLS e2e ${id.slice(0, 8)}`, groupes_musculaires: '', duree_estimee_min: 1, notes: '',
      seance_category: 'STRENGTH', created_at: new Date().toISOString(), is_archived: false,
    })
    expect(insertion.error).toBeNull()

    try {
      // B : aucune ligne d'un autre utilisateur, dans aucune table
      for (const table of TABLES) {
        const { data, error } = await b.client.from(table).select('id').neq('user_id', b.userId).limit(1)
        expect(error, table).toBeNull()
        expect(data, table).toEqual([])
      }
      // B ne voit pas la ligne de A par son id, et ne peut pas la modifier
      const lecture = await b.client.from('seances').select('id').eq('id', id)
      expect(lecture.data).toEqual([])
      const modif = await b.client.from('seances').update({ nom: 'piraté' }).eq('id', id).select('id')
      expect(modif.data ?? []).toEqual([])
      const relue = await a.client.from('seances').select('nom').eq('id', id).single()
      expect(relue.data?.nom).toMatch(/^RLS e2e /)

      // anon (non connecté) : refus de droit (migration 0006), pas seulement zéro ligne
      const anon = await nouveauClient().from('seances').select('id').limit(1)
      expect(anon.error?.code).toBe('42501')
    } finally {
      // Nettoyage par suppression logique (le DELETE physique n'est pas accordé)
      await a.client.from('seances').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      await a.client.auth.signOut()
      await b.client.auth.signOut()
    }
  })

  test("une séance créée par A dans l'appli n'arrive jamais sur l'appareil de B", async ({ browser }) => {
    async function seConnecter(page: Page, email: string, motDePasse: string) {
      await page.goto('/debug/write')
      await page.getByLabel('Adresse e-mail').fill(email)
      await page.getByLabel('Mot de passe').fill(motDePasse)
      await page.getByRole('button', { name: 'Se connecter' }).click()
      await expect(page.getByRole('button', { name: 'Ajouter une séance' })).toBeVisible()
      await expect(page.getByTestId('sync-state')).toHaveText('en ligne', { timeout: 60_000 })
    }

    const contexteA = await browser.newContext()
    await ignorerOnboarding(contexteA)
    const pageA = await contexteA.newPage()
    await seConnecter(pageA, process.env.E2E_EMAIL!, process.env.E2E_PASSWORD!)
    await pageA.getByRole('button', { name: 'Ajouter une séance' }).click()
    const lignesA = pageA.getByRole('main').getByRole('listitem')
    await expect(lignesA.first()).toContainText('Debug ')
    const nomA = (await lignesA.first().textContent())!.trim()
    // Preuve côté SERVEUR que la séance de A est arrivée (« en ligne » ne garantit pas la fin de l'envoi) :
    // sans cela, un envoi jamais parti laisserait B vide et le test passerait à tort.
    const a = await connecter(process.env.E2E_EMAIL!, process.env.E2E_PASSWORD!)
    try {
      await expect
        .poll(async () => (await a.client.from('seances').select('id').eq('nom', nomA)).data?.length ?? 0, {
          timeout: 60_000,
        })
        .toBe(1)

      const contexteB = await browser.newContext()
      await ignorerOnboarding(contexteB)
      const pageB = await contexteB.newPage()
      await seConnecter(pageB, process.env.E2E_EMAIL2!, process.env.E2E_PASSWORD2!)
      // Laisse le temps à une éventuelle synchro (fuite) d'arriver, puis vérifie l'absence
      await pageB.waitForTimeout(5_000)
      await expect(pageB.getByRole('main').getByRole('listitem').filter({ hasText: nomA })).toHaveCount(0)
      await contexteB.close()
    } finally {
      // Nettoyage : suppression logique de la séance de debug de A (pas de DELETE physique)
      await a.client.from('seances').update({ deleted_at: new Date().toISOString() }).eq('nom', nomA)
      await a.client.auth.signOut()
      await contexteA.close()
    }
  })
})
