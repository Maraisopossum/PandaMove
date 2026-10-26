// Minuteur de repos (menu +30 s / −30 s / arrêt, repos saisi à la main, minuteur manuel). Fonctions pures.
// Tout est dérivé d'horodatages : le repos des séries part de la validation (validated_at) ; un réglage ou un
// minuteur manuel mémorise une FIN absolue, jamais un compte à rebours décrémenté. Un rechargement restitue donc
// le décompte exact (l'état est gardé dans le navigateur, voir useMinuteurRepos).

/** Repos issu de la dernière série validée (voir infoRepos dans vue.ts). */
export interface InfoRepos {
  /** « exercice#rang » de la série qui a lancé le repos */
  cle: string
  /** Instant de validation (ms) */
  debutMs: number
  /** Durée du repos (s), > 0 */
  dureeSec: number
}

/** Réglage manuel du repos d'une série. */
export interface ReglageSerie {
  cle: string
  /** Validation visée (ms) ; null : valable pour toute validation de cette ligne (durée saisie avant la validation) */
  ancreMs: number | null
  /** Durée remplaçant celle de l'exercice (s) */
  dureeForceeSec: number | null
  /** Fin absolue (ms) après un +30 s / −30 s */
  finMs: number | null
  arrete: boolean
}

/** Minuteur lancé à la main (feuille « Minuteur »). */
export interface Manuel {
  debutMs: number
  finMs: number
  arrete: boolean
}

export interface EtatMinuteur {
  reglage: ReglageSerie | null
  manuel: Manuel | null
  /** Dernière durée choisie dans la feuille (s), proposée à l'ouverture suivante */
  derniereManuelleSec: number
}

export const ETAT_INITIAL: EtatMinuteur = { reglage: null, manuel: null, derniereManuelleSec: 30 }

export const PRESETS_MANUEL: { sec: number; libelle: string }[] = [
  { sec: 30, libelle: '30 s' },
  { sec: 60, libelle: '1 min' },
  { sec: 90, libelle: '1 min 30' },
  { sec: 120, libelle: '2 min' },
  { sec: 180, libelle: '3 min' },
  { sec: 300, libelle: '5 min' },
]

/** Pas de ±5 s du réglage manuel, jamais sous 5 s (comme Android). */
export const pasManuel = (sec: number, sens: 1 | -1): number => Math.max(5, sec + sens * 5)

/** « 45 s », « 1 min », « 1 min 30 », « — » si nul. */
export function texteDuree(sec: number): string {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const r = sec % 60
  if (m === 0) return `${r} s`
  return r === 0 ? `${m} min` : `${m} min ${r}`
}

const fin = (debutMs: number, dureeSec: number) => debutMs + dureeSec * 1000

// Le minuteur manuel l'emporte s'il est au moins aussi récent que la dernière validation.
function manuelActif(info: InfoRepos | null, etat: EtatMinuteur): Manuel | null {
  const m = etat.manuel
  if (!m) return null
  return info === null || m.debutMs >= info.debutMs ? m : null
}

function reglageDe(info: InfoRepos, etat: EtatMinuteur): ReglageSerie | null {
  const r = etat.reglage
  if (!r || r.cle !== info.cle) return null
  return r.ancreMs === null || r.ancreMs === info.debutMs ? r : null
}

/** Temps de repos restant (ms, borné à 0), ou null s'il n'y a (plus) de repos à afficher. */
export function restantMs(info: InfoRepos | null, etat: EtatMinuteur, maintenantMs: number): number | null {
  const manuel = manuelActif(info, etat)
  if (manuel) return manuel.arrete ? null : Math.max(0, manuel.finMs - maintenantMs)
  if (!info) return null
  const r = reglageDe(info, etat)
  if (r?.arrete) return null
  if (r?.finMs != null) return Math.max(0, r.finMs - maintenantMs)
  const duree = r?.dureeForceeSec ?? info.dureeSec
  if (duree <= 0) return null
  return Math.max(0, fin(info.debutMs, duree) - maintenantMs)
}

