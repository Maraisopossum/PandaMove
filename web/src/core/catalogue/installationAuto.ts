import type { Db } from '../db/Db'
import { catalogueDeBaseInstalle, installerCatalogueDeBase, type ResultatInstallation } from './installerCatalogue'

// Installation automatique du catalogue de base, une seule fois par compte et par appareil.
//
// Marqueur (le plus sûr, deux garde-fous cumulés) :
//  1. la base locale ne contient AUCUNE ligne du catalogue de base (is_custom = 0, supprimées comprises :
//     un utilisateur qui a tout supprimé ne se voit pas réinstaller le catalogue) ;
//  2. un drapeau localStorage par compte n'a pas encore été posé (try/catch : stockage parfois
//     indisponible, auquel cas seul le garde-fou 1 joue, et l'installation reste idempotente).
// Avant de décider, on attend la première synchronisation : sur un nouvel appareil, le catalogue déjà
// installé depuis un autre appareil arrive du serveur, et réinstaller localement écraserait ses favoris.

export interface StockageDrapeau {
  lire(cle: string): string | null
  ecrire(cle: string, valeur: string): void
}

export const cleDrapeauCatalogue = (userId: string) => `pandamove.catalogueBaseInstalle.${userId}`

export const stockageNavigateur: StockageDrapeau = {
  lire(cle) {
    try {
      return localStorage.getItem(cle)
    } catch {
      return null
    }
  },
  ecrire(cle, valeur) {
    try {
      localStorage.setItem(cle, valeur)
    } catch {
      /* stockage indisponible : l'installation restera protégée par le comptage en base */
    }
  },
}

export interface DepsInstallationAuto {
  db: Db
  userId: string
  /** Résout quand la première synchronisation est terminée. */
  attendreSynchro: () => Promise<void>
  stockage?: StockageDrapeau
}

/** Installe le catalogue si besoin ; renvoie le résultat, ou null si rien n'était à faire. */
export async function installerAutomatiquement({
  db, userId, attendreSynchro, stockage = stockageNavigateur,
}: DepsInstallationAuto): Promise<ResultatInstallation | null> {
  const cle = cleDrapeauCatalogue(userId)
  if (stockage.lire(cle) !== null) return null
  await attendreSynchro()
  if (await catalogueDeBaseInstalle(db)) {
    stockage.ecrire(cle, '1')
    return null
  }
  const resultat = await installerCatalogueDeBase(db, userId)
  stockage.ecrire(cle, '1')
  return resultat
}
