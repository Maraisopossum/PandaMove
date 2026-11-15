import { useCallback, useSyncExternalStore } from 'react'

// Dernier envoi rejeté définitivement par Supabase (erreurs 22xxx / 23xxx / 42501 du connecteur).
// Le connecteur abandonne alors la transaction pour débloquer la file : la modification ne sera
// pas rejouée et disparaîtra de l'appareil au prochain point de synchro. On la signale donc à
// l'utilisateur (message non bloquant dans la coque) au lieu de la seule trace console.

export interface RejetEnvoi {
  table: string
  operation: string
  code: string
  dateMs: number
}

let dernierRejet: RejetEnvoi | null = null
// Compteurs depuis le dernier battement (table + code) : envoyés à l'administration technique, jamais le contenu de la ligne rejetée
const compteurs = new Map<string, { table: string; code: string; nb: number }>()
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach((f) => f())

export const rejetsEnvoi = {
  dernier: (): RejetEnvoi | null => dernierRejet,
  signaler(rejet: RejetEnvoi): void {
    dernierRejet = rejet
    const cle = `${rejet.table}|${rejet.code}`
    const c = compteurs.get(cle)
    if (c) c.nb++
    else compteurs.set(cle, { table: rejet.table, code: rejet.code, nb: 1 })
    prevenir()
  },
  /** Rejets comptés depuis le dernier appel, puis remis à zéro (alimente le battement). */
  prelever(): { table: string; code: string; nb: number }[] {
    const liste = [...compteurs.values()]
    compteurs.clear()
    return liste
  },
  /** Remet des rejets non envoyés dans les compteurs (échec du battement). */
  restituer(liste: { table: string; code: string; nb: number }[]): void {
    for (const r of liste) {
      const c = compteurs.get(`${r.table}|${r.code}`)
      if (c) c.nb += r.nb
      else compteurs.set(`${r.table}|${r.code}`, { ...r })
    }
  },
  effacer(): void {
    dernierRejet = null
    prevenir()
  },
  abonner(f: () => void): () => void {
    abonnes.add(f)
    return () => abonnes.delete(f)
  },
}

export const messageRejet = (r: RejetEnvoi) => `Une modification n'a pas pu être envoyée au serveur (code ${r.code}).`

/** Message du dernier rejet (null si aucun ou masqué) et action pour le masquer. */
export function useRejetEnvoi(): { message: string | null; masquer: () => void } {
  const rejet = useSyncExternalStore(rejetsEnvoi.abonner, rejetsEnvoi.dernier, rejetsEnvoi.dernier)
  const masquer = useCallback(() => rejetsEnvoi.effacer(), [])
  return { message: rejet ? messageRejet(rejet) : null, masquer }
}
