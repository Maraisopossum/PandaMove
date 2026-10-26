import type { DbLecture } from '../../core/db/Db'
import { getObjectif } from '../../core/db/repos/objectifs'
import { mapExercise, mapInstance, mapSeance, type Ligne } from '../../core/db/repos/mappers'
import { getSeanceTree } from '../../core/db/repos/seances'
import type { BlocSeance, ExerciceSeance, ObjectifProgression } from '../../core/db/types'
import { chargeLisible } from '../../core/progression/chargeLisible'
import { formaterJourLong } from '../calendar/grille'
import { lireGroupes } from './catalog/filtreCatalogue'
import { libelleMuscle } from './catalog/libelles'
import { LIBELLES_BLOC, type TypeBloc } from './draft'
import { SYSTEMES_PROGRESSION } from './edition/progressionConfig'
import { formatReps } from './edition/resume'
import { ICONES_BLOC } from './edition/regles'
import { couleursBloc } from './execute/navExercices'
import { CATEGORIE_SEANCE_DIRECTE } from './seanceDirecte'

// Écran de détail d'un modèle de séance (Android SeanceDetailScreen) : tout est calculé ici, l'écran ne fait
// qu'afficher. Seules les lignes du MODÈLE sont lues (instance_seance_id IS NULL, via getSeanceTree).

export const NOM_EXERCICE_INCONNU = 'Exercice introuvable'

/** Repos : « 45 s », « 2 min », « 1 min 30 s » (Android n'affichait que les minutes entières). */
export function formatRepos(secondes: number): string {
  if (secondes < 60) return `${secondes} s`
  const reste = secondes % 60
  return reste === 0 ? `${secondes / 60} min` : `${Math.floor(secondes / 60)} min ${reste} s`
}

const decimal = (n: number) => String(chargeLisible(n)).replace('.', ',')

/** Répétitions (ou durée) cibles : objectif de progression, sinon fourchette de progression, sinon cible saisie. */
export function libelleReps(e: ExerciceSeance, objectif: ObjectifProgression | null): string {
  if (e.repsType === 'DURATION') {
    const secondes = objectif?.dureeCibleSec ?? (/^\d+$/.test(e.repsCibles.trim()) ? Number(e.repsCibles.trim()) : 0)
    return formatReps(String(secondes), 'DURATION')
  }
  if (objectif?.repsCible != null) return String(objectif.repsCible)
  if (e.progressionActivee && e.repsMin !== null && e.repsMax !== null) return `${e.repsMin}–${e.repsMax}`
  return formatReps(e.repsCibles, e.repsType)
}

/** Charge cible : « PDC » (poids du corps), objectif de progression, charge saisie, ou rien. */
export function libelleCharge(e: ExerciceSeance, objectif: ObjectifProgression | null): string | null {
  if (e.isBodyweight) return 'PDC'
  if (objectif?.chargeCible != null) return `${decimal(objectif.chargeCible)} kg`
  const saisie = e.chargeCible.trim()
  return saisie === '' ? null : saisie
}

/** Incrément de la progression : « + séries » (poids du corps), « +10s » (durée) ou « +2,5 kg ». */
export function libelleIncrement(e: ExerciceSeance): string | null {
  if (e.isBodyweight) return '+ séries'
  if (e.repsType === 'DURATION') return `+${e.incrementDureeSec}s`
  return e.incrementKg === null ? null : `+${decimal(e.incrementKg)} kg`
}

export function libelleSysteme(systeme: string | null): string | null {
  if (systeme === null || systeme === '') return null
  const connu = SYSTEMES_PROGRESSION.find((s) => s.valeur === systeme)
  if (connu) return connu.libelle
  const minuscules = systeme.toLowerCase().replace(/_/g, ' ')
  return minuscules.charAt(0).toUpperCase() + minuscules.slice(1)
}

export interface ExerciceDetail {
  id: string
  nom: string
  supersetGroupe: string | null
  equipement: string
  /** « 4 × 8–12 » */
  series: string
  /** « PDC », « 22,5 kg »… ; null si non renseignée */
  charge: string | null
  /** Repos propre à l'exercice ; null s'il est nul ou masqué (superset / circuit : le repos est celui du bloc) */
  repos: string | null
  avertissement: string
  progression: boolean
  bilateral: boolean
  systeme: string | null
  increment: string | null
}

export interface BlocDetail {
  id: string
  nom: string
  type: TypeBloc
  libelleType: string
  icone: string
  couleurClair: string
  couleurSombre: string
  /** Repos entre exercices et fin de round (superset / circuit uniquement) */
  meta: string | null
  exercices: ExerciceDetail[]
}

export type EntreeDetail = { kind: 'libre'; exercice: ExerciceDetail } | { kind: 'bloc'; bloc: BlocDetail }

export interface InstanceDetail {
  id: string
  dateIso: string
  /** « lundi 26 octobre 2026 » */
  dateLibelle: string
  etat: 'planifiee' | 'en_cours' | 'terminee'
  lien: string
}

export interface DetailSeance {
  id: string
  nom: string
  notes: string
  dureeEstimeeMin: number
  muscles: string[]
  archivee: boolean
  /** Séance directe (sans modèle réutilisable) */
  directe: boolean
  stats: { exercices: number; progression: number; series: number; dureeMin: number }
  entrees: EntreeDetail[]
  instances: InstanceDetail[]
}

