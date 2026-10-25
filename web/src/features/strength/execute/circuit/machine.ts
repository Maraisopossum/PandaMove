// Machine à états PURE du circuit automatique et du minuteur d'exercice (port de startCircuit /
// startExerciceSeul / onCircuitExerciceFinished / onCircuitReposFini d'InstanceExecuteViewModel Android).
//
// Aucun setInterval ici : chaque fonction reçoit l'instant courant (epoch ms). Le temps restant est
// toujours recalculé depuis l'heure de début de la phase, donc un onglet en arrière-plan ou un écran
// verrouillé ne dérive pas : au retour, `avancer` rattrape en un appel toutes les phases échues, chacune
// datée de sa vraie fin (le repos démarre à la fin de l'exercice, pas à l'instant du réveil).

export const DUREE_DECOMPTE_SEC = 3
// Pause entre les côtés G et D d'un exercice unilatéral dans un circuit (absente d'Android, où l'on
// relance le minuteur à la main) : le temps de changer de côté.
export const PAUSE_COTE_SEC = 5
// Garde-fou contre une boucle infinie si un plan était incohérent
const MAX_TRANSITIONS = 10_000

export type Cote = '' | 'G' | 'D'

export interface LignePlan {
  /** Rang de la ligne dans le tableau de séries (1..N ; en bilatéral impair = G, pair = D) */
  numero: number
  libelle: string
  cote: Cote
  /** Durée à chronométrer (s), entier > 0 */
  secondes: number
  chargeKg: number | null
  /** Déjà validée au lancement : sautée */
  faite: boolean
}

export interface ExercicePlan {
  id: string
  nom: string
  /** Nombre de tours prévus pour cet exercice (affiché « Série n sur total ») */
  toursPrevus: number
  lignes: LignePlan[]
}

export interface PlanCircuit {
  mode: 'circuit' | 'seul'
  exercices: ExercicePlan[]
  /** Repos entre deux exercices du bloc (s) */
  reposInterSec: number
  /** Repos entre le dernier exercice d'un tour et le premier du tour suivant (s) */
  reposFinTourSec: number
}

export interface Position {
  exIdx: number
  numero: number
}

export type NatureRepos = 'inter' | 'fin-tour' | 'cote'
export type FinCircuit = 'terminee' | 'arretee'

interface EnCours {
  plan: PlanCircuit
  /** Lignes validées pendant ce lancement, « exIdx#numero » */
  faites: ReadonlySet<string>
  courant: Position
  /** Début de la phase (epoch ms) */
  debutMs: number
}

export type EtatCircuit =
  | { phase: 'inactif'; fin: FinCircuit | null }
  | (EnCours & { phase: 'decompte' })
  | (EnCours & { phase: 'actif'; dureeSec: number })
  | (EnCours & { phase: 'repos'; dureeSec: number; nature: NatureRepos; suivant: Position })

export const INACTIF: EtatCircuit = { phase: 'inactif', fin: null }

/** Écriture à effectuer par l'appelant : une série validée (même chemin que la validation manuelle). */
export interface EffetValider {
  type: 'valider'
  exerciceId: string
  numero: number
  secondes: number
  cote: Cote
  chargeKg: number | null
}

const cle = (p: Position) => `${p.exIdx}#${p.numero}`

function ligneDe(plan: PlanCircuit, p: Position): LignePlan {
  const l = plan.exercices[p.exIdx]?.lignes.find((x) => x.numero === p.numero)
  if (!l) throw new Error(`Ligne introuvable dans le plan : ${cle(p)}`)
  return l
}

const reste = (plan: PlanCircuit, faites: ReadonlySet<string>, exIdx: number) =>
  plan.exercices[exIdx]?.lignes.find((l) => !l.faite && !faites.has(cle({ exIdx, numero: l.numero }))) ?? null

export function demarrer(plan: PlanCircuit, depart: Position, maintenantMs: number): EtatCircuit {
  ligneDe(plan, depart) // valide le point de départ
  return { phase: 'decompte', plan, faites: new Set(), courant: depart, debutMs: maintenantMs }
}

export function arreter(etat: EtatCircuit): EtatCircuit {
  return etat.phase === 'inactif' ? etat : { phase: 'inactif', fin: 'arretee' }
}

interface Suite {
  suivant: Position
  nature: NatureRepos
  dureeSec: number
}

// Ce qui suit la ligne `fini` (déjà ajoutée à `faites`) : côté D du même exercice, exercice suivant du
// tour, premier exercice qui reste au tour suivant, ou rien (circuit terminé, ni repos ni décompte).
function suite(plan: PlanCircuit, faites: ReadonlySet<string>, fini: Position): Suite | null {
  if (plan.mode === 'seul') return null
  const ligne = ligneDe(plan, fini)
  if (ligne.cote === 'G') {
    const d = reste(plan, faites, fini.exIdx)
    if (d && d.cote === 'D') return { suivant: { exIdx: fini.exIdx, numero: d.numero }, nature: 'cote', dureeSec: PAUSE_COTE_SEC }
  }
  for (let i = fini.exIdx + 1; i < plan.exercices.length; i++) {
    const l = reste(plan, faites, i)
    if (l) return { suivant: { exIdx: i, numero: l.numero }, nature: 'inter', dureeSec: plan.reposInterSec }
  }
  for (let i = 0; i <= fini.exIdx; i++) {
    const l = reste(plan, faites, i)
    if (l) return { suivant: { exIdx: i, numero: l.numero }, nature: 'fin-tour', dureeSec: plan.reposFinTourSec }
  }
  return null
}

