import { describe, expect, it, vi } from 'vitest'
import { empreinte, lireJeton } from '../../../supabase/functions/widget-nutrition/jeton'
import {
  construireResume, dateAutorisee, EAU_PAR_JOUR_MAX_ML, ErreurWidget, idEauDepuisCle, traiterEau, traiterResume, type LigneJournal, type PortsWidget, type VerdictJeton,
} from '../../../supabase/functions/widget-nutrition/widget'

const JETON = `pmw_${'ab12'.repeat(16)}`
const MAINTENANT = new Date('2026-11-15T12:40:03Z')
const BEARER = `Bearer ${JETON}`
const ligne = (repas: string, kcal: number, extra: Partial<LigneJournal> = {}): LigneJournal => ({ repas, kcal, proteines: 0, glucides: 0, lipides: 0, quantite_g: 0, ...extra })

function ports(surcharge: Partial<PortsWidget> & { verdict?: VerdictJeton; lignes?: LigneJournal[] } = {}) {
  const { verdict, lignes, ...reste } = surcharge
  return {
    maintenant: () => MAINTENANT,
    verifierJeton: vi.fn(async () => verdict ?? ({ statut: 'ok', userId: 'u1', ecritureEau: true } as VerdictJeton)),
    lireJour: vi.fn(async () => lignes ?? []),
    lireObjectifs: vi.fn(async () => ({ kcal: 2400, proteines_g: 150, glucides_g: 280, lipides_g: 75, eau_ml: 2500 })),
    insererEau: vi.fn(async () => true),
    ...reste,
  } satisfies PortsWidget
}

const erreur = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e as ErreurWidget
  }
  throw new Error('une erreur était attendue')
}

