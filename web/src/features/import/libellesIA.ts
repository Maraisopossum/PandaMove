import type { ResultatImportIA } from '../../core/import-ia/apply'
import type { ApercuSeanceIA } from '../../core/import-ia/planifier'

// Libellés de l'import de séances d'une IA : fonctions pures (les composants ne décident de rien).

const pluriel = (n: number, singulier: string, plurielTexte: string) => `${n} ${n > 1 ? plurielTexte : singulier}`

export const libelleSeances = (n: number) => pluriel(n, 'séance', 'séances')
export const libelleExercices = (n: number) => pluriel(n, 'exercice', 'exercices')

/** « Importer 3 séances » ; « Aucune séance à importer » quand tout est déjà présent. */
export const libelleBoutonImport = (n: number) => (n > 0 ? `Importer ${libelleSeances(n)}` : 'Aucune séance à importer')

/** « 3 séances importées, 2 exercices créés » */
export function messageResultat(r: ResultatImportIA): string {
  if (r.seances === 0) {
    return `Aucune nouvelle séance : ${r.ignorees > 1 ? 'ces séances étaient' : 'cette séance était'} déjà présente${r.ignorees > 1 ? 's' : ''}.`
  }
  const importees = r.seances > 1 ? `${r.seances} séances importées` : '1 séance importée'
  const exercices = r.exercicesCrees === 0 ? 'aucun exercice créé' : r.exercicesCrees > 1 ? `${r.exercicesCrees} exercices créés` : '1 exercice créé'
  return `${importees}, ${exercices}.`
}

/** Ligne de synthèse de l'aperçu : « 3 séances à importer, 2 exercices à créer ». */
export function syntheseApercu(seances: ApercuSeanceIA[], nbACreer: number): string {
  const nouvelles = seances.filter((s) => s.statut === 'nouvelle').length
  const morceaux = [`${libelleSeances(nouvelles)} à importer`]
  const ignorees = seances.length - nouvelles
  if (ignorees > 0) morceaux.push(`${ignorees} déjà présente${ignorees > 1 ? 's' : ''} (ignorée${ignorees > 1 ? 's' : ''})`)
  morceaux.push(nbACreer === 0 ? 'aucun exercice à créer' : `${libelleExercices(nbACreer)} à créer`)
  return `${morceaux.join(', ')}.`
}

/** « 4 blocs · 6 exercices · 20 séries · ≈ 45 min » */
export function detailSeance(s: ApercuSeanceIA): string {
  const series = s.nbSeries > 1 ? `${s.nbSeries} séries` : `${s.nbSeries} série`
  return [pluriel(s.nbBlocs, 'bloc', 'blocs'), libelleExercices(s.nbExercices), series, s.dureeMin > 0 ? `≈ ${s.dureeMin} min` : '—'].join(' · ')
}

export const ETIQUETTES_STATUT = {
  nouvelle: null,
  'deja-presente': 'Déjà présente : ignorée',
  'doublon-fichier': 'Doublon dans le fichier : ignoré',
} as const
