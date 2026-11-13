import { describe, expect, it, vi } from 'vitest'
import {
  FENETRE_MIN,
  instantLocal,
  lendemain,
  lireReglagesSynchro,
  rappelsPushDus,
  traiterRappels,
  type Abonnement,
  type EvenementARappeler,
  type IssueEnvoi,
  type Ports,
} from '../../../supabase/functions/envoyer-rappels/rappels'
import type { EvenementAgenda } from '../calendar/types'
import { lireReglages, rappelsDus, REGLAGES_PAR_DEFAUT, type ReglagesRappels } from './rappels'

// Tests de la logique de la fonction `envoyer-rappels` (supabase/functions/envoyer-rappels/rappels.ts) : instants locaux,
// règles des rappels et parité avec le planificateur du client, puis orchestration avec des doubles des accès extérieurs.

const evenement = (id: string, dateIso: string, titre = `Séance ${id}`): EvenementARappeler => ({ id, dateIso, titre })
const agenda = (e: EvenementARappeler, etat: EvenementAgenda['etat'] = 'planifiee') =>
  ({ id: e.id, dateIso: e.dateIso, titre: e.titre, etat, genre: 'course', consigne: null, detail: null, optionnelle: false, jalon: null, lien: null }) as EvenementAgenda

describe('instantLocal', () => {
  it('convertit un instant UTC dans le fuseau de l’appareil, heure d’été comprise', () => {
    // 12 nov. 2026 18:30 UTC = 19:30 à Paris (heure d'hiver, UTC+1)
    expect(instantLocal(new Date('2026-11-12T18:30:00Z'), 'Europe/Paris')).toEqual({ dateIso: '2026-11-12', minutes: 19 * 60 + 30 })
    // 15 juil. 2026 18:30 UTC = 20:30 à Paris (heure d'été, UTC+2)
    expect(instantLocal(new Date('2026-07-15T18:30:00Z'), 'Europe/Paris')).toEqual({ dateIso: '2026-07-15', minutes: 20 * 60 + 30 })
  })

  it('le jour local peut différer du jour UTC ; minuit vaut 0 (jamais 24 h)', () => {
    expect(instantLocal(new Date('2026-11-12T23:30:00Z'), 'Europe/Paris')).toEqual({ dateIso: '2026-11-13', minutes: 30 })
    expect(instantLocal(new Date('2026-11-12T23:00:00Z'), 'Europe/Paris')).toEqual({ dateIso: '2026-11-13', minutes: 0 })
    expect(instantLocal(new Date('2026-11-12T03:00:00Z'), 'America/New_York')).toEqual({ dateIso: '2026-11-11', minutes: 22 * 60 })
  })

  it('un fuseau inconnu retombe sur UTC', () => {
    expect(instantLocal(new Date('2026-11-12T18:30:00Z'), 'Pays/Inconnu')).toEqual({ dateIso: '2026-11-12', minutes: 18 * 60 + 30 })
  })

  it('lendemain : fin de mois, fin d’année, année bissextile', () => {
    expect(lendemain('2026-11-30')).toBe('2026-12-01')
    expect(lendemain('2026-12-31')).toBe('2027-01-01')
    expect(lendemain('2028-02-28')).toBe('2028-02-29')
  })
})

describe('lireReglagesSynchro', () => {
  it('lit les réglages synchronisés, ramène le reste aux défauts', () => {
    expect(lireReglagesSynchro(JSON.stringify({ veille: false, veilleHeure: '20:15', jour: true, jourHeure: '06:45' }))).toEqual({
      veille: false, veilleHeure: '20:15', jour: true, jourHeure: '06:45',
    })
    expect(lireReglagesSynchro(null)).toEqual({ veille: true, veilleHeure: '19:00', jour: true, jourHeure: '07:30' })
    expect(lireReglagesSynchro('pas du json')).toEqual({ veille: true, veilleHeure: '19:00', jour: true, jourHeure: '07:30' })
    expect(lireReglagesSynchro(JSON.stringify({ veilleHeure: '25:99', jour: 'oui' }))).toEqual({ veille: true, veilleHeure: '19:00', jour: true, jourHeure: '07:30' })
  })
})

