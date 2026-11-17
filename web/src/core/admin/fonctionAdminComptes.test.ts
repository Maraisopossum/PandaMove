import { describe, expect, it, vi } from 'vitest'
import { AppSchema } from '../db/schema'
import { ErreurAdmin, executer, exigerAdministrateur, lireDemande, niveauAalDuJeton, TABLES_UTILISATEUR, type CompteCible, type PortsAdmin } from '../../../supabase/functions/admin-comptes/comptes'

const ADMIN = '00000000-0000-4000-8000-0000000000ad'
const CIBLE = '00000000-0000-4000-8000-00000000000b'
const AUTRE_ADMIN = '00000000-0000-4000-8000-0000000000ae'

function ports(comptes: CompteCible[] = [{ id: CIBLE, email: 'bob@exemple.fr', admin: false }, { id: ADMIN, email: 'moi@exemple.fr', admin: true }, { id: AUTRE_ADMIN, email: 'autre@exemple.fr', admin: true }]) {
  const appels: string[] = []
  const p = {
    adminId: ADMIN,
    trouverCompte: vi.fn(async (id: string) => comptes.find((c) => c.id === id) ?? null),
    inviter: vi.fn(async () => void appels.push('inviter')),
    bannir: vi.fn(async (_id: string, banni: boolean) => void appels.push(banni ? 'bannir' : 'debannir')),
    marquerStatut: vi.fn(async (_id: string, s: string) => void appels.push(`statut:${s}`)),
    envoyerReinitialisation: vi.fn(async () => void appels.push('reinit')),
    revoquerSessions: vi.fn(async () => {
      appels.push('revoquer')
      return 2
    }),
    viderTables: vi.fn(async () => void appels.push('vider')),
    supprimerUtilisateur: vi.fn(async () => void appels.push('supprimer')),
    journaliser: vi.fn(async (a: string) => void appels.push(`journal:${a}`)),
  } satisfies PortsAdmin
  return { p, appels }
}

describe('lecture de la demande', () => {
  it('accepte les demandes valides', () => {
    expect(lireDemande({ action: 'inviter', email: ' a@b.fr ' })).toMatchObject({ action: 'inviter', email: 'a@b.fr' })
    expect(lireDemande({ action: 'suspendre', userId: CIBLE })).toMatchObject({ action: 'suspendre', userId: CIBLE })
  })

  it.each([
    [null], ['texte'], [{}], [{ action: 'detruire' }], [{ action: 'inviter' }], [{ action: 'inviter', email: 'pas-un-mail' }],
    [{ action: 'suspendre' }], [{ action: 'deconnecter' }], [{ action: 'supprimer', userId: 'x; drop table' }], [{ action: 'retablir', userId: 12 }],
  ])('refuse %j', (brut) => {
    expect(() => lireDemande(brut)).toThrow(ErreurAdmin)
    try {
      lireDemande(brut)
    } catch (e) {
      expect((e as ErreurAdmin).statut).toBe(400)
    }
  })
})