const TYPES_BLOC_CONNUS = Object.keys(LIBELLES_BLOC)
const typeBloc = (t: string): TypeBloc => (TYPES_BLOC_CONNUS.includes(t) ? (t as TypeBloc) : 'ECHAUFFEMENT')

function versExerciceDetail(e: ExerciceSeance, nom: string, objectif: ObjectifProgression | null, dansBlocRepos: boolean): ExerciceDetail {
  const charge = libelleCharge(e, objectif)
  return {
    id: e.id,
    nom,
    supersetGroupe: e.supersetGroupe,
    equipement: e.equipement.trim(),
    series: `${e.nombreSeriesPrevues} × ${libelleReps(e, objectif)}`,
    charge,
    repos: !dansBlocRepos && e.tempsReposSec > 0 ? formatRepos(e.tempsReposSec) : null,
    avertissement: e.avertissement.trim(),
    progression: e.progressionActivee,
    bilateral: e.isBilateral,
    systeme: e.progressionActivee ? libelleSysteme(e.systemeProgression) : null,
    increment: e.progressionActivee ? libelleIncrement(e) : null,
  }
}

// Lit le détail d'un modèle (archivé compris). Null si la séance n'existe pas ou est supprimée. Un exercice dont la
// fiche du catalogue a disparu garde une ligne avec un nom de repli (jamais d'exception).
export async function lireDetailSeance(db: DbLecture, seanceId: string): Promise<DetailSeance | null> {
  const ligne = await db.getOptional<Ligne>('SELECT * FROM seances WHERE id = ? AND deleted_at IS NULL', [seanceId])
  if (!ligne) return null
  const seance = mapSeance(ligne)
  const { blocs, exercices } = await getSeanceTree(db, seanceId, null)

  const ids = [...new Set(exercices.map((e) => e.exerciseId))]
  const noms = new Map<string, string>()
  const objectifs = new Map<string, ObjectifProgression | null>()
  for (const id of ids) {
    const l = await db.getOptional<Ligne>('SELECT * FROM exercises WHERE id = ? AND deleted_at IS NULL', [id])
    if (l) noms.set(id, mapExercise(l).name)
    objectifs.set(id, await getObjectif(db, seanceId, id))
  }
  const vue = (e: ExerciceSeance, dansBlocRepos: boolean) =>
    versExerciceDetail(e, noms.get(e.exerciseId) ?? NOM_EXERCICE_INCONNU, objectifs.get(e.exerciseId) ?? null, dansBlocRepos)

  // Libres et blocs sur la même échelle de positions ; à égalité, l'exercice libre d'abord (tri stable)
  const connus = new Set(blocs.map((b) => b.id))
  const libres = exercices.filter((e) => e.blocId === null || !connus.has(e.blocId))
  const entrees = [
    ...libres.map((e) => ({ position: e.position, entree: { kind: 'libre', exercice: vue(e, false) } as EntreeDetail })),
    ...blocs.map((b: BlocSeance) => {
      const type = typeBloc(b.type)
      const repartis = type === 'SUPERSET' || type === 'CIRCUIT'
      const couleurs = couleursBloc(type)
      const bloc: BlocDetail = {
        id: b.id,
        nom: b.nom.trim() || LIBELLES_BLOC[type],
        type,
        libelleType: LIBELLES_BLOC[type],
        icone: ICONES_BLOC[type],
        couleurClair: couleurs.clair,
        couleurSombre: couleurs.sombre,
        meta: repartis ? `inter ${formatRepos(b.tempsReposInterSec)} · fin de round ${formatRepos(b.tempsReposFinRoundSec)}` : null,
        exercices: exercices
          .filter((e) => e.blocId === b.id)
          .sort((x, y) => x.position - y.position)
          .map((e) => vue(e, repartis)),
      }
      return { position: b.position, entree: { kind: 'bloc', bloc } as EntreeDetail }
    }),
  ]
    .sort((x, y) => x.position - y.position)
    .map((x) => x.entree)

  const instancesLignes = await db.getAll<Ligne>(
    'SELECT * FROM instances_seance WHERE seance_id = ? AND deleted_at IS NULL ORDER BY date, id',
    [seanceId],
  )
  const instances: InstanceDetail[] = instancesLignes.map(mapInstance).map((i) => {
    const etat = i.isCompleted ? 'terminee' : i.startedAt !== null ? 'en_cours' : 'planifiee'
    return {
      id: i.id,
      dateIso: i.date,
      dateLibelle: formaterJourLong(i.date),
      etat,
      lien: etat === 'terminee' ? `/strength/instance/${i.id}/report` : `/strength/instance/${i.id}`,
    }
  })
  // À venir d'abord (date croissante), puis réalisées (la plus récente en premier)
  const aVenir = instances.filter((i) => i.etat !== 'terminee')
  const faites = instances.filter((i) => i.etat === 'terminee').reverse()

  return {
    id: seance.id,
    nom: seance.nom,
    notes: seance.notes,
    dureeEstimeeMin: seance.dureeEstimeeMin,
    muscles: lireGroupes(seance.groupesMusculaires).map(libelleMuscle),
    archivee: seance.isArchived,
    directe: seance.seanceCategory === CATEGORIE_SEANCE_DIRECTE,
    stats: {
      exercices: exercices.length,
      progression: exercices.filter((e) => e.progressionActivee).length,
      series: exercices.reduce((somme, e) => somme + e.nombreSeriesPrevues, 0),
      dureeMin: seance.dureeEstimeeMin,
    },
    entrees,
    instances: [...aVenir, ...faites],
  }
}
