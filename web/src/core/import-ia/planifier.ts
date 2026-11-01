import { LIBELLES_BLOC, ajouterBloc, ajouterExercice, appliquerSeriesCircuit, brouillonVide, exercicesDe, nouveauBloc,
  nouvelExercice, renumeroter, validerBrouillon, type BlocDraft, type ExerciceDraft, type SeanceDraft } from '../../features/strength/draft'
import { dureeEstimeeMin } from '../../features/strength/edition/dureeEstimee'
import { activerProgression, basculerPoidsDeCorps, choisirSysteme } from '../../features/strength/edition/progressionConfig'
import { reglesExercice } from '../../features/strength/edition/regles'
import { lireListeEquipement } from '../../features/strength/progression/cible'
import { musclesExercice } from '../../features/strength/seanceStore'
import { groupesCorriges } from '../catalogue/groupesCorriges'
import { muscleToGroup } from '../catalogue/muscleToGroup'
import { normalizeSearch } from '../common/normalizeSearch'
import { deterministicId } from '../db/ids'
import { idExercice } from '../db/repos/exercises'
import type { Exercise } from '../db/types'
import { trouverExercice } from './correspondance'
import { DEFAUTS, type BlocIA, type ExerciceIA, type FichierIA, type SeanceIA } from './format'

// Plan d'import d'un fichier « séances IA » : fonction PURE (aucune base, aucune horloge, aucun hasard). À fichier,
// utilisateur et état de la base identiques, le plan est identique : c'est ce qui rend l'import idempotent.
//
// Identifiants : séance = UUID v5 du contenu normalisé (casse, accents et espaces ignorés) + utilisateur ;
// blocs et exercices dérivés de l'id de séance et de leur rang. Le nom final (suffixe « (2) ») n'entre pas dans
// l'id : réimporter le même fichier retombe toujours sur la même séance.

export interface ContextePlan {
  userId: string
  /** Exercices vivants de la base locale (catalogue de base installé + exercices personnalisés). */
  catalogue: Exercise[]
  /** Séances modèles vivantes (archivées comprises). */
  seancesExistantes: { id: string; nom: string }[]
}

export interface ExerciceACreer {
  id: string
  nom: string
  musclePrimary: string
  muscleGroups: string[]
  isBodyweight: boolean
  /** ia : fournis par le fichier ; deduits : dérivés du nom ; autre : rien de reconnu. */
  origineMuscles: 'ia' | 'deduits' | 'autre'
}

export interface ExerciceReconnu {
  nomFichier: string
  nomCatalogue: string
  via: 'exact' | 'alias'
}

export type StatutSeanceIA = 'nouvelle' | 'deja-presente' | 'doublon-fichier'

export interface ApercuSeanceIA {
  index: number
  /** Nom qui sera enregistré (avec suffixe éventuel). */
  nom: string
  nomFichier: string
  renommee: boolean
  statut: StatutSeanceIA
  nbBlocs: number
  nbExercices: number
  nbSeries: number
  dureeMin: number
  reconnus: ExerciceReconnu[]
  aCreer: { nom: string; proche: string | null }[]
  avertissements: string[]
}

export interface PlanImportIA {
  seances: ApercuSeanceIA[]
  /** Brouillons à écrire (séances « nouvelles » seulement), dans l'ordre du fichier. */
  brouillons: SeanceDraft[]
  exercicesACreer: ExerciceACreer[]
  /** Erreurs bloquantes détectées à la conversion (règles de l'éditeur). */
  erreurs: string[]
}

const NAMESPACE = (userId: string) => `${userId}:seance-ia`

// Forme canonique (clés triées, textes normalisés, reps toujours en texte) : base de l'identifiant de séance.
function canonique(v: unknown): unknown {
  if (typeof v === 'string') return normalizeSearch(v)
  if (Array.isArray(v)) return v.map(canonique)
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, k === 'reps' && typeof x === 'number' ? String(x) : canonique(x)]),
    )
  }
  return v
}

