// Rappel de sauvegarde : réglage d'appareil (localStorage, non synchronisé) et calcul de l'échéance. Fonctions pures,
// sauf lecture/écriture de la préférence.

export type FrequenceRappel = 'jamais' | 'mois' | 'trimestre'

export const CLE_RAPPEL_SAUVEGARDE = 'pandamove.sauvegarde.rappel'

export const JOURS_PAR_FREQUENCE: Record<Exclude<FrequenceRappel, 'jamais'>, number> = { mois: 30, trimestre: 90 }

export function lireFrequenceRappel(): FrequenceRappel {
  try {
    const v = globalThis.localStorage?.getItem(CLE_RAPPEL_SAUVEGARDE)
    return v === 'mois' || v === 'trimestre' ? v : 'jamais'
  } catch {
    return 'jamais'
  }
}

export function ecrireFrequenceRappel(f: FrequenceRappel): void {
  try {
    globalThis.localStorage?.setItem(CLE_RAPPEL_SAUVEGARDE, f)
  } catch {
    // stockage indisponible : le réglage n'est pas retenu
  }
}

/** Jours entiers écoulés depuis `iso` ; null si la date est absente ou illisible. */
export function joursDepuis(iso: string | null, maintenant: Date): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((maintenant.getTime() - t) / 86_400_000))
}

/** Vrai quand un rappel est réglé et que la dernière sauvegarde est absente ou plus ancienne que la fréquence. */
export function rappelDu(derniereIso: string | null, frequence: FrequenceRappel, maintenant: Date): boolean {
  if (frequence === 'jamais') return false
  const jours = joursDepuis(derniereIso, maintenant)
  return jours === null || jours >= JOURS_PAR_FREQUENCE[frequence]
}

/** « il y a 41 jours », « aujourd’hui », « il y a 2 min » (pour un envoi récent). */
export function ilYa(date: Date, maintenant: Date): string {
  const min = Math.max(0, Math.floor((maintenant.getTime() - date.getTime()) / 60_000))
  if (min < 1) return 'à l’instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return `il y a ${j} jour${j > 1 ? 's' : ''}`
}
