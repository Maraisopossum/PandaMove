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
const abonnes = new Set<() => void>()
const prevenir = () => abonnes.forEach((f) => f())

export const rejetsEnvoi = {
  dernier: (): RejetEnvoi | null => dernierRejet,
  signaler(rejet: RejetEnvoi): void {
    dernierRejet = rejet
    prevenir()
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
