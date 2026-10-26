import { nombreLignes } from './lignesSeries'
import type { ExerciceVue } from './vue'

// Navigation et repos après une série validée : port fidèle de navigateToNext (InstanceExecuteViewModel
// Android). Fonctions pures sur la liste d'exercices dans l'ordre d'affichage (bloc puis position).

export interface Decision {
  // Exercice à afficher ensuite ; null = on reste sur l'exercice courant
  activerId: string | null
  // Repos à lancer (s) ; 0 = aucun repos
  reposSec: number
}

const ALTERNANT = (type: string | null) => type === 'SUPERSET' || type === 'CIRCUIT'

const faites = (e: ExerciceVue) => e.series.filter((s) => s.terminee).length

// Exercice complet : toutes ses lignes (séries prévues, × 2 en bilatéral) sont validées.
export function exerciceComplet(e: ExerciceVue): boolean {
  return faites(e) >= nombreLignes(e)
}

// Côté de la dernière série validée (« G » / « D » / vide) : en bilatéral, pas de repos entre G et D.
function dernierCote(e: ExerciceVue): string {
  const terminees = e.series.filter((s) => s.terminee)
  return terminees.reduce((a, s) => (s.numero > a.numero ? s : a), terminees[0] ?? { numero: -1, notes: '' }).notes
}

export function apresSerie(exercices: ExerciceVue[], exerciceId: string, reposOverrideSec: number | null = null): Decision {
  const idx = exercices.findIndex((e) => e.id === exerciceId)
  const ex = exercices[idx]
  if (!ex) return { activerId: null, reposSec: 0 }
  const complet = exerciceComplet(ex)
  const sauteRepos = ex.isBilateral && dernierCote(ex) === 'G'
  const repos = (sec: number) => reposOverrideSec ?? sec

  // Exercice libre
  if (ex.blocId === null) {
    if (!complet) return { activerId: null, reposSec: sauteRepos ? 0 : repos(ex.tempsReposSec) }
    const suivant = exercices[idx + 1]
    return suivant ? { activerId: suivant.id, reposSec: repos(ex.tempsReposSec) } : { activerId: null, reposSec: 0 }
  }

  // Exercice dans un bloc
  const dansBloc = exercices.filter((e) => e.blocId === ex.blocId)
  const rang = dansBloc.indexOf(ex)
  const prochain = dansBloc.slice(rang + 1).find((e) => !exerciceComplet(e))
  const alternant = ALTERNANT(ex.blocType)

  if (!alternant && !complet) return { activerId: null, reposSec: sauteRepos ? 0 : repos(ex.tempsReposSec) }
  // Bilatéral en alternance : après le côté G on attend le D
  if (alternant && ex.isBilateral && dernierCote(ex) === 'G') return { activerId: null, reposSec: 0 }

  if (prochain) return { activerId: prochain.id, reposSec: repos(alternant ? ex.blocReposInterSec : ex.tempsReposSec) }

  // Dernier exercice (non complet) du bloc
  const tousComplets = dansBloc.every(exerciceComplet)
  if (tousComplets || !alternant) {
    const suivant = exercices[exercices.lastIndexOf(dansBloc[dansBloc.length - 1]) + 1]
    if (!suivant) return { activerId: null, reposSec: 0 }
    return { activerId: suivant.id, reposSec: repos(alternant ? ex.blocReposFinRoundSec : ex.tempsReposSec) }
  }
  // Tours restants : retour au premier exercice du bloc pas encore à son quota
  const premier = dansBloc.find((e) => !exerciceComplet(e)) ?? dansBloc[0]
  return { activerId: premier.id, reposSec: repos(ex.blocReposFinRoundSec) }
}

// Exercice qui vient de recevoir une série validée entre deux relectures (une de plus que `avant`), sinon null.
export function exerciceValide(avant: ExerciceVue[], apres: ExerciceVue[]): string | null {
  for (const a of apres) {
    const b = avant.find((e) => e.id === a.id)
    if (b && faites(a) > faites(b)) return a.id
  }
  return null
}