export const idSeanceIA = (userId: string, seance: SeanceIA) => deterministicId(NAMESPACE(userId), JSON.stringify(canonique(seance)))

function exerciceCatalogue(e: Exercise) {
  return { id: e.id, name: e.name, muscles: musclesExercice(e), equipment: lireListeEquipement(e.equipment), isBodyweight: e.isBodyweight }
}

function musclesACreer(e: ExerciceIA): Pick<ExerciceACreer, 'musclePrimary' | 'muscleGroups' | 'origineMuscles'> {
  if (e.muscles) {
    const groupes = [...new Set([e.muscles.principal, ...(e.muscles.secondaires ?? [])])]
    const c = groupesCorriges({ musclePrimary: e.muscles.principal, muscleGroups: groupes }, null)
    return { musclePrimary: c.musclePrimary, muscleGroups: c.muscleGroups, origineMuscles: 'ia' }
  }
  const deduit = muscleToGroup(e.exercice)
  const c = groupesCorriges({ musclePrimary: deduit, muscleGroups: [deduit] }, null)
  return { musclePrimary: c.musclePrimary, muscleGroups: c.muscleGroups, origineMuscles: deduit === 'AUTRE' ? 'autre' : 'deduits' }
}

const PLAGE = /^(\d+)\s*[-–]\s*(\d+)$/

// Progression : mêmes fonctions que l'éditeur (activerProgression, choisirSysteme), donc mêmes défauts et mêmes
// invariants. Retourne l'exercice et d'éventuels avertissements.
function avecProgression(e: ExerciceDraft, p: ExerciceIA['progression'], typeBloc: BlocIA['type'], nom: string): { e: ExerciceDraft; avert: string[] } {
  if (!p?.activee) return { e, avert: [] }
  if (!reglesExercice(typeBloc === 'LIBRE' ? null : typeBloc).progression) {
    return { e, avert: [`${nom} : progression ignorée (non applicable dans un bloc ${LIBELLES_BLOC[typeBloc as keyof typeof LIBELLES_BLOC]})`] }
  }
  const avert: string[] = []
  const systeme = p.systeme ?? DEFAUTS.systeme
  let repsMin = p.repsMin
  let repsMax = p.repsMax
  let repsCibles = e.repsCibles
  const plage = PLAGE.exec(e.repsCibles.trim())
  if (systeme === 'DOUBLE' && e.repsType === 'REPS' && plage) {
    // Le moteur lit les répétitions cibles comme un entier : la plage devient [min, max] et la cible de départ est le bas
    repsMin ??= Number(plage[1])
    repsMax ??= Number(plage[2])
    repsCibles = String(repsMin)
    avert.push(`${nom} : répétitions « ${e.repsCibles} » converties pour la progression (plage ${repsMin}–${repsMax}, départ à ${repsMin}).`)
  }
  let r = activerProgression({
    ...e, repsCibles, systemeProgression: systeme, repsMin: repsMin ?? null, repsMax: repsMax ?? null,
    incrementKg: p.incrementKg ?? null, seuilDeload: p.seuilDeload ?? e.seuilDeload,
  })
  r = choisirSysteme(r, systeme)
  return { e: r, avert }
}

interface Contexte {
  userId: string
  idSeance: string
  rang: { n: number }
  catalogue: Exercise[]
  aCreer: Map<string, ExerciceACreer>
  avert: string[]
  reconnus: Map<string, ExerciceReconnu>
  inconnusSeance: Map<string, { nom: string; proche: string | null }>
}

