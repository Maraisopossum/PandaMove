import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

// Parcours renforcement complet, au cœur de la règle « ne jamais perdre une série » :
// import du fixture synthétique, affectation depuis la liste, exécution, 3 séries saisies réseau
// coupé, rechargement de la page (séries et chrono restitués), retour du réseau, puis lecture des
// séries depuis un second appareil (contexte vierge).
// Mêmes prérequis que offline-sync.spec.ts : Supabase local + PowerSync, web/.env.local,
// et un compte de test fourni par E2E_EMAIL / E2E_PASSWORD (jamais écrits en dur).
const email = process.env.E2E_EMAIL
const motDePasse = process.env.E2E_PASSWORD
const fixture = path.resolve(import.meta.dirname, '../src/core/import/__fixtures__/export-v3.2.json')
const SEANCE = 'Haut du corps A'

async function seConnecter(page: Page, chemin: string) {
  await page.goto(chemin)
  await page.getByLabel('Adresse e-mail').fill(email!)
  await page.getByLabel('Mot de passe').fill(motDePasse!)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

test('séries saisies hors ligne : conservées au rechargement puis synchronisées', async ({ browser }) => {
  test.skip(!email || !motDePasse, 'E2E_EMAIL et E2E_PASSWORD sont requis')

  const contexteA = await browser.newContext()
  const page = await contexteA.newPage()

  // 1. Import du fixture (idempotent : rejouer le test ne duplique rien)
  await seConnecter(page, '/import')
  await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible()
  await page.getByLabel("Fichier d'export (.json)").setInputFiles(fixture)
  await page.getByRole('button', { name: "Confirmer l'import" }).click()
  await expect(page.getByRole('heading', { name: 'Import terminé' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('sync-state')).toHaveText('en ligne', { timeout: 60_000 })

  // 2. Affectation depuis la liste (seul écran portant le 📅), puis ouverture de la séance
  await page.goto('/strength')
  const carte = page.getByRole('listitem').filter({ hasText: SEANCE })
  await carte.getByRole('button', { name: 'Affecter à une date' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'est affectée' })).toBeVisible()
  await page.getByRole('link', { name: 'Ouvrir la séance' }).click()
  await expect(page.getByRole('heading', { level: 1, name: SEANCE })).toBeVisible()
  const urlSeance = page.url()

  // 3. Démarrer, couper le réseau, saisir 3 séries sur le premier exercice
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await contexteA.setOffline(true)
  await expect(page.getByTestId('sync-state')).toHaveText('hors ligne', { timeout: 30_000 })

  const exercice = page.getByRole('article').first()
  const formulaire = exercice.locator('form')
  for (const [n, reps] of [[1, '10'], [2, '9'], [3, '8']] as const) {
    await formulaire.getByLabel('Répétitions').fill(reps)
    await formulaire.getByLabel('Charge (kg)').fill('17,5')
    await formulaire.getByRole('button', { name: 'Valider la série' }).click()
    await expect(exercice.getByRole('group', { name: `Série ${n}` })).toBeVisible()
  }

  // 4. Rechargement hors ligne : aucune série perdue, le chrono repart des horodatages stockés
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: SEANCE })).toBeVisible({ timeout: 30_000 })
  const apres = page.getByRole('article').first()
  for (const n of [1, 2, 3]) {
    await expect(apres.getByRole('group', { name: `Série ${n}` })).toBeVisible()
  }
  await expect(apres.getByRole('group', { name: 'Série 3' }).getByLabel('Charge (kg)')).toHaveValue('17.5')
  await expect(page.getByRole('timer')).not.toHaveText('00:00')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

  // 5. Retour du réseau : la file d'envoi se vide
  await contexteA.setOffline(false)
  await expect(page.getByTestId('sync-state')).toHaveText('en ligne', { timeout: 60_000 })

  // 6. Second appareil : les 3 séries arrivent par la synchro
  const contexteB = await browser.newContext()
  const pageB = await contexteB.newPage()
  await seConnecter(pageB, new URL(urlSeance).pathname)
  const exerciceB = pageB.getByRole('article').first()
  await expect(exerciceB.getByRole('group', { name: 'Série 3' })).toBeVisible({ timeout: 60_000 })
  await expect(exerciceB.getByRole('group', { name: 'Série 1' })).toBeVisible()

  await contexteA.close()
  await contexteB.close()
})
