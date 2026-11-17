// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HeroPanda, type TeinteModule } from './HeroPanda'

afterEach(cleanup)

describe('bloc d’accueil des modules (HeroPanda)', () => {
  it('affiche le titre et la phrase, avec un panda décoratif', () => {
    render(<HeroPanda module="stats" image="module_stats" titre="Votre progression" texte="Tonnage et séries de la période." />)
    expect(screen.getByRole('region', { name: 'Votre progression' })).toBeTruthy()
    expect(screen.getByText('Tonnage et séries de la période.')).toBeTruthy()
    const img = document.querySelector('img.hero-module__panda')!
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('src')).toContain('module-stats-male')
  })

  it.each<[TeinteModule, string]>([
    ['nutrition', 'module_scan'],
    ['stats', 'module_stats'],
    ['outils', 'module_outils'],
    ['hyrox', 'module_hyrox'],
    ['calendrier', 'module_calendrier'],
  ])('%s : la teinte du module est portée par la classe', (module, image) => {
    render(<HeroPanda module={module} image={image as 'module_scan'} titre="Titre" />)
    expect(document.querySelector(`.hero-module--${module}`)).not.toBeNull()
    expect(document.querySelector('img.hero-module__panda')).not.toBeNull()
  })

  it('l’étiquette accessible peut différer du titre', () => {
    render(<HeroPanda module="nutrition" image="module_scan" titre="Un produit en main ?" etiquette="Scanner un produit" />)
    expect(screen.getByRole('region', { name: 'Scanner un produit' })).toBeTruthy()
  })
})
