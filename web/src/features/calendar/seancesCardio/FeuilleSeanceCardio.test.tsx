// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeuilleSeanceCardio } from './FeuilleSeanceCardio'
import { brouillonVide, type BrouillonSeanceCardio, type ErreursSaisie } from './saisieCardio'

afterEach(cleanup)

function monter(extra: Partial<React.ComponentProps<typeof FeuilleSeanceCardio>> = {}) {
  const actions = { onChange: vi.fn(), onEnregistrer: vi.fn(), onFermer: vi.fn() }
  const brouillon: BrouillonSeanceCardio = { ...brouillonVide('2026-11-03'), titre: 'Footing facile' }
  render(<FeuilleSeanceCardio mode="creation" brouillon={brouillon} erreurs={{}} erreurGenerale={null} enCours={false} {...actions} {...extra} />)
  return actions
}

describe('FeuilleSeanceCardio — création', () => {
  it('dialogue modal arrondi, titre « Ajouter une séance de cardio », focus initial sur le titre', () => {
    monter()
    const dialogue = screen.getByRole('dialog')
    expect(dialogue.getAttribute('aria-modal')).toBe('true')
    expect(dialogue.classList.contains('dialogue')).toBe(true)
    expect(within(dialogue).getByRole('heading', { name: 'Ajouter une séance de cardio' })).toBeTruthy()
    expect(document.activeElement).toBe(within(dialogue).getByLabelText('Titre'))
  })

  it('propose tous les champs, chacun avec son libellé, et le choix course / vélo', () => {
    monter({ brouillon: { ...brouillonVide('2026-11-03'), titre: 'Footing', detail: '45 min · Z2' } })
    expect((screen.getByLabelText('Titre') as HTMLInputElement).value).toBe('Footing')
    expect((screen.getByLabelText('Date') as HTMLInputElement).type).toBe('date')
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-11-03')
    expect(screen.getByLabelText('Consigne')).toBeTruthy()
    expect((screen.getByLabelText('Détail') as HTMLInputElement).value).toBe('45 min · Z2')
    expect(screen.getByLabelText('Jalon')).toBeTruthy()
    expect((screen.getByLabelText('Optionnelle') as HTMLInputElement).type).toBe('checkbox')
    expect(screen.getByLabelText(/Lien vers les statistiques/)).toBeTruthy()
    const groupe = screen.getByRole('group', { name: 'Type de séance' })
    expect((within(groupe).getByLabelText('Course') as HTMLInputElement).checked).toBe(true)
    expect((within(groupe).getByLabelText('Vélo') as HTMLInputElement).checked).toBe(false)
  })

  it('chaque modification est transmise en un seul champ à la fois', () => {
    const { onChange } = monter()
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Footing souple' } })
    expect(onChange).toHaveBeenLastCalledWith({ titre: 'Footing souple' })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-05' } })
    expect(onChange).toHaveBeenLastCalledWith({ date: '2026-11-05' })
    fireEvent.change(screen.getByLabelText('Consigne'), { target: { value: 'Facile' } })
    expect(onChange).toHaveBeenLastCalledWith({ consigne: 'Facile' })
    fireEvent.change(screen.getByLabelText('Détail'), { target: { value: '30 min · Z1' } })
    expect(onChange).toHaveBeenLastCalledWith({ detail: '30 min · Z1' })
    fireEvent.change(screen.getByLabelText('Jalon'), { target: { value: 'Ravensberg' } })
    expect(onChange).toHaveBeenLastCalledWith({ jalon: 'Ravensberg' })
    fireEvent.click(screen.getByLabelText('Optionnelle'))
    expect(onChange).toHaveBeenLastCalledWith({ optionnelle: true })
    fireEvent.change(screen.getByLabelText(/Lien vers les statistiques/), { target: { value: 'https://strava.com/a' } })
    expect(onChange).toHaveBeenLastCalledWith({ lien: 'https://strava.com/a' })
    fireEvent.click(screen.getByLabelText('Vélo'))
    expect(onChange).toHaveBeenLastCalledWith({ genre: 'velo' })
  })

  it('« Ajouter » envoie le formulaire ; « Annuler » et Échap le ferment', () => {
    const { onEnregistrer, onFermer } = monter()
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(onEnregistrer).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(onFermer).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onFermer).toHaveBeenCalledTimes(2)
  })

  it('la touche Entrée dans un champ envoie le formulaire (sans validation native du navigateur)', () => {
    const { onEnregistrer } = monter()
    fireEvent.submit(screen.getByLabelText('Titre'))
    expect(onEnregistrer).toHaveBeenCalledTimes(1)
    expect(document.querySelector('form')!.noValidate).toBe(true)
  })

  it("pendant l'enregistrement le bouton est désactivé (pas de double envoi)", () => {
    monter({ enCours: true })
    expect((screen.getByRole('button', { name: 'Ajouter' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('FeuilleSeanceCardio — édition', () => {
  const edition = () =>
    monter({
      mode: 'edition',
      brouillon: { ...brouillonVide('2026-11-03', 'velo'), titre: 'Vélo de reprise', optionnelle: true },
    })

  it('titre « Modifier « … » », genre en lecture seule, pas de champ date', () => {
    edition()
    expect(screen.getByRole('heading', { name: 'Modifier « Vélo de reprise »' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Type de séance' })).toBeNull()
    expect(screen.queryByLabelText('Date')).toBeNull()
    expect(screen.getByText('Vélo')).toBeTruthy()
    expect((screen.getByLabelText('Optionnelle') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeTruthy()
  })
})

describe('FeuilleSeanceCardio — erreurs', () => {
  const erreurs: ErreursSaisie = {
    titre: 'Le titre est obligatoire.', lien: 'Le lien doit commencer par https://.', date: 'Choisissez une date réelle.',
  }

  it('affiche le message de chaque champ sous celui-ci et le relie au champ (aria-invalid, aria-describedby)', () => {
    monter({ erreurs })
    const titre = screen.getByLabelText('Titre')
    expect(titre.getAttribute('aria-invalid')).toBe('true')
    const message = document.getElementById(titre.getAttribute('aria-describedby')!)
    expect(message?.textContent).toBe('Le titre est obligatoire.')
    expect(screen.getByLabelText(/Lien vers les statistiques/).getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByLabelText('Date').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByText('Le lien doit commencer par https://.')).toBeTruthy()
  })

  it("les champs sans erreur ne sont pas marqués invalides", () => {
    monter({ erreurs })
    expect(screen.getByLabelText('Consigne').getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByLabelText('Détail').getAttribute('aria-invalid')).toBeNull()
  })

  it("une erreur générale d'enregistrement s'annonce dans le dialogue", () => {
    monter({ erreurGenerale: "L'ajout de la séance a échoué." })
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe("L'ajout de la séance a échoué.")
  })

  it('sans erreur, aucune alerte', () => {
    monter()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
