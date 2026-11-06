// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../../core/db/Db'
import { creer, definirValidation } from '../../core/db/repos/seancesCardio'
import { inserer } from '../../test/fixtures'
import { createTestDb } from '../../test/sqliteDb'

let base: Db
vi.mock('../../core/db/client', () => ({ getDb: () => base }))
vi.mock('../../core/auth/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } } }) }))

import CalendarScreen from './CalendarScreen'

const b = { user_id: 'u1', updated_at: 'u0', deleted_at: null }

beforeEach(async () => {
  // Seule l'horloge est simulée : les minuteries réelles servent toujours à waitFor
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 24, 15, 0)) // samedi 24 octobre 2026
  base = createTestDb()
  await inserer(base, 'seances', { ...b, id: 's1', nom: 'Pull', is_archived: 0, created_at: 'c' })
  await inserer(base, 'seances', { ...b, id: 's2', nom: 'Jambes', is_archived: 0, created_at: 'c' })
  await inserer(base, 'instances_seance', { ...b, id: 'plan', seance_id: 's1', date: '2026-10-24', is_completed: 0 })
  await inserer(base, 'instances_seance', { ...b, id: 'plan2', seance_id: 's2', date: '2026-10-24', is_completed: 0 })
  await inserer(base, 'instances_seance', {
    ...b, id: 'fait', seance_id: 's1', date: '2026-10-05', is_completed: 1, duration_seconds: 3000,
  })
  await inserer(base, 'instances_seance', { ...b, id: 'futur', seance_id: 's1', date: '2026-11-10', is_completed: 0 })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function monter() {
  return render(
    <MemoryRouter>
      <CalendarScreen />
    </MemoryRouter>,
  )
}

const prochaines = () => within(screen.getByRole('region', { name: 'Prochaines séances' }))

describe('CalendarScreen', () => {
  it('affiche le mois courant, l\'en-tête des jours et un bouton par jour avec nom accessible', async () => {
    monter()
    expect(await screen.findByRole('heading', { name: 'octobre 2026' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 2 séances' }).getAttribute('aria-current')).toBe('date')
    expect(screen.getByRole('button', { name: 'lundi 5 octobre 2026, 1 séance' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'mardi 6 octobre 2026, aucune séance' })).toBeTruthy()
    expect(document.querySelectorAll('.calendrier__jour')).toHaveLength(35)
    expect(screen.getByRole('button', { name: /lundi 28 septembre 2026/ })).toBeTruthy()
    expect(document.body.textContent).toContain('lun.')
    expect(document.body.textContent).toContain('dim.')
  })

  it('les points de la grille portent la couleur du sport (renforcement) et une séance terminée est estompée', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    const jour = (nom: string) => screen.getByRole('button', { name: nom })
    // Le 24 : deux séances de renforcement programmées ; le 5 : une séance terminée
    const pointsAuj = jour('samedi 24 octobre 2026, 2 séances').querySelectorAll('.calendrier__point')
    expect(pointsAuj).toHaveLength(2)
    for (const p of pointsAuj) expect(p.className).toContain('calendrier__point--renfo')
    expect(jour('lundi 5 octobre 2026, 1 séance').querySelector('.calendrier__point--terminee.calendrier__point--renfo')).not.toBeNull()
    // La légende nomme les trois sports
    const legende = document.querySelector('.calendrier__legende')
    expect(legende?.textContent).toContain('Renforcement')
    expect(legende?.textContent).toContain('Course')
    expect(legende?.textContent).toContain('Vélo')
  })

  it("sélectionne aujourd'hui par défaut et affiche ses séances avec les liens d'ouverture", async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    const panneau = screen.getByRole('region', { name: 'samedi 24 octobre 2026' })
    expect(within(panneau).getByText('Pull')).toBeTruthy()
    expect(within(panneau).getByText('Jambes')).toBeTruthy()
    const ouvrir = within(panneau).getByRole('link', { name: /Ouvrir Pull/ })
    expect(ouvrir.getAttribute('href')).toBe('/strength/instance/plan')
  })

  it('un jour choisi affiche ses séances ; une séance terminée ouvre le bilan et ne propose pas de changer la date', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'lundi 5 octobre 2026, 1 séance' }))
    const panneau = screen.getByRole('region', { name: 'lundi 5 octobre 2026' })
    expect(within(panneau).getByRole('link', { name: /Ouvrir Pull/ }).getAttribute('href')).toBe('/strength/instance/fait/report')
    expect(within(panneau).queryByRole('button', { name: /Changer la date/ })).toBeNull()
    expect(within(panneau).getByRole('button', { name: /Supprimer Pull/ })).toBeTruthy()
    expect(within(panneau).getByText(/Terminée · 50 min/)).toBeTruthy()
  })

  it('un jour sans séance le dit', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'mardi 6 octobre 2026, aucune séance' }))
    expect(screen.getByText('Aucune séance ce jour-là.')).toBeTruthy()
  })

  it('navigation : mois suivant, précédent et « Aujourd\'hui »', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }))
    expect(await screen.findByRole('heading', { name: 'novembre 2026' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'mardi 10 novembre 2026, 1 séance' })).toBeTruthy()
    // pas de sélection par défaut hors du mois courant
    expect(screen.queryByRole('region', { name: /octobre|novembre/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }))
    expect(await screen.findByRole('heading', { name: 'septembre 2026' })).toBeTruthy()
    expect(await screen.findByText('Aucune séance ce mois-ci.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: "Aujourd'hui" }))
    expect(await screen.findByRole('heading', { name: 'octobre 2026' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).toBeTruthy()
  })

  it('filtre terminées : la grille ne garde que les terminées, les prochaines ne changent pas', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'Terminées' }))
    expect(screen.getByRole('button', { name: 'Terminées' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, aucune séance' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'lundi 5 octobre 2026, 1 séance' })).toBeTruthy()
    expect(prochaines().getAllByRole('listitem')).toHaveLength(3)
  })

  it('« Prochaines séances » : date, nom, lien ; états vides', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    const lignes = prochaines().getAllByRole('listitem')
    expect(lignes).toHaveLength(3) // plan, plan2, futur (la terminée est exclue)
    expect(within(lignes[2]).getByRole('link', { name: /Ouvrir Pull/ }).getAttribute('href')).toBe('/strength/instance/futur')
    expect(lignes[2].textContent).toContain('10 nov.')
  })

  it('base vide : messages vides et aucune erreur', async () => {
    base = createTestDb()
    monter()
    expect(await screen.findByText('Aucune séance ce mois-ci.')).toBeTruthy()
    expect(screen.getByText('Aucune séance à venir.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    // Panda au repos, décoratif (le texte porte le sens), dimensionné, chargé à la demande
    await waitFor(() => expect(document.querySelector('img.calendrier__panda')).not.toBeNull())
    const panda = document.querySelector('img.calendrier__panda')!
    expect(panda.getAttribute('alt')).toBe('')
    expect(panda.getAttribute('src')).toBe('/panda/pose-sitting-male-sm.webp')
    expect(panda.getAttribute('loading')).toBe('lazy')
    expect(panda.getAttribute('width')).toBe('320')
  })

  it('aucune icône 📅 dans le calendrier (réservée à la liste des séances)', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getAllByRole('button', { name: /Changer la date de Pull, samedi 24 octobre 2026/ })[0])
    expect(document.body.textContent).not.toContain('📅')
    expect(document.body.innerHTML).not.toContain('📅')
    expect(screen.queryByLabelText('Affecter à une date')).toBeNull()
  })

  describe('dialogue « Changer la date »', () => {
    it('rôle dialog arrondi, focus initial sur le champ date, Échap ferme et rend le focus', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      const declencheur = within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', {
        name: /Changer la date de Pull/,
      })
      declencheur.focus()
      fireEvent.click(declencheur)
      const dialogue = await screen.findByRole('dialog')
      expect(dialogue.getAttribute('aria-modal')).toBe('true')
      const champ = within(dialogue).getByLabelText('Nouvelle date') as HTMLInputElement
      expect(champ.type).toBe('date')
      expect(champ.value).toBe('2026-10-24')
      expect(document.activeElement).toBe(champ)
      fireEvent.keyDown(document, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement).toBe(declencheur)
    })

    it('Confirmer déplace la séance et la grille se met à jour', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      fireEvent.click(
        within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', { name: /Changer la date de Pull/ }),
      )
      const dialogue = await screen.findByRole('dialog')
      fireEvent.change(within(dialogue).getByLabelText('Nouvelle date'), { target: { value: '2026-10-27' } })
      fireEvent.click(within(dialogue).getByRole('button', { name: 'Confirmer' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(await screen.findByRole('button', { name: 'mardi 27 octobre 2026, 1 séance' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 1 séance' })).toBeTruthy()
    })

    it('Annuler ne change rien', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      fireEvent.click(
        within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', { name: /Changer la date de Pull/ }),
      )
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Annuler' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 2 séances' })).toBeTruthy()
    })
  })

  describe('dialogue de suppression', () => {
    async function ouvrir() {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      const declencheur = within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', {
        name: /Supprimer Pull/,
      })
      declencheur.focus()
      fireEvent.click(declencheur)
      return { declencheur, dialogue: await screen.findByRole('dialog') }
    }

    it('texte de confirmation, arrondi 28 px, focus initial sur « Annuler », boutons ≥ 44 px', async () => {
      const { dialogue } = await ouvrir()
      expect(within(dialogue).getByText('Supprimer cette séance du calendrier ?')).toBeTruthy()
      expect(within(dialogue).getByText('Cette action est définitive.')).toBeTruthy()
      expect(document.activeElement).toBe(within(dialogue).getByRole('button', { name: 'Annuler' }))
      expect(dialogue.getAttribute('aria-labelledby')).toBeTruthy()
      expect(dialogue.classList.contains('dialogue')).toBe(true)
    })

    it('Échap ferme sans rien supprimer et rend le focus au déclencheur', async () => {
      const { declencheur } = await ouvrir()
      fireEvent.keyDown(document, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement).toBe(declencheur)
      expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 2 séances' })).toBeTruthy()
    })

    it('Supprimer retire la séance du calendrier', async () => {
      const { dialogue } = await ouvrir()
      fireEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(await screen.findByRole('button', { name: 'samedi 24 octobre 2026, 1 séance' })).toBeTruthy()
      const row = await base.getOptional<{ deleted_at: string | null }>("SELECT deleted_at FROM instances_seance WHERE id = 'plan'")
      expect(row?.deleted_at).not.toBeNull()
    })
  })

  it('une erreur de déplacement s\'affiche en français', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(
      within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' })).getByRole('button', { name: /Changer la date de Pull/ }),
    )
    const dialogue = await screen.findByRole('dialog')
    await base.execute("UPDATE instances_seance SET deleted_at = 'x' WHERE id = 'plan'")
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Confirmer' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/introuvable/i)
  })
})

