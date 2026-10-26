// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ratioContraste } from '../../../../app/contraste'
import { annonce, dureeParlee } from './annonces'
import { COULEURS_CIRCUIT } from './couleurs'
import type { Affichage } from './machine'
import { LancementCircuit } from './LancementCircuit'
import { OverlayCircuit } from './OverlayCircuit'

afterEach(cleanup)

const actif: Affichage = {
  mode: 'circuit', phase: 'actif', restantSec: 45, dureeSec: 45, exerciceId: 'a', nomExercice: 'Gainage planche',
  serie: { numero: 1, total: 3, cote: 'G' }, position: { rang: 2, total: 4 }, repos: null, niveau: 'normal', cle: 'actif|0#1',
}
const repos: Affichage = {
  ...actif, phase: 'repos', restantSec: 20, dureeSec: 20, nomExercice: 'Pompes', serie: null, niveau: 'normal', cle: 'repos|0#1',
  repos: { nature: 'inter', prochain: 'Pompes' },
}
const decompte: Affichage = { ...actif, phase: 'decompte', restantSec: 3, dureeSec: 3, cle: 'decompte|0#1' }

describe('dureeParlee', () => {
  it('dit les durées en toutes lettres, au singulier et au pluriel', () => {
    expect(dureeParlee(1)).toBe('1 seconde')
    expect(dureeParlee(45)).toBe('45 secondes')
    expect(dureeParlee(60)).toBe('1 minute')
    expect(dureeParlee(90)).toBe('1 minute 30')
    expect(dureeParlee(120)).toBe('2 minutes')
  })
})

describe('annonce', () => {
  it('décompte, exercice, repos : une phrase par changement de phase', () => {
    expect(annonce(decompte)).toBe('Prêt ? Gainage planche. Départ dans 3 secondes.')
    expect(annonce(actif)).toBe('Gainage planche. Série 1 sur 3, côté gauche. Exercice 2 sur 4. 45 secondes.')
    expect(annonce(repos)).toBe('Repos, 20 secondes. Prochain : Pompes.')
    expect(annonce({ ...repos, repos: { nature: 'fin-tour', prochain: 'Pompes' } })).toBe('Fin du tour. Repos, 20 secondes. Prochain : Pompes.')
    expect(annonce({ ...repos, repos: { nature: 'cote', prochain: 'Fente — côté D' } })).toBe('Changez de côté, 20 secondes. Prochain : Fente — côté D.')
  })
  it('minuteur seul : pas de position dans le circuit', () => {
    expect(annonce({ ...actif, mode: 'seul', position: null, serie: { numero: 2, total: 3, cote: '' } })).toBe('Gainage planche. Série 2 sur 3. 45 secondes.')
  })
})