describe('rappelsPushDus', () => {
  const reglages = { veille: true, veilleHeure: '19:00', jour: true, jourHeure: '07:30' }
  const local = (dateIso: string, h: number, m = 0) => ({ dateIso, minutes: h * 60 + m })

  it('la veille à partir de l’heure choisie, une seule fois', () => {
    const e = [evenement('a', '2026-11-13')]
    expect(rappelsPushDus(reglages, e, local('2026-11-12', 18, 59), new Set())).toEqual([])
    const dus = rappelsPushDus(reglages, e, local('2026-11-12', 19, 0), new Set())
    expect(dus).toEqual([{ cle: 'a|2026-11-13|veille', titre: 'Séance demain', corps: 'Séance a' }])
    expect(rappelsPushDus(reglages, e, local('2026-11-12', 19, 5), new Set(['a|2026-11-13|veille']))).toEqual([])
  })

  it('le jour même à l’heure choisie ; rien pour les autres jours', () => {
    expect(rappelsPushDus(reglages, [evenement('b', '2026-11-12')], local('2026-11-12', 7, 30), new Set())[0]).toMatchObject({ titre: "Séance aujourd'hui" })
    expect(rappelsPushDus(reglages, [evenement('c', '2026-11-14')], local('2026-11-12', 19, 30), new Set())).toEqual([])
    expect(rappelsPushDus(reglages, [evenement('d', '2026-11-10')], local('2026-11-12', 19, 30), new Set())).toEqual([])
  })

  it('fenêtre : plus d’envoi au-delà de FENETRE_MIN minutes après l’heure (serveur resté arrêté)', () => {
    const e = [evenement('a', '2026-11-13')]
    const dernierInstant = 19 * 60 + FENETRE_MIN
    expect(rappelsPushDus(reglages, e, { dateIso: '2026-11-12', minutes: dernierInstant }, new Set())).toHaveLength(1)
    expect(rappelsPushDus(reglages, e, { dateIso: '2026-11-12', minutes: dernierInstant + 1 }, new Set())).toEqual([])
  })

  it('respecte les choix veille / jour désactivés', () => {
    const e = [evenement('a', '2026-11-13')]
    expect(rappelsPushDus({ ...reglages, veille: false }, e, local('2026-11-12', 19, 30), new Set())).toEqual([])
    expect(rappelsPushDus({ ...reglages, jour: false }, [evenement('b', '2026-11-12')], local('2026-11-12', 8, 0), new Set())).toEqual([])
  })

  // Parité avec le client : mêmes réglages, mêmes séances, mêmes heures -> mêmes rappels (hors interrupteur et fenêtre)
  it('parité avec rappelsDus du client sur de nombreux scénarios', () => {
    const jours = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-11']
    const evenements = jours.map((j, i) => evenement(`e${i}`, j))
    const variantes: ReglagesRappels[] = [
      { ...REGLAGES_PAR_DEFAUT, actif: true },
      { ...REGLAGES_PAR_DEFAUT, actif: true, veille: false },
      { ...REGLAGES_PAR_DEFAUT, actif: true, jour: false },
      { ...REGLAGES_PAR_DEFAUT, actif: true, veilleHeure: '21:00', jourHeure: '06:00' },
    ]
    for (const r of variantes) {
      for (const [h, m] of [[0, 0], [6, 0], [7, 29], [7, 30], [9, 0], [19, 0], [20, 59], [21, 0], [23, 59]]) {
        const serveur = rappelsPushDus(r, evenements, { dateIso: '2026-11-12', minutes: h * 60 + m }, new Set())
        const client = rappelsDus(r, evenements.map((e) => agenda(e)), new Date(2026, 10, 12, h, m), new Set())
        // Le client n'a pas de fenêtre : on retire du résultat client ce qui est hors fenêtre avant de comparer
        const dansLaFenetre = client.filter((c) => {
          const veille = c.cle.endsWith('|veille')
          const heure = veille ? r.veilleHeure : r.jourHeure
          const ecart = h * 60 + m - (Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3)))
          return ecart <= FENETRE_MIN
        })
        expect(serveur, `${JSON.stringify(r)} à ${h}:${m}`).toEqual(dansLaFenetre)
      }
    }
  })

  it('les réglages synchronisés se lisent comme ceux du client', () => {
    const json = JSON.stringify({ actif: true, veille: false, veilleHeure: '20:15', jour: true, jourHeure: '06:45' })
    const c = lireReglages(json)
    expect(lireReglagesSynchro(json)).toEqual({ veille: c.veille, veilleHeure: c.veilleHeure, jour: c.jour, jourHeure: c.jourHeure })
  })
})

