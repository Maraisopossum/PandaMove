import { dateIsoLocale } from '../../core/common/dates'
import type { EvenementAgenda } from '../calendar/types'

// Rappels de séance : réglages et calcul des rappels à envoyer. Fonctions pures (aucun accès à Notification ni à la base).
// Une séance planifiée peut être rappelée la veille et le jour même, à l'heure choisie. L'agenda ne porte pas d'heure
// de séance : les rappels sont donc réglés sur une heure du jour, pas sur « une heure avant ».

export interface ReglagesRappels {
  /** Interrupteur général. */
  actif: boolean
  veille: boolean
  /** « HH:mm » */
  veilleHeure: string
  jour: boolean
  jourHeure: string
}

export const REGLAGES_PAR_DEFAUT: ReglagesRappels = { actif: false, veille: true, veilleHeure: '19:00', jour: true, jourHeure: '07:30' }

export const CLE_REGLAGES_RAPPELS = 'pandamove.rappels'
export const CLE_RAPPELS_ENVOYES = 'pandamove.rappels.envoyes'

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/

export const heureValide = (texte: unknown): texte is string => typeof texte === 'string' && HEURE.test(texte)

// Réglages lus tels qu'enregistrés ; toute valeur absente ou invalide revient à la valeur par défaut.
export function lireReglages(brut: string | null): ReglagesRappels {
  try {
    const v = JSON.parse(brut ?? 'null') as Partial<ReglagesRappels> | null
    return {
      actif: v?.actif === true,
      veille: typeof v?.veille === 'boolean' ? v.veille : REGLAGES_PAR_DEFAUT.veille,
      veilleHeure: heureValide(v?.veilleHeure) ? v.veilleHeure : REGLAGES_PAR_DEFAUT.veilleHeure,
      jour: typeof v?.jour === 'boolean' ? v.jour : REGLAGES_PAR_DEFAUT.jour,
      jourHeure: heureValide(v?.jourHeure) ? v.jourHeure : REGLAGES_PAR_DEFAUT.jourHeure,
    }
  } catch {
    return { ...REGLAGES_PAR_DEFAUT }
  }
}

// Part synchronisée des réglages (user_settings.rappels_json, migration 0012) : quand et à quelle heure rappeler.
// L'interrupteur général reste propre à l'appareil : l'autorisation de notifier se donne appareil par appareil.
export function versJsonSynchro(r: ReglagesRappels): string {
  return JSON.stringify({ veille: r.veille, veilleHeure: r.veilleHeure, jour: r.jour, jourHeure: r.jourHeure })
}

// Réglages de l'appareil complétés par la part synchronisée (si elle existe) ; l'interrupteur de l'appareil est gardé.
export function fusionnerSynchro(local: ReglagesRappels, json: string | null): ReglagesRappels {
  if (json === null) return local
  const synchro = lireReglages(json)
  return { ...synchro, actif: local.actif }
}

export interface RappelDu {
  /** Identifiant stable : un rappel n'est envoyé qu'une fois. */
  cle: string
  titre: string
  corps: string
}

const minutes = (heure: string) => Number(heure.slice(0, 2)) * 60 + Number(heure.slice(3))

function lendemain(dateIso: string): string {
  const [a, m, j] = dateIso.split('-').map(Number)
  return dateIsoLocale(new Date(a, m - 1, j + 1))
}

// Rappels à envoyer maintenant : séances non terminées demain (si l'heure de la veille est passée) ou aujourd'hui (si l'heure
// du jour est passée), hors celles déjà rappelées.
export function rappelsDus(reglages: ReglagesRappels, evenements: readonly EvenementAgenda[], maintenant: Date, envoyes: ReadonlySet<string>): RappelDu[] {
  if (!reglages.actif) return []
  const aujourdhui = dateIsoLocale(maintenant)
  const demain = lendemain(aujourdhui)
  const minuteCourante = maintenant.getHours() * 60 + maintenant.getMinutes()
  const dus: RappelDu[] = []
  for (const e of evenements) {
    if (e.etat === 'terminee') continue
    const veille = e.dateIso === demain && reglages.veille && minuteCourante >= minutes(reglages.veilleHeure)
    const jour = e.dateIso === aujourdhui && reglages.jour && minuteCourante >= minutes(reglages.jourHeure)
    if (!veille && !jour) continue
    const cle = `${e.id}|${e.dateIso}|${veille ? 'veille' : 'jour'}`
    if (envoyes.has(cle)) continue
    dus.push({ cle, titre: veille ? 'Séance demain' : "Séance aujourd'hui", corps: e.titre })
  }
  return dus
}

// Ne conserve que les rappels récents (le fichier ne grossit pas) : ceux dont la date est dans les 3 derniers jours ou plus tard.
export function purgerEnvoyes(envoyes: Iterable<string>, aujourdhui: string): string[] {
  const limite = (() => {
    const [a, m, j] = aujourdhui.split('-').map(Number)
    return dateIsoLocale(new Date(a, m - 1, j - 3))
  })()
  return [...envoyes].filter((cle) => (cle.split('|')[1] ?? '') >= limite)
}