function convertirExercice(e: ExerciceIA, bloc: BlocIA, ctx: Contexte): ExerciceDraft {
  const circuit = bloc.type === 'CIRCUIT'
  const typeBloc = bloc.type === 'LIBRE' ? null : bloc.type
  const id = deterministicId(NAMESPACE(ctx.userId), `${ctx.idSeance}:exercice:${ctx.rang.n++}`)
  const trouve = trouverExercice(e.exercice, ctx.catalogue)

  let source
  if (trouve.type === 'inconnu') {
    const cle = normalizeSearch(e.exercice)
    let cree = ctx.aCreer.get(cle)
    if (!cree) {
      const m = musclesACreer(e)
      cree = { id: idExercice(ctx.userId, e.exercice), nom: e.exercice.trim(), ...m, isBodyweight: e.charge === 'PDC' }
      ctx.aCreer.set(cle, cree)
    }
    if (!ctx.inconnusSeance.has(cle)) {
      ctx.inconnusSeance.set(cle, { nom: cree.nom, proche: trouve.proche?.name ?? null })
      if (trouve.proche) {
        ctx.avert.push(
          `Exercice « ${e.exercice.trim()} » inconnu du catalogue : vouliez-vous dire « ${trouve.proche.name} » ? Il sera créé tel quel ; corrigez le fichier si c'est une faute de frappe.`,
        )
      }
    }
    source = { id: cree.id, name: cree.nom, muscles: cree.muscleGroups, equipment: [] as string[], isBodyweight: cree.isBodyweight }
  } else {
    source = exerciceCatalogue(trouve.exercice)
    ctx.reconnus.set(normalizeSearch(source.name), { nomFichier: e.exercice.trim(), nomCatalogue: source.name, via: trouve.type })
  }

  let d: ExerciceDraft = nouvelExercice(id, source, typeBloc)
  const reps = e.reps === undefined ? '' : String(e.reps).trim()
  d = {
    ...d,
    nombreSeriesPrevues: e.series ?? bloc.tours ?? DEFAUTS.tours,
    repsCibles: reps,
    tempsReposSec: e.reposSec ?? DEFAUTS.reposSec,
    tempo: e.tempo?.trim() ?? '',
    consigneCle: e.consigne?.trim() ?? '',
    isBilateral: circuit ? false : (e.bilateral ?? false),
  }
  if (e.dureeSec !== undefined) {
    if (reps !== '') ctx.avert.push(`${source.name} : « reps » ignoré car « dureeSec » est indiqué (exercice chronométré).`)
    d = { ...d, repsType: 'DURATION', repsCibles: String(e.dureeSec) }
  }
  if (e.charge === 'PDC') d = { ...basculerPoidsDeCorps(d, true), chargeCible: 'PDC' }
  else if (e.chargeKg !== undefined) d = { ...d, chargeCible: `${e.chargeKg} kg` }
  if (e.typeExercice) d = { ...d, typeExercice: e.typeExercice }

  const prog = avecProgression(d, e.progression, bloc.type, source.name)
  ctx.avert.push(...prog.avert)
  return prog.e
}

function convertirSeance(s: SeanceIA, nom: string, idSeance: string, base: Omit<Contexte, 'idSeance' | 'rang' | 'avert' | 'reconnus' | 'inconnusSeance'>) {
  const ctx: Contexte = { ...base, idSeance, rang: { n: 0 }, avert: [], reconnus: new Map(), inconnusSeance: new Map() }
  let d: SeanceDraft = { ...brouillonVide(idSeance), nom, notes: s.notes?.trim() ?? '' }
  s.blocs.forEach((b, i) => {
    const exercices = b.exercices.map((e) => convertirExercice(e, b, ctx))
    if (b.type === 'LIBRE') {
      for (const e of exercices) d = ajouterExercice(d, null, e)
      return
    }
    if (b.type === 'SUPERSET' && (b.exercices.length < 2 || b.exercices.length > 4)) {
      ctx.avert.push(`Bloc ${i + 1} (superset) : ${b.exercices.length} exercice(s) ; un superset en compte 2 à 4.`)
    }
    if (b.type !== 'CIRCUIT' && b.tours !== undefined) ctx.avert.push(`Bloc ${i + 1} : « tours » ne concerne que les CIRCUIT, ignoré.`)
    const avecRepos = b.type === 'SUPERSET' || b.type === 'CIRCUIT'
    if (!avecRepos && (b.reposInterExercicesSec !== undefined || b.reposFinTourSec !== undefined)) {
      ctx.avert.push(`Bloc ${i + 1} : les repos de bloc ne concernent que les SUPERSET et CIRCUIT, ignorés.`)
    }
    const modele = nouveauBloc(deterministicId(NAMESPACE(base.userId), `${idSeance}:bloc:${i}`), b.type)
    const bloc: BlocDraft = {
      ...modele,
      nom: b.nom?.trim() || modele.nom,
      nombreSeriesPrevues: b.type === 'CIRCUIT' ? (b.tours ?? DEFAUTS.tours) : modele.nombreSeriesPrevues,
      tempsReposInterSec: avecRepos ? (b.reposInterExercicesSec ?? modele.tempsReposInterSec) : modele.tempsReposInterSec,
      tempsReposFinRoundSec: avecRepos ? (b.reposFinTourSec ?? modele.tempsReposFinRoundSec) : modele.tempsReposFinRoundSec,
      exercices,
    }
    d = ajouterBloc(d, bloc)
  })
  return { d: renumeroter(appliquerSeriesCircuit(d)), ctx }
}

