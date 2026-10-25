import type { Affichage } from './machine'

// Bips du circuit : uniquement ce que fait l'Android (ToneGenerator) — bip de départ, bip chaque seconde
// des 5 dernières secondes d'un exercice, bip de fin, bip discret des 5 dernières secondes de repos.
// Ni vibration ni synthèse vocale côté Android : rien de tel ici. Fonction pure, comparée d'un affichage
// au suivant (l'appelant n'appelle pas après une longue suspension de l'onglet, pour ne pas rejouer le passé).

export type Bip = 'depart' | 'compte' | 'fin' | 'repos'

export function bipsEntre(avant: Affichage | null, apres: Affichage | null): Bip[] {
  const bips: Bip[] = []
  const change = avant !== null && (apres === null || apres.cle !== avant.cle)
  if (avant?.phase === 'actif' && change) bips.push('fin')
  if (apres?.phase === 'actif' && change) bips.push('depart')
  if (apres && avant && !change && apres.restantSec !== avant.restantSec && apres.restantSec >= 1 && apres.restantSec <= 5) {
    if (apres.phase === 'actif') bips.push('compte')
    else if (apres.phase === 'repos') bips.push('repos')
  }
  return bips
}
