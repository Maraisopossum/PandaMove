// Logique pure de la fonction `envoyer-rappels` (aucune API Deno ni réseau : testée sous Vitest, voir
// supabase/tests/rappels-push.test.ts). Elle reproduit les règles des rappels du client (src/features/outils/rappels.ts) :
// la veille et le jour même, à l'heure choisie, pour les séances non terminées. Un test de parité compare les deux.
//
// Différences voulues avec le client :
//  - les heures sont lues dans le fuseau de l'appareil abonné (le serveur n'est pas dans le même fuseau) ;
//  - l'interrupteur général de l'appareil n'existe pas ici : l'abonnement push EST ce choix ;
//  - un rappel n'est envoyé que dans les FENETRE_MIN minutes qui suivent son heure : un serveur resté arrêté ne réveille pas
//    l'utilisateur longtemps après (le client, lui, rattrape à l'ouverture de l'application).

export interface ReglagesRappels {
  veille: boolean
  /** « HH:mm » */
  veilleHeure: string
  jour: boolean
  jourHeure: string
}

export const REGLAGES_PAR_DEFAUT: ReglagesRappels = { veille: true, veilleHeure: '19:00', jour: true, jourHeure: '07:30' }

/** Minutes après l'heure d'un rappel pendant lesquelles il peut encore partir. */
export const FENETRE_MIN = 180

const RE_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/

const heureValide = (v: unknown): v is string => typeof v === 'string' && RE_HEURE.test(v)

/** Réglages synchronisés (user_settings.rappels_json) ; toute valeur absente ou invalide revient à la valeur par défaut. */
export function lireReglagesSynchro(brut: string | null): ReglagesRappels {
  try {
    const v = JSON.parse(brut ?? 'null') as Partial<ReglagesRappels> | null
    return {
      veille: typeof v?.veille === 'boolean' ? v.veille : REGLAGES_PAR_DEFAUT.veille,
      veilleHeure: heureValide(v?.veilleHeure) ? v.veilleHeure : REGLAGES_PAR_DEFAUT.veilleHeure,
      jour: typeof v?.jour === 'boolean' ? v.jour : REGLAGES_PAR_DEFAUT.jour,
      jourHeure: heureValide(v?.jourHeure) ? v.jourHeure : REGLAGES_PAR_DEFAUT.jourHeure,
    }
  } catch {
    return { ...REGLAGES_PAR_DEFAUT }
  }
}

export interface InstantLocal {
  /** Jour local, yyyy-MM-dd. */
  dateIso: string
  /** Minutes écoulées depuis minuit, heure locale. */
  minutes: number
}

/** Jour et heure à `fuseau` (nom IANA) ; un fuseau inconnu retombe sur UTC. */
export function instantLocal(maintenant: Date, fuseau: string): InstantLocal {
  let parties: Intl.DateTimeFormatPart[]
  try {
    parties = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuseau, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(maintenant)
  } catch {
    return instantLocal(maintenant, 'UTC')
  }
  const p = (type: string) => parties.find((x) => x.type === type)?.value ?? '00'
  return { dateIso: `${p('year')}-${p('month')}-${p('day')}`, minutes: Number(p('hour')) * 60 + Number(p('minute')) }
}

/** Lendemain d'un jour yyyy-MM-dd (calendrier, sans effet de l'heure d'été). */
export function lendemain(dateIso: string): string {
  const [a, m, j] = dateIso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10)
}

/** Séance non terminée (renforcement planifié ou en cours, cardio non validé). */
export interface EvenementARappeler {
  id: string
  dateIso: string
  titre: string
}

export interface RappelPush {
  /** Identifiant stable : un rappel n'est envoyé qu'une fois par abonnement. */
  cle: string
  titre: string
  corps: string
}

const minutes = (heure: string) => Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3))