/** +30 s / −30 s sur le repos restant (jamais sous 0), appliqué au minuteur actif. */
export function ajuster(info: InfoRepos | null, etat: EtatMinuteur, deltaSec: number, maintenantMs: number): EtatMinuteur {
  const restant = restantMs(info, etat, maintenantMs) ?? 0
  const nouvelleFin = maintenantMs + Math.max(0, restant + deltaSec * 1000)
  const manuel = manuelActif(info, etat)
  if (manuel) return { ...etat, manuel: { ...manuel, finMs: nouvelleFin, arrete: false } }
  if (!info) return etat
  return { ...etat, reglage: { cle: info.cle, ancreMs: info.debutMs, dureeForceeSec: null, finMs: nouvelleFin, arrete: false } }
}

/** Arrête le minuteur actif (repos des séries ou manuel). */
export function arreter(info: InfoRepos | null, etat: EtatMinuteur, maintenantMs: number): EtatMinuteur {
  const manuel = manuelActif(info, etat)
  if (manuel) return { ...etat, manuel: { ...manuel, finMs: maintenantMs, arrete: true } }
  if (!info) return etat
  return { ...etat, reglage: { cle: info.cle, ancreMs: info.debutMs, dureeForceeSec: null, finMs: null, arrete: true } }
}

/** Démarre le minuteur manuel (durée > 0) et retient la durée. */
export function demarrerManuel(etat: EtatMinuteur, maintenantMs: number, dureeSec: number): EtatMinuteur {
  if (!(dureeSec > 0)) return etat
  return { ...etat, manuel: { debutMs: maintenantMs, finMs: fin(maintenantMs, dureeSec), arrete: false }, derniereManuelleSec: dureeSec }
}

/** Repos saisi à la main sur une ligne, pour sa prochaine validation (Android : reposOverrideSec). */
export function forcerDuree(etat: EtatMinuteur, cle: string, dureeSec: number): EtatMinuteur {
  return { ...etat, reglage: { cle, ancreMs: null, dureeForceeSec: Math.max(0, Math.round(dureeSec)), finMs: null, arrete: false } }
}

/** Retire le réglage d'une ligne (dé-validation ou nouvelle validation sans repos saisi). */
export function oublierReglage(etat: EtatMinuteur, cle: string): EtatMinuteur {
  return etat.reglage?.cle === cle ? { ...etat, reglage: null } : etat
}

export const serialiserEtat = (etat: EtatMinuteur): string => JSON.stringify(etat)

const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Lecture défensive de l'état gardé dans le navigateur : toute forme inattendue donne l'état initial. */
export function lireEtat(texte: string | null): EtatMinuteur {
  if (texte === null) return ETAT_INITIAL
  try {
    const v: unknown = JSON.parse(texte)
    if (typeof v !== 'object' || v === null) return ETAT_INITIAL
    const o = v as Record<string, unknown>
    const r = o.reglage as Record<string, unknown> | null | undefined
    const m = o.manuel as Record<string, unknown> | null | undefined
    const reglageOk =
      r == null ||
      (typeof r.cle === 'string' &&
        (r.ancreMs === null || nombre(r.ancreMs)) &&
        (r.dureeForceeSec === null || nombre(r.dureeForceeSec)) &&
        (r.finMs === null || nombre(r.finMs)) &&
        typeof r.arrete === 'boolean')
    const manuelOk = m == null || (nombre(m.debutMs) && nombre(m.finMs) && typeof m.arrete === 'boolean')
    if (!reglageOk || !manuelOk || !nombre(o.derniereManuelleSec)) return ETAT_INITIAL
    return { reglage: (r ?? null) as ReglageSerie | null, manuel: (m ?? null) as Manuel | null, derniereManuelleSec: o.derniereManuelleSec }
  } catch {
    return ETAT_INITIAL
  }
}