export function planifierImportIA(fichier: FichierIA, contexte: ContextePlan): PlanImportIA {
  const { userId, catalogue, seancesExistantes } = contexte
  const idsExistants = new Set(seancesExistantes.map((s) => s.id))
  const nomsPris = new Set(seancesExistantes.map((s) => normalizeSearch(s.nom)))
  const idsFichier = new Set<string>()
  const aCreer = new Map<string, ExerciceACreer>()
  const base = { userId, catalogue, aCreer }

  const seances: ApercuSeanceIA[] = []
  const brouillons: SeanceDraft[] = []
  const erreurs: string[] = []

  fichier.seances.forEach((s, index) => {
    const nomFichier = s.nom.trim()
    const id = idSeanceIA(userId, s)
    const nbBlocs = s.blocs.length
    const nbExercices = s.blocs.reduce((n, b) => n + b.exercices.length, 0)
    const dejaId = idsExistants.has(id)
    const doublon = idsFichier.has(id)

    // Nom final : suffixe « (2) », « (3)… » tant que le nom (normalisé) est pris par une autre séance
    let nom = nomFichier
    if (!dejaId && !doublon) {
      for (let n = 2; nomsPris.has(normalizeSearch(nom)); n++) {
        const suffixe = ` (${n})`
        nom = `${nomFichier.slice(0, 100 - suffixe.length).trimEnd()}${suffixe}`
      }
      nomsPris.add(normalizeSearch(nom))
    }
    idsFichier.add(id)

    // Une séance déjà présente (ou en double dans le fichier) n'est pas reconvertie : aucun exercice créé pour elle
    const { d, ctx } = convertirSeance(s, nom, id, dejaId || doublon ? { ...base, aCreer: new Map() } : base)
    const statut: StatutSeanceIA = dejaId ? 'deja-presente' : doublon ? 'doublon-fichier' : 'nouvelle'
    const avertissements = [...ctx.avert]
    if (nom !== nomFichier) {
      avertissements.unshift(`Une séance « ${nomFichier} » existe déjà avec un contenu différent : celle-ci sera enregistrée sous « ${nom} ».`)
    }
    if (statut === 'nouvelle') {
      for (const m of validerBrouillon(d)) erreurs.push(`Séance « ${nom} » : ${m}`)
      brouillons.push(d)
    }
    seances.push({
      index, nom: dejaId ? (seancesExistantes.find((x) => x.id === id)?.nom ?? nom) : nom, nomFichier, renommee: nom !== nomFichier, statut,
      nbBlocs, nbExercices, nbSeries: exercicesDe(d).reduce((n, e) => n + e.nombreSeriesPrevues, 0), dureeMin: dureeEstimeeMin(d),
      reconnus: [...ctx.reconnus.values()], aCreer: statut === 'nouvelle' ? [...ctx.inconnusSeance.values()] : [], avertissements,
    })
  })

  return { seances, brouillons, exercicesACreer: [...aCreer.values()], erreurs }
}

