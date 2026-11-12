import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { ignorerOnboarding } from './onboarding.ts'
import { exigerVariables } from './prerequis.ts'
import { attendreServiceWorker } from './serviceWorker.ts'

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
  exigerVariables('E2E_EMAIL', 'E2E_PASSWORD')

  const contexteA = await browser.newContext()
  await ignorerOnboarding(contexteA)
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
  await carte.getByRole('button', { name: `Affecter ${SEANCE} au calendrier` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'est affectée' })).toBeVisible()
  await page.getByRole('link', { name: 'Ouvrir la séance' }).click()
  await expect(page.getByRole('heading', { level: 1, name: SEANCE })).toBeVisible()
  const urlSeance = page.url()

  // 3. Démarrer, couper le réseau, saisir 3 séries sur le premier exercice
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  // Le rechargement hors ligne (étape 4) exige le service worker du build actif et aux commandes
  await attendreServiceWorker(page)
  await contexteA.setOffline(true)
  await expect(page.getByTestId('sync-state')).toHaveText('hors ligne', { timeout: 30_000 })

  // Tableau des séries du premier exercice : une ligne par série (« Série 1G, répétitions » pour un exercice unilatéral),
  // validée par son bouton « Valider la série … » ; une série validée propose « Annuler la validation de la série … »
  const tableau = page.getByRole('table').first()
  const reps = tableau.getByLabel(/^Série \S+, répétitions$/)
  const charges = tableau.getByLabel(/^Série \S+, charge en kilogrammes$/)
  const validees = tableau.getByRole('button', { name: /^Annuler la validation de la série / })
  for (const [i, valeur] of [[0, '10'], [1, '9'], [2, '8']] as const) {
    await reps.nth(i).fill(valeur)
    await charges.nth(i).fill('17,5')
    await tableau.getByRole('button', { name: /^Valider la série / }).first().click()
    await expect(validees).toHaveCount(i + 1)
  }

  // 4. Rechargement hors ligne : aucune série perdue, le chrono repart des horodatages stockés
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: SEANCE })).toBeVisible({ timeout: 30_000 })
  const apres = page.getByRole('table').first()
  await expect(apres.getByRole('button', { name: /^Annuler la validation de la série / })).toHaveCount(3)
  await expect(apres.getByLabel(/^Série \S+, charge en kilogrammes$/).nth(2)).toHaveValue('17,5')
  await expect(page.getByRole('timer')).not.toHaveText('00:00')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

  // 5. Retour du réseau : la file d'envoi se vide
  await contexteA.setOffline(false)
  await expect(page.getByTestId('sync-state')).toHaveText('en ligne', { timeout: 60_000 })

  // 6. Second appareil : les 3 séries arrivent par la synchro
  const contexteB = await browser.newContext()
  await ignorerOnboarding(contexteB)
  const pageB = await contexteB.newPage()
  await seConnecter(pageB, new URL(urlSeance).pathname)
  // L'écran lit la base à l'ouverture : sur un appareil neuf, la séance peut ne pas être encore arrivée (« Séance
  // introuvable »). On attend la synchro, puis on recharge jusqu'à voir les 3 séries.
  await expect(pageB.getByTestId('sync-state')).toHaveText('en ligne', { timeout: 60_000 })
  const tableauB = pageB.getByRole('table').first()
  await expect(async () => {
    await pageB.reload()
    await expect(tableauB.getByRole('button', { name: /^Annuler la validation de la série / })).toHaveCount(3, { timeout: 5_000 })
  }).toPass({ timeout: 60_000 })

  await contexteA.close()
  await contexteB.close()
})
