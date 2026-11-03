import { expect, test, type Page } from '@playwright/test'
import { ignorerOnboarding } from './onboarding.ts'
import { exigerVariables } from './prerequis.ts'

// Parcours des séances de cardio dans l'agenda : ajouter une séance de course, la voir dans « Prochaines séances »,
// la valider, constater qu'elle ne se déplace pas, la dévalider, la déplacer, puis la supprimer (le test nettoie ses données).
// Mêmes prérequis que strength-flow.spec.ts : Supabase local + PowerSync, web/.env.local,
// et un compte de test fourni par E2E_EMAIL / E2E_PASSWORD (jamais écrits en dur).
const email = process.env.E2E_EMAIL
const motDePasse = process.env.E2E_PASSWORD

const jourIso = (decalage: number) => {
  const d = new Date()
  d.setDate(d.getDate() + decalage)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function seConnecter(page: Page, chemin: string) {
  await page.goto(chemin)
  await page.getByLabel('Adresse e-mail').fill(email!)
  await page.getByLabel('Mot de passe').fill(motDePasse!)
  await page.getByRole('button', { name: 'Se connecter' }).click()
}

test('séance de cardio : ajouter, valider, ne pas déplacer tant que validée, dévalider, déplacer, supprimer', async ({ browser }) => {
  exigerVariables('E2E_EMAIL', 'E2E_PASSWORD')

  const contexte = await browser.newContext()
  await ignorerOnboarding(contexte)
  const page = await contexte.newPage()
  const titre = `Footing e2e ${Date.now()}`

  // 1. Ajout depuis l'agenda, à une date proche
  await seConnecter(page, '/calendar')
  await expect(page.getByRole('button', { name: /Ajouter une séance de cardio/ })).toBeVisible()
  await page.getByRole('button', { name: /Ajouter une séance de cardio/ }).click()
  const feuille = page.getByRole('dialog')
  await feuille.getByLabel('Titre').fill(titre)
  await feuille.getByLabel('Date').fill(jourIso(2))
  await feuille.getByLabel('Détail').fill('45 min · Z2')
  await feuille.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(feuille).toBeHidden()

  // 2. La séance apparaît dans « Prochaines séances »
  const prochaines = page.getByRole('region', { name: 'Prochaines séances' })
  const ligne = prochaines.getByRole('listitem').filter({ hasText: titre })
  await expect(ligne).toBeVisible()
  await expect(ligne).toContainText('45 min · Z2')

  // 3. Validation : elle quitte « Prochaines séances » (seules les non validées y restent)
  await ligne.getByRole('button', { name: new RegExp(`^Valider ${titre}`) }).click()
  await expect(prochaines.getByRole('listitem').filter({ hasText: titre })).toHaveCount(0)

  // 4. Retrouver la séance validée dans le jour choisi, constater le refus de déplacement
  const libelleJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${jourIso(2)}T12:00:00`),
  )
  await page.getByRole('button', { name: new RegExp(`^${libelleJour}, \\d+ séances?$`) }).click()
  const jour = page.getByRole('listitem').filter({ hasText: titre })
  await expect(jour.getByText('Validée')).toBeVisible()
  await jour.getByRole('button', { name: new RegExp(`^Changer la date de ${titre}`) }).click()
  // Le refus s'affiche tout de suite et le dialogue de date ne s'ouvre pas
  await expect(page.getByRole('alert').filter({ hasText: 'Dévalidez la séance pour la déplacer.' })).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()

  // 5. Dévalidation, puis déplacement accepté
  await jour.getByRole('button', { name: new RegExp(`^Dévalider ${titre}`) }).click()
  await expect(jour.getByRole('button', { name: new RegExp(`^Valider ${titre}`) })).toBeVisible()
  await jour.getByRole('button', { name: new RegExp(`^Changer la date de ${titre}`) }).click()
  await page.getByRole('dialog').getByLabel('Nouvelle date').fill(jourIso(4))
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(prochaines.getByRole('listitem').filter({ hasText: titre })).toBeVisible()

  // 6. Nettoyage : suppression de la séance du test
  await prochaines
    .getByRole('listitem')
    .filter({ hasText: titre })
    .getByRole('button', { name: new RegExp(`^Supprimer ${titre}`) })
    .click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click()
  await expect(prochaines.getByRole('listitem').filter({ hasText: titre })).toHaveCount(0)
  await contexte.close()
})
