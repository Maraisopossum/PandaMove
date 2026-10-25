import type { Affichage } from './machine'

// Textes lus par les lecteurs d'écran : une phrase par changement de phase ou de série (jamais par seconde).

export function dureeParlee(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  const secondes = `${s} seconde${s > 1 ? 's' : ''}`
  if (m === 0) return secondes
  const minutes = `${m} minute${m > 1 ? 's' : ''}`
  return s === 0 ? minutes : `${minutes} ${s}`
}

const COTE_PARLE = { G: 'côté gauche', D: 'côté droit', '': '' } as const

export function annonce(a: Affichage): string {
  if (a.phase === 'decompte') return `Prêt ? ${a.nomExercice}. Départ dans ${dureeParlee(a.dureeSec)}.`
  if (a.phase === 'repos' && a.repos) {
    const duree = dureeParlee(a.dureeSec)
    const debut =
      a.repos.nature === 'fin-tour' ? `Fin du tour. Repos, ${duree}.`
      : a.repos.nature === 'cote' ? `Changez de côté, ${duree}.`
      : `Repos, ${duree}.`
    return `${debut} Prochain : ${a.repos.prochain}.`
  }
  const parties = [a.nomExercice]
  if (a.serie) parties.push(`Série ${a.serie.numero} sur ${a.serie.total}${a.serie.cote ? `, ${COTE_PARLE[a.serie.cote]}` : ''}`)
  if (a.position) parties.push(`Exercice ${a.position.rang} sur ${a.position.total}`)
  parties.push(dureeParlee(a.dureeSec))
  return parties.join('. ') + '.'
}
