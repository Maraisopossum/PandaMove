import { expect, test, type Page } from '@playwright/test'
import { ignorerOnboarding } from './onboarding.ts'
import { exigerVariables } from './prerequis.ts'

// Barrière de l'étape 1 : une écriture faite hors ligne arrive sur un second appareil après reconnexion.
// Prérequis : Supabase local + PowerSync (dev/docker-compose.powersync.yml), web/.env.local renseigné,
// et un compte de test existant fourni par E2E_EMAIL / E2E_PASSWORD (jamais écrits en dur).
const email = process.env.E2E_EMAIL
const motDePasse = process.env.E2E_PASSWORD

async function seConnecter(page: Page) {
  await page.goto('/debug/write')
  await page.getByLabel('Adresse e-mail').fill(email!)
  await page.getByLabel('Mot de passe').fill(motDePasse!)
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByRole('button', { name: 'Ajouter une séance' })).toBeVisible()
}

test('une séance créée hors ligne est synchronisée vers un second appareil', async ({ browser }) => {
  exigerVariables('E2E_EMAIL', 'E2E_PASSWORD')

  const contexteA = await browser.newContext()
  await ignorerOnboarding(contexteA)
  const pageA = await contexteA.newPage()
  await seConnecter(pageA)
  await expect(pageA.getByTestId('sync-state')).toHaveText('en ligne', { timeout: 30_000 })

  // Coupure réseau, puis écriture locale
  await contexteA.setOffline(true)
  await expect(pageA.getByTestId('sync-state')).toHaveText('hors ligne', { timeout: 30_000 })
  await pageA.getByRole('button', { name: 'Ajouter une séance' }).click()
  // La ligne est visible localement même sans réseau ; la liste est triée de la plus récente à la plus ancienne
  const lignes = pageA.getByRole('main').getByRole('listitem')
  await expect(lignes.first()).toContainText('Debug ')
  const nomLocal = (await lignes.first().textContent())!.trim()

  // Retour du réseau : la synchro repasse « en ligne » une fois l'envoi terminé
  await contexteA.setOffline(false)
  await expect(pageA.getByTestId('sync-state')).toHaveText('en ligne', { timeout: 60_000 })

  // Second appareil (contexte isolé, donc base locale vierge) : la séance doit arriver par la synchro
  const contexteB = await browser.newContext()
  await ignorerOnboarding(contexteB)
  const pageB = await contexteB.newPage()
  await seConnecter(pageB)
  await expect(pageB.getByRole('main').getByRole('listitem').filter({ hasText: nomLocal })).toBeVisible({ timeout: 60_000 })

  await contexteA.close()
  await contexteB.close()
})
