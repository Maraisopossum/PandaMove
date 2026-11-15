import { describe, expect, it, vi } from 'vitest'
import { ErreurCodes, executer, formaterCode, genererCodes, hacherCode, lireDemande, normaliserCode, NOMBRE_CODES, type PortsCodes } from '../../../supabase/functions/codes-secours/codes'

const U = '00000000-0000-4000-8000-0000000000aa'
const alea = (taille: number) => crypto.getRandomValues(new Uint8Array(taille))

function ports(opts: { niveau?: 'aal1' | 'aal2' | null; facteur?: boolean; valide?: boolean } = {}) {
  const p = {
    userId: U,
    niveau: opts.niveau === undefined ? 'aal2' : opts.niveau,
    octets: alea,
    aUnFacteur: vi.fn(async () => opts.facteur ?? true),
    remplacerCodes: vi.fn(async (empreintes: string[]) => void empreintes),
    consommerCode: vi.fn(async (empreinte: string) => (empreinte ? (opts.valide ?? true) : false)),
    retirerFacteurs: vi.fn(async () => 1),
  } satisfies PortsCodes
  return p
}

describe('codes de secours : génération des codes', () => {
  it('produit des codes distincts de 10 caractères sans symbole ambigu', () => {
    const codes = genererCodes(NOMBRE_CODES, alea)
    expect(codes).toHaveLength(NOMBRE_CODES)
    expect(new Set(codes).size).toBe(NOMBRE_CODES)
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{10}$/)
  })

  it('chaque octet tiré donne un symbole de l’alphabet', () => {
    let tour = 0
    const codes = genererCodes(2, (taille) => new Uint8Array(taille).map((_, i) => (i * 13 + tour++) % 256))
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{10}$/)
  })

  it('normalise et formate : la casse, les espaces et les tirets sont ignorés', () => {
    expect(normaliserCode(' abcde-fgh23 ')).toBe('ABCDEFGH23')
    expect(formaterCode('ABCDEFGH23')).toBe('ABCDE-FGH23')
  })

  it('l’empreinte dépend du compte et pas de la mise en forme du code', async () => {
    const a = await hacherCode(U, 'ABCDE-FGH23')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await hacherCode(U, 'abcdefgh23')).toBe(a)
    expect(await hacherCode('00000000-0000-4000-8000-0000000000bb', 'ABCDEFGH23')).not.toBe(a)
  })
})

describe('codes de secours : lecture de la demande', () => {
  it('accepte generer et utiliser', () => {
    expect(lireDemande({ action: 'generer' })).toEqual({ action: 'generer' })
    expect(lireDemande({ action: 'utiliser', code: 'abcde-fgh23' })).toEqual({ action: 'utiliser', code: 'ABCDEFGH23' })
  })

  it.each([[null], ['x'], [{}], [{ action: 'detruire' }], [{ action: 'utiliser' }], [{ action: 'utiliser', code: 'court' }], [{ action: 'utiliser', code: 12 }]])('refuse %j', (brut) => {
    expect(() => lireDemande(brut)).toThrow(ErreurCodes)
  })
})

describe('codes de secours : exécution', () => {
  it('génère 8 codes, ne stocke que leurs empreintes et les rend formatés', async () => {
    const p = ports()
    const r = await executer({ action: 'generer' }, p)
    expect(r.codes).toHaveLength(NOMBRE_CODES)
    expect(r.codes![0]).toMatch(/^[A-Z0-9]{5}-[A-Z0-9]{5}$/)
    const empreintes = p.remplacerCodes.mock.calls[0][0]
    expect(empreintes).toHaveLength(NOMBRE_CODES)
    expect(empreintes[0]).toBe(await hacherCode(U, r.codes![0]))
    for (const c of r.codes!) expect(JSON.stringify(empreintes)).not.toContain(normaliserCode(c))
  })

  it('refuse de générer sans facteur, ou sans avoir passé le code à 6 chiffres', async () => {
    await expect(executer({ action: 'generer' }, ports({ facteur: false }))).rejects.toMatchObject({ statut: 409 })
    for (const niveau of ['aal1', null] as const) {
      const p = ports({ niveau })
      await expect(executer({ action: 'generer' }, p)).rejects.toMatchObject({ statut: 403 })
      expect(p.remplacerCodes).not.toHaveBeenCalled()
    }
  })

  it('un code valide retire les facteurs, même avec le seul mot de passe (aal1)', async () => {
    const p = ports({ niveau: 'aal1' })
    const r = await executer({ action: 'utiliser', code: 'ABCDEFGH23' }, p)
    expect(r.message).toMatch(/retirée/)
    expect(p.consommerCode).toHaveBeenCalledWith(await hacherCode(U, 'ABCDEFGH23'))
    expect(p.retirerFacteurs).toHaveBeenCalledOnce()
  })

  it('un code inconnu ou déjà utilisé est refusé sans rien retirer', async () => {
    const p = ports({ valide: false })
    await expect(executer({ action: 'utiliser', code: 'ABCDEFGH23' }, p)).rejects.toMatchObject({ statut: 403 })
    expect(p.retirerFacteurs).not.toHaveBeenCalled()
  })
})