describe('OverlayCircuit', () => {
  it('exercice actif : dialogue nommé, série, temps restant en grand, position, bouton Arrêter', () => {
    const onArreter = vi.fn()
    render(<OverlayCircuit affichage={actif} onArreter={onArreter} />)
    const d = screen.getByRole('dialog', { name: 'Gainage planche' })
    expect(d.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('Série 1G sur 3')).toBeTruthy()
    const temps = screen.getByRole('timer')
    expect(temps.textContent).toBe('00:45')
    expect(temps.getAttribute('aria-live')).toBe('off')
    expect(temps.getAttribute('aria-label')).toBe('Temps restant : 45 secondes')
    expect(screen.getByText('Exercice 2 sur 4')).toBeTruthy()
    const arret = screen.getByRole('button', { name: 'Arrêter le circuit' })
    expect(document.activeElement).toBe(arret)
    fireEvent.click(arret)
    expect(onArreter).toHaveBeenCalledTimes(1)
  })
  it('niveau d’alerte exposé pour la couleur du temps (attention, urgent)', () => {
    const { rerender } = render(<OverlayCircuit affichage={{ ...actif, restantSec: 8, niveau: 'attention' }} onArreter={() => {}} />)
    expect(screen.getByRole('timer').getAttribute('data-niveau')).toBe('attention')
    rerender(<OverlayCircuit affichage={{ ...actif, restantSec: 2, niveau: 'urgent' }} onArreter={() => {}} />)
    expect(screen.getByRole('timer').getAttribute('data-niveau')).toBe('urgent')
  })
  it('repos : libellé, temps de repos, prochain exercice', () => {
    render(<OverlayCircuit affichage={repos} onArreter={() => {}} />)
    expect(screen.getByText('Repos')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toBe('00:20')
    expect(screen.getByText('Prochain : Pompes')).toBeTruthy()
  })
  it('repos de fin de tour et changement de côté', () => {
    const { rerender } = render(<OverlayCircuit affichage={{ ...repos, repos: { nature: 'fin-tour', prochain: 'Pompes' } }} onArreter={() => {}} />)
    expect(screen.getByText('Fin du tour — repos')).toBeTruthy()
    rerender(<OverlayCircuit affichage={{ ...repos, repos: { nature: 'cote', prochain: 'Fente — côté D' } }} onArreter={() => {}} />)
    expect(screen.getByText('Changez de côté')).toBeTruthy()
    expect(screen.getByText('Prochain : Fente — côté D')).toBeTruthy()
  })
  it('décompte 3-2-1 plein écran avec le nom de l’exercice', () => {
    render(<OverlayCircuit affichage={decompte} onArreter={() => {}} />)
    expect(screen.getByText('Prêt ?')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toBe('3')
    expect(screen.getByRole('dialog', { name: 'Gainage planche' })).toBeTruthy()
  })
  it('minuteur seul : bouton « Arrêter le minuteur », pas de position', () => {
    render(<OverlayCircuit affichage={{ ...actif, mode: 'seul', position: null }} onArreter={() => {}} />)
    expect(screen.getByRole('button', { name: 'Arrêter le minuteur' })).toBeTruthy()
    expect(screen.queryByText(/Exercice \d sur/)).toBeNull()
  })
  it('annonces à faible fréquence : la région vivante ne change pas à chaque seconde', () => {
    const { rerender } = render(<OverlayCircuit affichage={actif} onArreter={() => {}} />)
    const region = screen.getByRole('status')
    const texte = region.textContent
    expect(texte).toBe(annonce(actif))
    rerender(<OverlayCircuit affichage={{ ...actif, restantSec: 44 }} onArreter={() => {}} />)
    expect(screen.getByRole('status').textContent).toBe(texte)
    rerender(<OverlayCircuit affichage={repos} onArreter={() => {}} />)
    expect(screen.getByRole('status').textContent).toBe(annonce(repos))
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })
  it('Échap n’arrête pas le circuit par mégarde ; Tab reste sur le dialogue ; le focus revient à la fermeture', () => {
    const avant = document.createElement('button')
    document.body.append(avant)
    avant.focus()
    const onArreter = vi.fn()
    const { unmount } = render(<OverlayCircuit affichage={actif} onArreter={onArreter} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onArreter).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Arrêter le circuit' }))
    unmount()
    expect(document.activeElement).toBe(avant)
    avant.remove()
  })
})

describe('contrastes (AA) de l’overlay, toujours sombre comme sur Android', () => {
  const c = COULEURS_CIRCUIT
  it('texte et couleurs d’alerte sur le fond atteignent 4,5:1 (texte normal) ou 3:1 (grand texte)', () => {
    for (const [nom, couleur] of Object.entries({ texte: c.texte, secondaire: c.secondaire, attention: c.attention, urgent: c.urgent, repos: c.repos })) {
      expect(ratioContraste(couleur, c.fond), nom).toBeGreaterThanOrEqual(4.5)
    }
    expect(ratioContraste(c.boutonTexte, c.boutonFond)).toBeGreaterThanOrEqual(4.5)
  })
  it('les mêmes valeurs figurent dans la feuille de style', () => {
    const css = readFileSync('src/app/app.css', 'utf8').toLowerCase()
    for (const couleur of Object.values(c)) expect(css, couleur).toContain(couleur.toLowerCase())
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\)\s*{\s*\.circuit/)
  })
})

describe('LancementCircuit', () => {
  it('circuit : rappel des réglages, aide d’une ligne et bouton visible', () => {
    const onLancer = vi.fn()
    render(<LancementCircuit lancement={{ type: 'circuit', blocId: 'b', reprise: false }} recap="3 tours · 4 exercices · repos 20 s entre exercices, 120 s en fin de tour · environ 16 min" erreur={null} onLancer={onLancer} />)
    expect(screen.getByText(/3 tours · 4 exercices/)).toBeTruthy()
    expect(screen.getByText(/Les exercices s’enchaînent tout seuls/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Démarrer le circuit' }))
    expect(onLancer).toHaveBeenCalledTimes(1)
  })
  it('circuit entamé : « Reprendre le circuit »', () => {
    render(<LancementCircuit lancement={{ type: 'circuit', blocId: 'b', reprise: true }} recap="x" erreur={null} onLancer={() => {}} />)
    expect(screen.getByRole('button', { name: 'Reprendre le circuit' })).toBeTruthy()
  })
  it('minuteur seul : « Démarrer le minuteur » et message d’erreur annoncé', () => {
    render(<LancementCircuit lancement={{ type: 'seul', exerciceId: 'a' }} recap="" erreur="Durée invalide : saisissez un nombre de secondes supérieur à 0." onLancer={() => {}} />)
    expect(screen.getByRole('button', { name: 'Démarrer le minuteur' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Durée invalide')
  })
})