describe('traiterRappels', () => {
  const abo = (id: string, userId = 'u1', fuseau = 'Europe/Paris'): Abonnement => ({ id, userId, endpoint: `https://push.exemple/${id}`, p256dh: 'p', auth: 'a', fuseau })

  function ports(partiel: Partial<Ports> = {}) {
    const envoyes: { abo: string; cle: string }[] = []
    const marques: { userId: string; cle: string }[] = []
    const supprimes: string[] = []
    const p: Ports = {
      // 12 nov. 2026, 19:10 à Paris
      maintenant: new Date('2026-11-12T18:10:00Z'),
      abonnements: [abo('A1')],
      reglagesDe: async () => null,
      evenements: async () => [evenement('s1', '2026-11-13', 'Pull')],
      dejaEnvoyes: async () => new Set(),
      envoyer: async (a, r) => {
        envoyes.push({ abo: a.id, cle: r.cle })
        return 'ok'
      },
      marquerEnvoye: async (userId, cle) => void marques.push({ userId, cle }),
      supprimerAbonnement: async (id) => void supprimes.push(id),
      ...partiel,
    }
    return { p, envoyes, marques, supprimes }
  }

  it('envoie le rappel dû à l’heure locale de l’appareil et le marque envoyé avec la clé de l’abonnement', async () => {
    const { p, envoyes, marques } = ports()
    expect(await traiterRappels(p)).toEqual({ abonnements: 1, envoyes: 1, expires: 0, erreurs: 0 })
    expect(envoyes).toEqual([{ abo: 'A1', cle: 's1|2026-11-13|veille' }])
    expect(marques).toEqual([{ userId: 'u1', cle: 'A1|s1|2026-11-13|veille' }])
  })

  it('ne renvoie pas un rappel déjà envoyé à cet appareil, mais un autre appareil du compte le reçoit', async () => {
    const { p, envoyes } = ports({
      abonnements: [abo('A1'), abo('A2')],
      dejaEnvoyes: async () => new Set(['A1|s1|2026-11-13|veille']),
    })
    const bilan = await traiterRappels(p)
    expect(bilan.envoyes).toBe(1)
    expect(envoyes).toEqual([{ abo: 'A2', cle: 's1|2026-11-13|veille' }])
  })

  it('utilise les réglages du compte (heure de la veille reculée : rien d’envoyé à 19 h 10)', async () => {
    const { p, envoyes } = ports({ reglagesDe: async () => JSON.stringify({ veille: true, veilleHeure: '21:00', jour: true, jourHeure: '07:30' }) })
    expect((await traiterRappels(p)).envoyes).toBe(0)
    expect(envoyes).toEqual([])
  })

  it('chaque appareil est jugé à son fuseau', async () => {
    // 19 h 10 à Paris, mais 13 h 10 à New York : seul l'appareil parisien reçoit le rappel de 19 h
    const { p, envoyes } = ports({ abonnements: [abo('PARIS'), abo('NY', 'u1', 'America/New_York')] })
    await traiterRappels(p)
    expect(envoyes.map((e) => e.abo)).toEqual(['PARIS'])
  })

  it('abonnement expiré : supprimé, et on passe à l’abonnement suivant', async () => {
    const issues: Record<string, IssueEnvoi> = { A1: 'expire', A2: 'ok' }
    const { p, supprimes, marques } = ports({ abonnements: [abo('A1'), abo('A2')], envoyer: async (a) => issues[a.id] })
    expect(await traiterRappels(p)).toEqual({ abonnements: 2, envoyes: 1, expires: 1, erreurs: 0 })
    expect(supprimes).toEqual(['A1'])
    expect(marques).toEqual([{ userId: 'u1', cle: 'A2|s1|2026-11-13|veille' }])
  })

  it('échec passager : pas marqué envoyé (retenté à la passe suivante) ; une erreur ne bloque pas les autres abonnements', async () => {
    const envoyer = vi.fn<Ports['envoyer']>().mockResolvedValueOnce('erreur').mockResolvedValue('ok')
    const { p, marques } = ports({ abonnements: [abo('A1'), abo('A2')], envoyer })
    expect(await traiterRappels(p)).toEqual({ abonnements: 2, envoyes: 1, expires: 0, erreurs: 1 })
    expect(marques).toEqual([{ userId: 'u1', cle: 'A2|s1|2026-11-13|veille' }])
  })

  it('une exception de lecture sur un compte est comptée et n’arrête pas les autres', async () => {
    const { p, envoyes } = ports({
      abonnements: [abo('A1', 'u1'), abo('B1', 'u2')],
      evenements: async (userId) => {
        if (userId === 'u1') throw new Error('base indisponible')
        return [evenement('s2', '2026-11-13', 'Footing')]
      },
    })
    expect(await traiterRappels(p)).toEqual({ abonnements: 2, envoyes: 1, expires: 0, erreurs: 1 })
    expect(envoyes).toEqual([{ abo: 'B1', cle: 's2|2026-11-13|veille' }])
  })

  it('demande les séances du jour local et du lendemain de chaque appareil', async () => {
    const evenements = vi.fn<Ports['evenements']>().mockResolvedValue([])
    // 23 h 30 UTC = 0 h 30 le 13 à Paris
    await traiterRappels(ports({ maintenant: new Date('2026-11-12T23:30:00Z'), evenements }).p)
    expect(evenements).toHaveBeenCalledWith('u1', '2026-11-13', '2026-11-14')
  })

  it('sans abonnement : rien à faire', async () => {
    expect(await traiterRappels(ports({ abonnements: [] }).p)).toEqual({ abonnements: 0, envoyes: 0, expires: 0, erreurs: 0 })
  })
})