/** Fait avancer la machine jusqu'à `maintenantMs` ; renvoie le nouvel état et les écritures à faire (dans l'ordre). */
export function avancer(etat: EtatCircuit, maintenantMs: number): { etat: EtatCircuit; effets: EffetValider[] } {
  const effets: EffetValider[] = []
  let e = etat
  for (let garde = 0; garde < MAX_TRANSITIONS; garde++) {
    if (e.phase === 'inactif') break
    if (e.phase === 'decompte') {
      const fin = e.debutMs + DUREE_DECOMPTE_SEC * 1000
      if (maintenantMs < fin) break
      e = { phase: 'actif', plan: e.plan, faites: e.faites, courant: e.courant, debutMs: fin, dureeSec: ligneDe(e.plan, e.courant).secondes }
      continue
    }
    if (e.phase === 'actif') {
      const fin = e.debutMs + e.dureeSec * 1000
      if (maintenantMs < fin) break
      const ligne = ligneDe(e.plan, e.courant)
      effets.push({
        type: 'valider',
        exerciceId: e.plan.exercices[e.courant.exIdx].id,
        numero: ligne.numero,
        secondes: e.dureeSec,
        cote: ligne.cote,
        chargeKg: ligne.chargeKg,
      })
      const faites = new Set(e.faites).add(cle(e.courant))
      const apres = suite(e.plan, faites, e.courant)
      if (!apres) {
        e = { phase: 'inactif', fin: 'terminee' }
        break
      }
      if (apres.dureeSec <= 0) {
        e = { phase: 'actif', plan: e.plan, faites, courant: apres.suivant, debutMs: fin, dureeSec: ligneDe(e.plan, apres.suivant).secondes }
      } else {
        e = { phase: 'repos', plan: e.plan, faites, courant: e.courant, debutMs: fin, dureeSec: apres.dureeSec, nature: apres.nature, suivant: apres.suivant }
      }
      continue
    }
    const fin = e.debutMs + e.dureeSec * 1000
    if (maintenantMs < fin) break
    e = { phase: 'actif', plan: e.plan, faites: e.faites, courant: e.suivant, debutMs: fin, dureeSec: ligneDe(e.plan, e.suivant).secondes }
  }
  return { etat: e, effets }
}

export type Niveau = 'normal' | 'attention' | 'urgent'

export interface Affichage {
  mode: 'circuit' | 'seul'
  phase: 'decompte' | 'actif' | 'repos'
  /** Secondes restantes de la phase, arrondies au-dessus (jamais < 1 tant que la phase dure) */
  restantSec: number
  /** Durée totale de la phase (s) */
  dureeSec: number
  /** Exercice en cours (ou, au repos, exercice qui vient de s'achever) */
  exerciceId: string
  /** Exercice dont il est question à l'écran : en cours, ou prochain au repos */
  nomExercice: string
  serie: { numero: number; total: number; cote: Cote } | null
  position: { rang: number; total: number } | null
  repos: { nature: NatureRepos; prochain: string } | null
  niveau: Niveau
  /** Change à chaque nouvelle phase ou ligne (pas à chaque seconde) : sert aux annonces vocales */
  cle: string
}

function niveauDe(restantSec: number): Niveau {
  return restantSec <= 3 ? 'urgent' : restantSec <= 10 ? 'attention' : 'normal'
}

export function affichage(etat: EtatCircuit, maintenantMs: number): Affichage | null {
  if (etat.phase === 'inactif') return null
  const { plan } = etat
  const dureeSec = etat.phase === 'decompte' ? DUREE_DECOMPTE_SEC : etat.dureeSec
  const fin = etat.debutMs + dureeSec * 1000
  const restantSec = Math.min(dureeSec, Math.max(1, Math.ceil((fin - maintenantMs) / 1000)))
  const ex = plan.exercices[etat.courant.exIdx]
  const ligne = ligneDe(plan, etat.courant)
  const position = plan.mode === 'circuit' ? { rang: etat.courant.exIdx + 1, total: plan.exercices.length } : null
  const base = { mode: plan.mode, restantSec, dureeSec, exerciceId: ex.id, niveau: niveauDe(restantSec) }

  if (etat.phase === 'repos') {
    const prochainEx = plan.exercices[etat.suivant.exIdx]
    const suivantLigne = ligneDe(plan, etat.suivant)
    const prochain = etat.nature === 'cote' ? `${prochainEx.nom} — côté ${suivantLigne.cote}` : prochainEx.nom
    return {
      ...base,
      phase: 'repos',
      nomExercice: prochainEx.nom,
      serie: null,
      position,
      repos: { nature: etat.nature, prochain },
      cle: `repos|${cle(etat.courant)}`,
    }
  }
  const tour = ligne.cote === '' ? ligne.numero : Math.ceil(ligne.numero / 2)
  return {
    ...base,
    phase: etat.phase,
    nomExercice: ex.nom,
    serie: { numero: tour, total: Math.max(ex.toursPrevus, tour), cote: ligne.cote },
    position,
    repos: null,
    niveau: etat.phase === 'decompte' ? (restantSec >= 3 ? 'normal' : restantSec === 2 ? 'attention' : 'urgent') : base.niveau,
    cle: `${etat.phase}|${cle(etat.courant)}`,
  }
}
