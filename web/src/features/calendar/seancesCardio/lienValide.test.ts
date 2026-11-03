import { describe, expect, it } from 'vitest'
import { lienValide, LONGUEUR_MAX_LIEN } from './lienValide'

describe('lienValide — adresses acceptées', () => {
  it.each([
    ['page Strava', 'https://www.strava.com/activities/123456789', 'https://www.strava.com/activities/123456789'],
    ['page Suunto', 'https://www.suunto.com/fr-fr/Sports-apps/workout/abc?x=1#fin', 'https://www.suunto.com/fr-fr/Sports-apps/workout/abc?x=1#fin'],
    ['page MyWoosh avec port', 'https://app.mywoosh.com:8443/ride/42', 'https://app.mywoosh.com:8443/ride/42'],
    ['adresse sans chemin : la barre finale est ajoutée par la normalisation', 'https://strava.com', 'https://strava.com/'],
  ])('%s', (_nom, saisie, normalisee) => {
    expect(lienValide(saisie)).toEqual({ ok: true, valeur: normalisee })
  })

  it('renvoie la forme normalisée : schéma et domaine en minuscules (la contrainte SQL exige https:// en minuscules)', () => {
    expect(lienValide('HTTPS://WWW.Strava.COM/activities/1')).toEqual({ ok: true, valeur: 'https://www.strava.com/activities/1' })
  })

  it('retire les espaces autour de l\'adresse', () => {
    expect(lienValide('  https://www.strava.com/activities/1\n')).toEqual({ ok: true, valeur: 'https://www.strava.com/activities/1' })
  })

  it('la normalisation est idempotente (relire la valeur enregistrée ne la change pas)', () => {
    const premiere = lienValide('HTTPS://Strava.com') as { ok: true; valeur: string }
    expect(lienValide(premiere.valeur)).toEqual(premiere)
  })

  it('accepte une adresse dont la forme normalisée fait exactement 2048 caractères, refuse 2049', () => {
    const base = 'https://strava.com/'
    expect(lienValide(base + 'a'.repeat(LONGUEUR_MAX_LIEN - base.length))).toMatchObject({ ok: true })
    expect(lienValide(base + 'a'.repeat(LONGUEUR_MAX_LIEN - base.length + 1))).toMatchObject({ ok: false })
  })
})

describe('lienValide — absence de lien', () => {
  it.each([[''], ['   '], ['\n'], [null], [undefined]])('« %s » est valide et se range à null (jamais une chaîne vide)', (saisie) => {
    expect(lienValide(saisie)).toEqual({ ok: true, valeur: null })
  })
})

describe('lienValide — adresses refusées', () => {
  it.each([
    ['http (non chiffré)', 'http://www.strava.com/activities/1'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['ftp', 'ftp://strava.com/x'],
    ['adresse relative', '/activities/1'],
    ['sans schéma', 'www.strava.com/activities/1'],
    ['schéma seul', 'https://'],
    ['domaine absent', 'https:///activities/1'],
    ['identifiants dans l\'adresse', 'https://utilisateur:motdepasse@www.strava.com/activities/1'],
    ['nom d\'utilisateur seul', 'https://utilisateur@www.strava.com/'],
    ['espace à l\'intérieur', 'https://www.strava.com/activities/ 1'],
    ['saut de ligne à l\'intérieur', 'https://www.strava.com/act\nivities/1'],
    ['caractère de contrôle (alerte sonore)', 'https://www.strava.com/act\u0007ivities/1'],
    ['caractère nul', 'https://www.strava.com/act\u0000ivities/1'],
    ['tabulation', 'https://www.strava.com/act\tivities/1'],
    ['du texte', 'mes stats sur Strava'],
  ])('%s', (_nom, saisie) => {
    expect(lienValide(saisie)).toMatchObject({ ok: false, raison: expect.any(String) })
  })

  it('donne une raison en français', () => {
    const r = lienValide('http://x.fr')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.raison).toMatch(/https/)
  })
})