// ── Séances de cardio (course, vélo) dans l'agenda ──
describe('séances de cardio', () => {
  const STRAVA = 'https://www.strava.com/activities/123456789'

  beforeEach(async () => {
    await creer(base, 'course', {
      id: 'c-footing', date: '2026-10-26', titre: 'Footing facile', detail: '40–45 min · Z1–Z2', consigne: 'Aisance respiratoire.', lien: STRAVA,
    })
    await creer(base, 'velo', { id: 'v-reprise', date: '2026-10-26', titre: 'Vélo de reprise', detail: '30 min · Z1–Z2', optionnelle: true })
    await creer(base, 'course', {
      id: 'c-rav', date: '2026-10-27', titre: '10 KM DU RAVENSBERG', detail: '10 km · endurance fondamentale', jalon: 'Ravensberg',
    })
    await creer(base, 'course', { id: 'c-valide', date: '2026-10-06', titre: 'Footing validé' })
    await definirValidation(base, 'course', 'c-valide', true)
    await creer(base, 'velo', { id: 'v-futur', date: '2026-11-12', titre: 'Sortie vélo longue' })
  })

  const jourLundi = () => fireEvent.click(screen.getByRole('button', { name: /^lundi 26 octobre 2026/ }))
  const panneauLundi = () => within(screen.getByRole('region', { name: 'lundi 26 octobre 2026' }))

  it('une ligne par séance de cardio, avec le genre en toutes lettres, le détail, la consigne et le lien « Statistiques »', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    jourLundi()
    const lignes = panneauLundi().getAllByRole('listitem')
    expect(lignes).toHaveLength(2)
    const footing = within(lignes[0])
    expect(footing.getByRole('heading', { name: 'Footing facile' })).toBeTruthy()
    expect(footing.getByText('Course')).toBeTruthy()
    expect(lignes[0].textContent).toContain('40–45 min · Z1–Z2')
    expect(footing.getByText('Aisance respiratoire.')).toBeTruthy()
    const lien = footing.getByRole('link', { name: /Statistiques/ }) as HTMLAnchorElement
    expect(lien.getAttribute('href')).toBe(STRAVA)
    expect(lien.getAttribute('target')).toBe('_blank')
    expect(lien.getAttribute('rel')).toBe('noopener noreferrer')
    expect(within(lignes[1]).getByText('Vélo')).toBeTruthy()
  })

  it('la mention « Optionnelle » et le jalon sont écrits en toutes lettres', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    jourLundi()
    expect(panneauLundi().getByText('Optionnelle')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^mardi 27 octobre 2026/ }))
    const panneau = within(screen.getByRole('region', { name: 'mardi 27 octobre 2026' }))
    expect(panneau.getByText('Jalon : Ravensberg')).toBeTruthy()
    expect(panneau.queryByText('Optionnelle')).toBeNull()
  })

  it("un lien non valide (reçu d'un autre appareil) s'affiche en texte brut, jamais cliquable", async () => {
    await base.execute("UPDATE seances_course SET lien = 'http://pirate.example/x' WHERE id = 'c-footing'")
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    jourLundi()
    expect(panneauLundi().queryByRole('link', { name: /Statistiques/ })).toBeNull()
    expect(document.querySelector('a[href^="http://pirate"]')).toBeNull()
    expect(panneauLundi().getByText(/http:\/\/pirate\.example\/x/)).toBeTruthy()
  })

  it('le bouton du jour nomme les séances de cardio (jamais la couleur seule)', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    expect(screen.getByRole('button', { name: 'lundi 26 octobre 2026, 2 séances dont Course : Footing facile, Vélo : Vélo de reprise' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'mardi 27 octobre 2026, 1 séance dont Course : 10 KM DU RAVENSBERG' })).toBeTruthy()
    // un jour sans cardio garde son nom habituel
    expect(screen.getByRole('button', { name: 'samedi 24 octobre 2026, 2 séances' })).toBeTruthy()
  })

  it('« Prochaines séances » mêle renforcement et cardio par date, sans les séances validées ; la date et le genre sont visibles', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    const lignes = prochaines().getAllByRole('listitem')
    const textes = lignes.map((l) => l.textContent ?? '')
    expect(textes.some((t) => t.includes('Footing validé'))).toBe(false)
    const ordre = ['Pull', 'Jambes', 'Footing facile', 'Vélo de reprise', 'RAVENSBERG', 'Pull', 'Sortie vélo longue']
    expect(lignes).toHaveLength(ordre.length)
    ordre.forEach((nom, i) => expect(textes[i]).toContain(nom))
    expect(textes[2]).toContain('lun. 26 oct.')
    expect(textes[2]).toContain('Course')
  })

  it('une séance validée affiche « Validée » et se dévalide ; une séance du renforcement n\'a ni « Valider » ni genre', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: /^mardi 6 octobre 2026/ }))
    const panneau = within(screen.getByRole('region', { name: 'mardi 6 octobre 2026' }))
    expect(panneau.getByText('Validée')).toBeTruthy()
    expect(panneau.getByRole('button', { name: /Dévalider Footing validé/ })).toBeTruthy()
    expect(panneau.queryByRole('button', { name: /^Valider/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^lundi 5 octobre 2026/ }))
    const renfo = within(screen.getByRole('region', { name: 'lundi 5 octobre 2026' }))
    expect(renfo.queryByRole('button', { name: /^Valider/ })).toBeNull()
    expect(renfo.queryByText('Course')).toBeNull()
  })

  it('Valider passe la séance à « Validée » et la retire des prochaines ; Dévalider la remet', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    jourLundi()
    fireEvent.click(panneauLundi().getByRole('button', { name: /^Valider Footing facile/ }))
    expect(await panneauLundi().findByRole('button', { name: /Dévalider Footing facile/ })).toBeTruthy()
    expect(panneauLundi().getByText('Validée')).toBeTruthy()
    expect(prochaines().queryByText('Footing facile')).toBeNull()
    expect((await base.get<{ is_validated: number }>("SELECT is_validated FROM seances_course WHERE id = 'c-footing'")).is_validated).toBe(1)
    fireEvent.click(panneauLundi().getByRole('button', { name: /Dévalider Footing facile/ }))
    expect(await panneauLundi().findByRole('button', { name: /^Valider Footing facile/ })).toBeTruthy()
    expect(prochaines().getByText('Footing facile')).toBeTruthy()
  })

  it('« Changer la date » sur une séance validée affiche le message à la place du dialogue', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: /^mardi 6 octobre 2026/ }))
    fireEvent.click(
      within(screen.getByRole('region', { name: 'mardi 6 octobre 2026' })).getByRole('button', { name: /Changer la date de Footing validé/ }),
    )
    expect((await screen.findByRole('alert')).textContent).toBe('Dévalidez la séance pour la déplacer.')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('« Changer la date » déplace une séance non validée', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    jourLundi()
    fireEvent.click(panneauLundi().getByRole('button', { name: /Changer la date de Footing facile/ }))
    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).getByText(/Changer la date de « Footing facile »/)).toBeTruthy()
    fireEvent.change(within(dialogue).getByLabelText('Nouvelle date'), { target: { value: '2026-10-29' } })
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Confirmer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByRole('button', { name: 'jeudi 29 octobre 2026, 1 séance dont Course : Footing facile' })).toBeTruthy()
    expect((await base.get<{ date: string }>("SELECT date FROM seances_course WHERE id = 'c-footing'")).date).toBe('2026-10-29')
  })

  it('« Supprimer » demande confirmation puis supprime logiquement la séance, validée ou non', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    jourLundi()
    fireEvent.click(panneauLundi().getByRole('button', { name: /Supprimer Vélo de reprise/ }))
    const dialogue = await screen.findByRole('dialog')
    expect(within(dialogue).getByText('Supprimer cette séance du calendrier ?')).toBeTruthy()
    expect(within(dialogue).getByText(/Vélo de reprise/)).toBeTruthy()
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(panneauLundi().queryByText('Vélo de reprise')).toBeNull())
    expect((await base.get<{ deleted_at: string | null }>("SELECT deleted_at FROM seances_velo WHERE id = 'v-reprise'")).deleted_at).not.toBeNull()
  })

  it('le filtre « Terminées » montre les séances de cardio validées, « Programmées » les autres', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'Terminées' }))
    expect(screen.getByRole('button', { name: 'mardi 6 octobre 2026, 1 séance dont Course : Footing validé' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'lundi 26 octobre 2026, aucune séance' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Programmées' }))
    expect(screen.getByRole('button', { name: 'mardi 6 octobre 2026, aucune séance' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^lundi 26 octobre 2026, 2 séances/ })).toBeTruthy()
  })
})

