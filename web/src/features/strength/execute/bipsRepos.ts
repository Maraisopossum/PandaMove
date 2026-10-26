// Bips de fin de repos (Android : ActiveSessionManager.restCountdownBeep, un bip chaque seconde des 5 dernières
// secondes). Fonction pure, comparée d'un affichage du minuteur au suivant ; l'appelant joue le bip « repos » du sonneur.

/** Vrai quand la seconde affichée passe à une valeur de 5 à 1 en décomptant (jamais à 0, jamais en remontant). */
export function bipRepos(avantMs: number | null, apresMs: number | null): boolean {
  if (avantMs === null || apresMs === null) return false
  const avant = Math.ceil(avantMs / 1000)
  const apres = Math.ceil(apresMs / 1000)
  return apres < avant && apres >= 1 && apres <= 5
}

/** Vrai quand le décompte atteint zéro de lui-même (≤ 1,5 s restantes juste avant) ; un repos arrêté (null) ou raccourci à la main ne sonne pas. */
export function finRepos(avantMs: number | null, apresMs: number | null): boolean {
  return avantMs !== null && apresMs === 0 && avantMs > 0 && avantMs <= 1500
}
