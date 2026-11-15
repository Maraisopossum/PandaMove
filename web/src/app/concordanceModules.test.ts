import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import type { RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'
import { TABLES_COMPLEMENT } from '../core/export/complementWeb'
import { AppSchema } from '../core/db/schema'
import { ratioContraste } from './contraste'
import { infoModule, MODULE_ADMIN, MODULES, moduleActif, urlIcone } from './modules'
import { construireRoutes } from './routes'

// Concordance entre modules : ce qui doit rester vrai chaque fois qu'un module s'ajoute. Chaque test garde une règle qui a déjà été
// oubliée une fois (voir docs/audits/2026-11-15-concordance-modules.md).

function cheminsDesRoutes(routes: RouteObject[], prefixe = ''): string[] {
  return routes.flatMap((r) => {
    const chemin = r.path ? `${prefixe}/${r.path}`.replace(/\/+/g, '/') : prefixe
    return [...(r.index ? [prefixe || '/'] : []), ...(r.path && r.path !== '*' ? [chemin] : []), ...cheminsDesRoutes(r.children ?? [], chemin)]
  })
}

const ROUTES = cheminsDesRoutes(construireRoutes(createElement('div'), false))
const concret = (chemin: string) => chemin.replace(/:[^/]+/g, 'x')
const filtre = (pattern: string) => new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`)
const aUneRoute = (chemin: string) => ROUTES.some((r) => filtre(r).test(chemin))

// Écrans hors menu : l'administration a sa propre barre du haut ; /debug n'existe qu'en développement
const HORS_MENU = new Set(['admin', 'debug'])

describe('modules, menu et routes', () => {
  it('chaque entrée du menu et chaque sous-menu mène à une route', () => {
    for (const m of Object.values(MODULES)) {
      expect(aUneRoute(m.path), `route manquante pour ${m.label} (${m.path})`).toBe(true)
      for (const s of m.sousLiens ?? []) expect(aUneRoute(s.path), `route manquante pour le sous-menu ${s.label} (${s.path})`).toBe(true)
    }
  })

  it('chaque route appartient à un module du menu (ou à l’administration) : aucune page ne retombe sur « Accueil »', () => {
    for (const r of ROUTES) {
      const chemin = concret(r)
      const segment = chemin.split('/')[1] ?? ''
      if (segment === '') continue
      if (HORS_MENU.has(segment)) continue
      expect(moduleActif(chemin), `${r} s'afficherait sous « Accueil » dans la barre du haut`).not.toBe('home')
    }
  })

  it('l’administration a sa propre barre du haut, avec un texte blanc lisible', () => {
    for (const r of ROUTES.filter((x) => x.startsWith('/admin'))) expect(infoModule(concret(r)).label).toBe('Administration')
    expect(infoModule('/strength').label).toBe('Renforcement')
    expect(infoModule('/page-inconnue').label).toBe('Accueil')
    expect(infoModule('/administrateur').label).toBe('Accueil')
    expect(ratioContraste('#ffffff', MODULE_ADMIN.color)).toBeGreaterThanOrEqual(4.5)
  })

  it('chaque pastille du menu existe, et une pastille n’est partagée que si c’est assumé', () => {
    const parIcone = new Map<string, string[]>()
    for (const [id, m] of Object.entries(MODULES)) {
      expect(existsSync(resolve(import.meta.dirname, '../../public', urlIcone(m.icone).slice(1))), `pastille absente : ${m.icone}`).toBe(true)
      parIcone.set(m.icone, [...(parIcone.get(m.icone) ?? []), id])
    }
    const partagees = Object.fromEntries([...parIcone].filter(([, ids]) => ids.length > 1))
    // Renforcement et Hyrox partagent les haltères : un visuel propre à Hyrox reste à dessiner
    expect(partagees).toEqual({ halteres: ['strength', 'hyrox'] })
  })

  it('deux modules du menu n’ont pas la même couleur de barre, hors accueil et renforcement (violet commun assumé)', () => {
    const couleurs = Object.entries(MODULES).filter(([id]) => id !== 'home').map(([, m]) => m.color.toLowerCase())
    expect(new Set(couleurs).size).toBe(couleurs.length)
  })
})

describe('données : une table nouvelle doit être couverte partout', () => {
  const NOYAU_RENFORCEMENT = ['exercises', 'seances', 'blocs_seance', 'exercices_seance', 'instances_seance', 'series_realisees', 'objectifs_progression', 'user_settings']

  it('toute table synchronisée est dans la sauvegarde : format Android (renforcement) ou complément web', () => {
    const attendues = AppSchema.tables.map((t) => t.name)
    for (const t of attendues) {
      expect([...NOYAU_RENFORCEMENT, ...TABLES_COMPLEMENT], `la table ${t} n'est pas exportée : l'ajouter à TABLES_COMPLEMENT (core/export/complementWeb.ts)`).toContain(t)
    }
    for (const t of TABLES_COMPLEMENT) expect(attendues, `${t} est exportée mais absente du schéma`).toContain(t)
  })

  it('les durées des tables web s’écrivent en « _s » ; « _sec » est réservé aux tables venues d’Android', () => {
    // Respiration et mobilité ont gardé « _sec » à leur portage ; tout le reste de ce qui s'ajoute utilise « _s »
    const AVEC_SEC = new Set([...NOYAU_RENFORCEMENT, 'methodes_respiration', 'seances_respiration', 'seances_mobilite'])
    for (const table of AppSchema.tables) {
      if (AVEC_SEC.has(table.name)) continue
      const fautives = table.columns.map((c) => c.name).filter((c) => /_(sec|seconds)$/.test(c))
      expect(fautives, `${table.name} : durée en secondes à nommer « _s »`).toEqual([])
    }
  })
})