// ── Saisie d'une séance de cardio : ajout depuis le jour sélectionné, modification ──
describe('saisie d’une séance de cardio', () => {
  const ajouter = () => screen.getByRole('button', { name: /Ajouter une séance de cardio/ })
  const dialogue = async () => within(await screen.findByRole('dialog'))

  async function ouvrirAjout() {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    const declencheur = ajouter()
    declencheur.focus()
    fireEvent.click(declencheur)
    return { declencheur, d: await dialogue() }
  }

  it("un bouton « Ajouter une séance de cardio » est proposé sur le jour sélectionné, qu'il ait des séances ou non", async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    const panneau = within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' }))
    expect(panneau.getByRole('button', { name: /Ajouter une séance de cardio/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'mardi 6 octobre 2026, aucune séance' }))
    const vide = within(screen.getByRole('region', { name: 'mardi 6 octobre 2026' }))
    expect(vide.getByRole('button', { name: /Ajouter une séance de cardio/ })).toBeTruthy()
    expect(vide.getByText('Aucune séance ce jour-là.')).toBeTruthy()
  })

  it('ouvre le dialogue à la date du jour sélectionné, focus sur le titre ; Annuler le ferme et rend le focus', async () => {
    monter()
    await screen.findByRole('heading', { name: 'octobre 2026' })
    fireEvent.click(screen.getByRole('button', { name: /^mardi 6 octobre 2026/ }))
    const declencheur = ajouter()
    declencheur.focus()
    fireEvent.click(declencheur)
    const d = await dialogue()
    expect(d.getByRole('heading', { name: 'Ajouter une séance de cardio' })).toBeTruthy()
    expect((d.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-10-06')
    expect(document.activeElement).toBe(d.getByLabelText('Titre'))
    fireEvent.click(d.getByRole('button', { name: 'Annuler' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(declencheur)
  })

  it('crée une séance de vélo : elle apparaît sur le jour, avec son genre en toutes lettres, et est écrite en base', async () => {
    const { d } = await ouvrirAjout()
    fireEvent.click(d.getByLabelText('Vélo'))
    fireEvent.change(d.getByLabelText('Titre'), { target: { value: '  Vélo endurance  ' } })
    fireEvent.change(d.getByLabelText('Détail'), { target: { value: '45 min · Z2' } })
    fireEvent.change(d.getByLabelText('Consigne'), { target: { value: 'Pédalage souple.' } })
    fireEvent.click(d.getByLabelText('Optionnelle'))
    fireEvent.click(d.getByRole('button', { name: 'Ajouter' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const panneau = within(screen.getByRole('region', { name: 'samedi 24 octobre 2026' }))
    const ligne = within(await panneau.findByRole('heading', { name: 'Vélo endurance' }).then((h) => h.closest('li') as HTMLElement))
    expect(ligne.getByText('Vélo')).toBeTruthy()
    expect(ligne.getByText('Optionnelle')).toBeTruthy()
    expect(ligne.getByText('Pédalage souple.')).toBeTruthy()
    const ecrite = await base.get<{ titre: string; detail: string; optionnelle: number; user_id: string | null }>(
      'SELECT titre, detail, optionnelle, user_id FROM seances_velo',
    )
    expect(ecrite).toMatchObject({ titre: 'Vélo endurance', detail: '45 min · Z2', optionnelle: 1 })
  })

  it('une saisie invalide affiche un message sous chaque champ, garde le dialogue ouvert et n’écrit rien', async () => {
    const { d } = await ouvrirAjout()
    fireEvent.change(d.getByLabelText(/Lien vers les statistiques/), { target: { value: 'http://www.strava.com/a' } })
    fireEvent.click(d.getByRole('button', { name: 'Ajouter' }))
    expect(await d.findByText('Le titre est obligatoire.')).toBeTruthy()
    expect(d.getByText(/doit commencer par https/)).toBeTruthy()
    expect(d.getByLabelText('Titre').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(await base.getAll('SELECT id FROM seances_course')).toEqual([])
    // corriger un champ efface son message, pas celui des autres
    fireEvent.change(d.getByLabelText('Titre'), { target: { value: 'Footing' } })
    expect(d.queryByText('Le titre est obligatoire.')).toBeNull()
    expect(d.getByText(/doit commencer par https/)).toBeTruthy()
  })

  it('enregistre le lien sous sa forme normalisée', async () => {
    const { d } = await ouvrirAjout()
    fireEvent.change(d.getByLabelText('Titre'), { target: { value: 'Footing' } })
    fireEvent.change(d.getByLabelText(/Lien vers les statistiques/), { target: { value: ' HTTPS://Strava.com/activities/1 ' } })
    fireEvent.click(d.getByRole('button', { name: 'Ajouter' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((await base.get<{ lien: string }>('SELECT lien FROM seances_course')).lien).toBe('https://strava.com/activities/1')
  })

  it('un échec d’écriture s’annonce dans le dialogue (une seule alerte) et ne le ferme pas', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { d } = await ouvrirAjout()
    const execute = base.execute.bind(base)
    base.execute = (sql: string, params?: unknown[]) =>
      sql.includes('INSERT INTO seances_course') ? Promise.reject(new Error('boum')) : execute(sql, params)
    fireEvent.change(d.getByLabelText('Titre'), { target: { value: 'Footing' } })
    fireEvent.click(d.getByRole('button', { name: 'Ajouter' }))
    expect((await d.findByRole('alert')).textContent).toBe("L'ajout de la séance a échoué.")
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  describe('modification', () => {
    beforeEach(async () => {
      await creer(base, 'course', {
        id: 'c-footing', date: '2026-10-26', titre: 'Footing facile', detail: '40–45 min · Z1–Z2', consigne: 'Aisance.', lien: 'https://strava.com/a',
      })
      await creer(base, 'velo', { id: 'v-valide', date: '2026-10-06', titre: 'Vélo validé' })
      await definirValidation(base, 'velo', 'v-valide', true)
    })

    it('le bouton « Modifier » ouvre le dialogue avec les valeurs de la séance (genre en lecture seule, pas de date)', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      fireEvent.click(screen.getByRole('button', { name: /^lundi 26 octobre 2026/ }))
      fireEvent.click(within(screen.getByRole('region', { name: 'lundi 26 octobre 2026' })).getByRole('button', { name: /Modifier Footing facile/ }))
      const d = await dialogue()
      expect(d.getByRole('heading', { name: 'Modifier « Footing facile »' })).toBeTruthy()
      expect((d.getByLabelText('Titre') as HTMLInputElement).value).toBe('Footing facile')
      expect((d.getByLabelText('Détail') as HTMLInputElement).value).toBe('40–45 min · Z1–Z2')
      expect((d.getByLabelText('Consigne') as HTMLTextAreaElement).value).toBe('Aisance.')
      expect(d.queryByLabelText('Date')).toBeNull()
      expect(d.queryByRole('group', { name: 'Type de séance' })).toBeNull()
    })

    it('enregistre les modifications, vide un champ effacé, et garde la date', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      fireEvent.click(screen.getByRole('button', { name: /^lundi 26 octobre 2026/ }))
      fireEvent.click(within(screen.getByRole('region', { name: 'lundi 26 octobre 2026' })).getByRole('button', { name: /Modifier Footing facile/ }))
      const d = await dialogue()
      fireEvent.change(d.getByLabelText('Titre'), { target: { value: 'Footing souple' } })
      fireEvent.change(d.getByLabelText('Consigne'), { target: { value: '' } })
      fireEvent.change(d.getByLabelText(/Lien vers les statistiques/), { target: { value: '' } })
      fireEvent.click(d.getByRole('button', { name: 'Enregistrer' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      const panneau = within(screen.getByRole('region', { name: 'lundi 26 octobre 2026' }))
      expect(await panneau.findByRole('heading', { name: 'Footing souple' })).toBeTruthy()
      expect(prochaines().getByRole('heading', { name: 'Footing souple' })).toBeTruthy()
      expect(await base.get('SELECT titre, consigne, lien, date FROM seances_course WHERE id = \'c-footing\'')).toEqual({
        titre: 'Footing souple', consigne: null, lien: null, date: '2026-10-26',
      })
    })

    it('une séance validée reste modifiable ; une séance de renforcement n’a pas de bouton « Modifier »', async () => {
      monter()
      await screen.findByRole('heading', { name: 'octobre 2026' })
      fireEvent.click(screen.getByRole('button', { name: /^mardi 6 octobre 2026/ }))
      expect(within(screen.getByRole('region', { name: 'mardi 6 octobre 2026' })).getByRole('button', { name: /Modifier Vélo validé/ })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /^lundi 5 octobre 2026/ }))
      expect(within(screen.getByRole('region', { name: 'lundi 5 octobre 2026' })).queryByRole('button', { name: /^Modifier/ })).toBeNull()
    })
  })
})