describe('jeton du widget', () => {
  it('lit « Bearer pmw_… » et refuse tout le reste sans toucher à la base', () => {
    expect(lireJeton(BEARER)).toBe(JETON)
    expect(lireJeton(`bearer ${JETON}`)).toBe(JETON)
    for (const mauvais of [null, '', JETON, 'Bearer', `Bearer ${JETON}x`, `Bearer pmw_${'AB12'.repeat(16)}`, 'Bearer eyJhbGciOi.payload.signature', `Basic ${JETON}`]) {
      expect(lireJeton(mauvais)).toBeNull()
    }
  })

  it('l’empreinte est le SHA-256 hexadécimal du jeton, comme celle calculée par la base', async () => {
    const h = await empreinte(JETON)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(await empreinte(JETON)).toBe(h)
    expect(await empreinte(`${JETON}0`)).not.toBe(h)
    // Valeur de référence : sha256("abc")
    expect(await empreinte('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('dates autorisées', () => {
  it('hier, aujourd’hui et demain (UTC) seulement ; dates impossibles et formats libres refusés', () => {
    for (const ok of ['2026-11-14', '2026-11-15', '2026-11-16']) expect(dateAutorisee(ok, MAINTENANT), ok).toBe(true)
    for (const non of ['2026-11-13', '2026-11-17', '2026-02-30', '2026-11-15T10:00', '15/11/2026', '', 20261115, null]) expect(dateAutorisee(non, MAINTENANT), String(non)).toBe(false)
  })
})

describe('résumé du jour (contrat v1)', () => {
  it('totalise énergie, macros, énergie par repas et eau ; l’eau reste hors énergie et repas', () => {
    const r = construireResume(
      '2026-11-15',
      [
        ligne('petit_dejeuner', 280.6, { proteines: 10.04, glucides: 40.26, lipides: 5 }),
        ligne('dejeuner', 960.2, { proteines: 60, glucides: 100, lipides: 30.55 }),
        ligne('dejeuner', 100, { proteines: 1, glucides: 1, lipides: 1 }),
        ligne('eau', 0, { quantite_g: 250 }),
        ligne('eau', 0, { quantite_g: 500 }),
      ],
      { kcal: 2400, proteines_g: 150, glucides_g: 280, lipides_g: 75, eau_ml: 2500 },
      MAINTENANT,
    )
    expect(r).toEqual({
      v: 1, date: '2026-11-15', genereLe: '2026-11-15T12:40:03.000Z',
      objectifs: { kcal: 2400, proteinesG: 150, glucidesG: 280, lipidesG: 75, eauMl: 2500 },
      consomme: { kcal: 1341, proteines: 71, glucides: 141.3, lipides: 36.6, eauMl: 750 },
      repas: { petit_dejeuner: 281, dejeuner: 1060, collation: 0, diner: 0 },
    })
  })

  it('sans objectif : objectifs null ; ne contient jamais de nom ni d’identifiant', () => {
    const r = construireResume('2026-11-15', [{ id: 'secret', ...ligne('diner', 500), nom: 'Pizza' } as LigneJournal], null, MAINTENANT)
    expect(r.objectifs).toBeNull()
    expect(JSON.stringify(r)).not.toMatch(/Pizza|secret|"id"|nom/)
  })

  it('refuse sans jeton valide, avec un jeton inconnu, révoqué ou trop rapproché ; n’appelle la base qu’après le jeton', async () => {
    const p = ports()
    expect((await erreur(traiterResume(null, '2026-11-15', p))).statut).toBe(401)
    expect((await erreur(traiterResume(BEARER, 'hier', p))).code).toBe('date_invalide')
    expect(p.lireJour).not.toHaveBeenCalled()
    expect(await erreur(traiterResume(BEARER, '2026-11-15', ports({ verdict: { statut: 'inconnu' } })))).toMatchObject({ statut: 401, code: 'jeton_invalide' })
    expect(await erreur(traiterResume(BEARER, '2026-11-15', ports({ verdict: { statut: 'revoque' } })))).toMatchObject({ statut: 401, code: 'jeton_revoque' })
    const vite = await erreur(traiterResume(BEARER, '2026-11-15', ports({ verdict: { statut: 'trop_vite' } })))
    expect(vite).toMatchObject({ statut: 429, code: 'trop_vite', reessayerDansS: 20 })
  })

  it('la lecture marque le jeton (limite de débit) et ne lit que le compte du jeton', async () => {
    const p = ports({ lignes: [ligne('dejeuner', 600)] })
    const r = await traiterResume(BEARER, '2026-11-15', p)
    expect(r.consomme.kcal).toBe(600)
    expect(p.verifierJeton).toHaveBeenCalledWith(await empreinte(JETON), true)
    expect(p.lireJour).toHaveBeenCalledWith('u1', '2026-11-15')
    expect(p.lireObjectifs).toHaveBeenCalledWith('u1')
  })
})

describe('ajout d’eau depuis le widget', () => {
  const demande = { date: '2026-11-15', ml: 250, cle: 'appui-0001-abcd' }

  it('ajoute une ligne d’eau avec un identifiant dérivé de la clé, et rend le total du jour', async () => {
    const p = ports({ lignes: [ligne('eau', 0, { quantite_g: 500 }), ligne('dejeuner', 800, { quantite_g: 300 })] })
    expect(await traiterEau(BEARER, demande, p)).toEqual({ v: 1, ajoute: true, eauMl: 750 })
    expect(p.verifierJeton).toHaveBeenCalledWith(await empreinte(JETON), false)
    expect(p.insererEau).toHaveBeenCalledWith({ id: await idEauDepuisCle('u1', demande.cle), userId: 'u1', date: '2026-11-15', ml: 250, creeLe: '2026-11-15T12:40:03.000Z' })
  })

  it('idempotent : un appel déjà traité (même clé) n’ajoute rien et rend le même total', async () => {
    const id = await idEauDepuisCle('u1', demande.cle)
    const p = ports({ lignes: [ligne('eau', 0, { id, quantite_g: 250 })] })
    expect(await traiterEau(BEARER, demande, p)).toEqual({ v: 1, ajoute: false, eauMl: 250 })
    expect(p.insererEau).not.toHaveBeenCalled()
  })

  it('l’identifiant dérivé est un UUID v4 stable, propre au compte et à la clé', async () => {
    const a = await idEauDepuisCle('u1', 'cle-numero-1')
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(await idEauDepuisCle('u1', 'cle-numero-1')).toBe(a)
    expect(await idEauDepuisCle('u2', 'cle-numero-1')).not.toBe(a)
    expect(await idEauDepuisCle('u1', 'cle-numero-2')).not.toBe(a)
  })

  it('refuse un jeton sans l’option eau (403), un plafond dépassé (422), et ne touche pas à la base', async () => {
    const lecture = ports({ verdict: { statut: 'ok', userId: 'u1', ecritureEau: false } })
    expect(await erreur(traiterEau(BEARER, demande, lecture))).toMatchObject({ statut: 403, code: 'ecriture_refusee' })
    expect(lecture.insererEau).not.toHaveBeenCalled()
    const plein = ports({ lignes: [ligne('eau', 0, { quantite_g: EAU_PAR_JOUR_MAX_ML - 100 })] })
    expect(await erreur(traiterEau(BEARER, demande, plein))).toMatchObject({ statut: 422, code: 'plafond_eau' })
    expect(plein.insererEau).not.toHaveBeenCalled()
    expect(await traiterEau(BEARER, { ...demande, ml: 100 }, plein)).toMatchObject({ ajoute: true })
  })

  it.each([
    [{ ...demande, ml: 10 }, 'quantite_invalide'], [{ ...demande, ml: 5000 }, 'quantite_invalide'], [{ ...demande, ml: 250.5 }, 'quantite_invalide'], [{ ...demande, ml: '250' }, 'quantite_invalide'],
    [{ ...demande, cle: 'court' }, 'cle_invalide'], [{ ...demande, cle: 'a'.repeat(70) }, 'cle_invalide'], [{ ...demande, cle: 'espaces interdits' }, 'cle_invalide'],
    [{ ...demande, date: '2025-01-01' }, 'date_invalide'], [null, 'demande_invalide'], ['x', 'demande_invalide'],
  ])('refuse la demande %j (%s) avant toute lecture du jeton en base', async (corps, code) => {
    const p = ports()
    expect((await erreur(traiterEau(BEARER, corps, p))).code).toBe(code)
    expect(p.verifierJeton).not.toHaveBeenCalled()
  })
})