/** Rappels à envoyer maintenant pour un appareil : même règle que `rappelsDus` du client, bornée par FENETRE_MIN. */
export function rappelsPushDus(
  reglages: ReglagesRappels,
  evenements: readonly EvenementARappeler[],
  local: InstantLocal,
  envoyes: ReadonlySet<string>,
): RappelPush[] {
  const demain = lendemain(local.dateIso)
  const dansLaFenetre = (heure: string) => {
    const ecart = local.minutes - minutes(heure)
    return ecart >= 0 && ecart <= FENETRE_MIN
  }
  const dus: RappelPush[] = []
  for (const e of evenements) {
    const veille = e.dateIso === demain && reglages.veille && dansLaFenetre(reglages.veilleHeure)
    const jour = e.dateIso === local.dateIso && reglages.jour && dansLaFenetre(reglages.jourHeure)
    if (!veille && !jour) continue
    const cle = `${e.id}|${e.dateIso}|${veille ? 'veille' : 'jour'}`
    if (envoyes.has(cle)) continue
    dus.push({ cle, titre: veille ? 'Séance demain' : "Séance aujourd'hui", corps: e.titre })
  }
  return dus
}

export interface Abonnement {
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  fuseau: string
}

export type IssueEnvoi = 'ok' | 'expire' | 'erreur'

/** Accès extérieurs de la fonction (Supabase, service push) : remplacés par des doubles dans les tests. */
export interface Ports {
  maintenant: Date
  abonnements: readonly Abonnement[]
  /** user_settings.rappels_json du compte (null : jamais réglé). */
  reglagesDe(userId: string): Promise<string | null>
  /** Séances non terminées entre deux jours (inclus). */
  evenements(userId: string, debutIso: string, finIso: string): Promise<EvenementARappeler[]>
  /** Clés déjà envoyées au compte (« <abonnement>|<clé du rappel> »). */
  dejaEnvoyes(userId: string): Promise<Set<string>>
  envoyer(abonnement: Abonnement, rappel: RappelPush): Promise<IssueEnvoi>
  marquerEnvoye(userId: string, cle: string): Promise<void>
  supprimerAbonnement(id: string): Promise<void>
}

export interface Bilan {
  abonnements: number
  envoyes: number
  expires: number
  erreurs: number
}

/**
 * Passe complète : pour chaque abonnement, lit les réglages et les séances du compte, calcule les rappels dus à l'heure locale
 * de l'appareil et les envoie. Un rappel n'est marqué envoyé qu'après un envoi réussi (un échec passager est retenté à la passe
 * suivante, dans la fenêtre) ; un abonnement expiré est supprimé. Une erreur sur un abonnement n'arrête pas les autres.
 */
export async function traiterRappels(ports: Ports): Promise<Bilan> {
  const bilan: Bilan = { abonnements: ports.abonnements.length, envoyes: 0, expires: 0, erreurs: 0 }
  for (const abo of ports.abonnements) {
    try {
      const local = instantLocal(ports.maintenant, abo.fuseau)
      const reglages = lireReglagesSynchro(await ports.reglagesDe(abo.userId))
      const envoyes = await ports.dejaEnvoyes(abo.userId)
      // Les clés d'envoi sont propres à l'appareil : deux appareils du même compte reçoivent chacun le rappel
      const dejaCetAppareil = new Set([...envoyes].filter((k) => k.startsWith(`${abo.id}|`)).map((k) => k.slice(abo.id.length + 1)))
      const evenements = await ports.evenements(abo.userId, local.dateIso, lendemain(local.dateIso))
      for (const rappel of rappelsPushDus(reglages, evenements, local, dejaCetAppareil)) {
        const issue = await ports.envoyer(abo, rappel)
        if (issue === 'ok') {
          await ports.marquerEnvoye(abo.userId, `${abo.id}|${rappel.cle}`)
          bilan.envoyes++
        } else if (issue === 'expire') {
          await ports.supprimerAbonnement(abo.id)
          bilan.expires++
          break
        } else {
          bilan.erreurs++
        }
      }
    } catch {
      bilan.erreurs++
    }
  }
  return bilan
}
