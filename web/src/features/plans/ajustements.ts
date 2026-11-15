import type { Db } from '../../core/db/Db'
import { deplacer, type GenreCardio } from '../../core/db/repos/seancesCardio'
import { ajouterJours } from '../calendar/grille'
import type { Plan } from './plan'
import { semaineCourante, semainesSousSeuil } from './plan'
import type { ReglagesPlans } from './reglagesPlans'

// Ajustement du plan : proposer, jamais imposer. Chaque proposition affiche sa raison et reste ignorable ; décaler passe par un aperçu
// et peut être annulé. Les jalons (dates fixées par l'organisateur) et les séances validées ne bougent jamais.

export interface Deplacement {
  id: string
  genre: GenreCardio
  titre: string
  de: string
  vers: string
}

export interface ApercuDecalage {
  deplacements: Deplacement[]
  /** Séances de jalon, laissées à leur date. */
  jalonsFixes: number
  /** Séances déjà validées, laissées à leur date. */
  validees: number
}

/** Séances à décaler de `jours` jours à partir de `depuis` (comprise) : ni jalon ni séance validée (la sortie est conservée). */
export function apercuDecalage(plan: Plan, depuis: string, jours = 7): ApercuDecalage {
  const deplacements: Deplacement[] = []
  let jalonsFixes = 0
  let validees = 0
  for (const s of plan.semaines.flatMap((w) => w.seances)) {
    if (s.date < depuis) continue
    if (s.jalon) jalonsFixes++
    else if (s.etat === 'faite' || s.etat === 'autrement') validees++
    else deplacements.push({ id: s.id, genre: s.genre, titre: s.titre, de: s.date, vers: ajouterJours(s.date, jours) })
  }
  return { deplacements, jalonsFixes, validees }
}

/** Applique des déplacements (ou, avec `sens` -1, les annule) : une écriture par séance, la première erreur arrête et est relancée. */
export async function appliquerDeplacements(db: Db, deplacements: readonly Deplacement[], sens: 1 | -1 = 1): Promise<void> {
  for (const d of deplacements) await deplacer(db, d.genre, d.id, sens === 1 ? d.vers : d.de)
}

export interface PropositionAjustement {
  id: 'decaler'
  titre: string
  raison: string
}

/** Propositions d'ajustement d'après la réalisation récente. */
export function proposerAjustements(plan: Plan, aujourdhui: string, r: ReglagesPlans): PropositionAjustement[] {
  const courante = semaineCourante(plan, aujourdhui)
  if (courante < 0 || !r.prevenirTroisSemaines) return []
  const n = semainesSousSeuil(plan, courante, r.mesure, r.seuilSurveillerPct)
  if (n < 3) return []
  return [{
    id: 'decaler',
    titre: 'Décaler le plan d’une semaine',
    raison: `${n} semaines de suite sous ${r.seuilSurveillerPct} % de réalisation. Décaler les séances à venir d’une semaine laisse du temps pour reprendre sans rompre la progression ; les dates des courses ne bougent pas.`,
  }]
}
