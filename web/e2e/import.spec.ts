import path from 'node:path'
import { expect, test } from '@playwright/test'
import { ignorerOnboarding } from './onboarding.ts'
import { exigerVariables } from './prerequis.ts'

// Import d'un export Android synthétique v3.2 : aperçu, confirmation, résumé.
// Mêmes prérequis que offline-sync.spec.ts : Supabase local + PowerSync, web/.env.local,
// et un compte de test fourni par E2E_EMAIL / E2E_PASSWORD (jamais écrits en dur).
// Les séances importées ne sont pas relues dans /strength (l'écran liste n'existe pas encore).
const email = process.env.E2E_EMAIL
const motDePasse = process.env.E2E_PASSWORD
const fixture = path.resolve(import.meta.dirname, '../src/core/import/__fixtures__/export-v3.2.json')

test("l'import d'un export v3.2 affiche l'aperçu puis le résumé", async ({ page }) => {
  exigerVariables('E2E_EMAIL', 'E2E_PASSWORD')

  await ignorerOnboarding(page.context())
  await page.goto('/import')
  await page.getByLabel('Adresse e-mail').fill(email!)
  await page.getByLabel('Mot de passe').fill(motDePasse!)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible()

  await page.getByLabel("Fichier d'export (.json)").setInputFiles(fixture)
  await expect(page.getByRole('heading', { name: 'Aperçu' })).toBeVisible()
  await expect(page.getByText('2 séance(s)', { exact: true })).toBeVisible()
  await expect(page.getByText(/remplace les éléments correspondants déjà présents/)).toBeVisible()

  await page.getByRole('button', { name: "Confirmer l'import" }).click()
  await expect(page.getByRole('heading', { name: 'Import terminé' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('status')).toContainText('2 séance(s)')
})