describe('actions', () => {
  it('invite puis journalise', async () => {
    const { p, appels } = ports()
    expect((await executer({ action: 'inviter', email: 'nouveau@exemple.fr' }, p)).message).toMatch(/nouveau@exemple.fr/)
    expect(appels).toEqual(['inviter', 'journal:invitation'])
  })

  it('suspend (connexion interdite, statut, journal) puis rétablit', async () => {
    const { p, appels } = ports()
    await executer({ action: 'suspendre', userId: CIBLE }, p)
    await executer({ action: 'retablir', userId: CIBLE }, p)
    expect(appels).toEqual(['bannir', 'statut:suspendu', 'journal:suspension', 'debannir', 'statut:actif', 'journal:retablissement'])
  })

  it('envoie le lien de réinitialisation, et refuse un compte sans e-mail', async () => {
    const { p, appels } = ports()
    await executer({ action: 'reinitialiser', userId: CIBLE }, p)
    expect(appels).toEqual(['reinit', 'journal:reinitialisation_mot_de_passe'])
    const sans = ports([{ id: CIBLE, email: null, admin: false }])
    await expect(executer({ action: 'reinitialiser', userId: CIBLE }, sans.p)).rejects.toMatchObject({ statut: 400 })
  })

  it('déconnecte un compte (sessions coupées, journal) mais jamais son propre compte', async () => {
    const { p, appels } = ports()
    expect((await executer({ action: 'deconnecter', userId: CIBLE }, p)).message).toMatch(/reconnecter/)
    expect(appels).toEqual(['revoquer', 'journal:deconnexion_forcee'])
    const seul = ports()
    await expect(executer({ action: 'deconnecter', userId: ADMIN }, seul.p)).rejects.toMatchObject({ statut: 403 })
    expect(seul.appels).toEqual([])
    const aucune = ports()
    aucune.p.revoquerSessions.mockResolvedValueOnce(0)
    expect((await executer({ action: 'deconnecter', userId: CIBLE }, aucune.p)).message).toMatch(/Aucune session/)
  })

  it('supprime après confirmation : journal d’abord, puis les lignes, puis le compte', async () => {
    const { p, appels } = ports()
    await executer({ action: 'supprimer', userId: CIBLE, confirmation: 'BOB@exemple.fr' }, p)
    expect(appels).toEqual(['journal:suppression', 'vider', 'supprimer'])
  })

  it.each([[undefined], [''], ['autre@exemple.fr']])('refuse la suppression sans bonne confirmation (%s)', async (confirmation) => {
    const { p, appels } = ports()
    await expect(executer({ action: 'supprimer', userId: CIBLE, confirmation }, p)).rejects.toMatchObject({ statut: 400 })
    expect(appels).toEqual([])
  })

  it('garde-fous : ni son propre compte, ni un autre administrateur, pour suspendre ou supprimer', async () => {
    for (const action of ['suspendre', 'supprimer'] as const) {
      for (const [id, email] of [[ADMIN, 'moi@exemple.fr'], [AUTRE_ADMIN, 'autre@exemple.fr']] as const) {
        const { p, appels } = ports()
        await expect(executer({ action, userId: id, confirmation: email }, p)).rejects.toMatchObject({ statut: 403 })
        expect(appels, `${action} ${id}`).toEqual([])
      }
    }
  })

  it('compte introuvable : 404, rien n’est fait', async () => {
    const { p, appels } = ports()
    await expect(executer({ action: 'suspendre', userId: '00000000-0000-4000-8000-0000000000ff' }, p)).rejects.toMatchObject({ statut: 404 })
    expect(appels).toEqual([])
  })

  it('un échec en cours de suppression laisse la trace au journal et ne supprime pas le compte', async () => {
    const { p, appels } = ports()
    p.viderTables.mockRejectedValueOnce(new Error('panne'))
    await expect(executer({ action: 'supprimer', userId: CIBLE, confirmation: 'bob@exemple.fr' }, p)).rejects.toThrow('panne')
    expect(appels).toEqual(['journal:suppression'])
  })
})

describe('tables vidées à la suppression', () => {
  it('couvre toutes les tables du schéma local et les tables propres au serveur', () => {
    const attendues = AppSchema.tables.map((t) => t.name)
    for (const t of attendues) expect(TABLES_UTILISATEUR, `table manquante : ${t}`).toContain(t)
    for (const t of ['push_abonnements', 'rappels_push_envoyes', 'profils', 'jetons_widget']) expect(TABLES_UTILISATEUR).toContain(t)
  })

  it('ne contient aucun doublon', () => {
    expect(new Set(TABLES_UTILISATEUR).size).toBe(TABLES_UTILISATEUR.length)
  })
})

describe('double authentification exigée', () => {
  const jeton = (aal?: string) => `x.${btoa(JSON.stringify(aal ? { aal } : {})).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`

  it('lit le niveau dans le jeton, null s’il est illisible', () => {
    expect(niveauAalDuJeton(jeton('aal2'))).toBe('aal2')
    expect(niveauAalDuJeton(jeton('aal1'))).toBe('aal1')
    expect(niveauAalDuJeton(jeton())).toBeNull()
    expect(niveauAalDuJeton('pas-un-jeton')).toBeNull()
    expect(niveauAalDuJeton('a.%%%.c')).toBeNull()
  })

  it('exige le rôle administrateur ET aal2', () => {
    expect(() => exigerAdministrateur('admin', jeton('aal2'))).not.toThrow()
    expect(() => exigerAdministrateur('admin', jeton('aal1'))).toThrow(/Double authentification requise/)
    expect(() => exigerAdministrateur('admin', 'illisible')).toThrow(/Double authentification requise/)
    expect(() => exigerAdministrateur('coach', jeton('aal2'))).toThrow(/Accès refusé/)
    expect(() => exigerAdministrateur(undefined, jeton('aal2'))).toThrow(/Accès refusé/)
    try {
      exigerAdministrateur('admin', jeton('aal1'))
    } catch (e) {
      expect((e as ErreurAdmin).statut).toBe(403)
    }
  })
})
