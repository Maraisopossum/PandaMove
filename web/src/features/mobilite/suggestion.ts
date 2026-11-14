import type { Sortie } from '../../core/db/repos/sorties'
import { ajouterJours } from '../endurance/calculCharge'
import { duree } from '../home/bilanSemaine'
import { SEANCES_TYPES } from './donnees'
import type { Routine } from './routines'
import { CHOIX_PAR_DEFAUT, type ChoixMobilite } from './stockage'

// Suggestion du jour : après une grosse sortie (60 min ou plus, hier ou aujourd'hui), une routine pour relâcher. Rien si une
// séance de mobilité est déjà faite aujourd'hui. Calcul local sur les sorties et l'historique déjà lus.

const SEUIL_S = 3600
const NOM_SPORT = { course: 'Course', velo: 'Sortie vélo' } as const

export interface Suggestion {
  /** « Sortie vélo de 1 h 38 hier. Une routine de 10 min aidera à relâcher. » */
  texte: string
  choix: ChoixMobilite
  /** « Lancer « Après le vélo » » ou « Lancer une séance de 10 min ». */
  libelleAction: string
}

type SortieMin = Pick<Sortie, 'sport' | 'date' | 'dureeS'>

export function suggerer(sorties: readonly SortieMin[], historique: readonly { date: string }[], routines: readonly Routine[], aujourdhuiIso: string): Suggestion | null {
  if (historique.some((s) => s.date === aujourdhuiIso)) return null
  const hier = ajouterJours(aujourdhuiIso, -1)
  const grosses = sorties.filter((s) => (s.date === aujourdhuiIso || s.date === hier) && (s.dureeS ?? 0) >= SEUIL_S)
  // La plus longue ; à durée égale, la plus récente
  const sortie = [...grosses].sort((a, b) => (b.dureeS ?? 0) - (a.dureeS ?? 0) || b.date.localeCompare(a.date))[0]
  if (!sortie) return null
  // Une routine « après le sport » de ce sport d'abord, puis n'importe quelle routine « après le sport », sinon la séance type du sport
  const apres = routines.filter((r) => r.choix.moment === 'apres')
  const routine = apres.find((r) => r.choix.sport === sortie.sport) ?? apres[0]
  const type = SEANCES_TYPES.find((s) => s.id === sortie.sport)
  const choix: ChoixMobilite = routine
    ? routine.choix
    : { ...CHOIX_PAR_DEFAUT, minutes: 10, sport: sortie.sport, zones: type?.zones ?? [], moment: 'apres' }
  const quand = sortie.date === aujourdhuiIso ? 'aujourd’hui' : 'hier'
  return {
    texte: `${NOM_SPORT[sortie.sport]} de ${duree(sortie.dureeS ?? 0)} ${quand}. Une routine de ${choix.minutes} min aidera à relâcher.`,
    choix,
    libelleAction: routine ? `Lancer « ${routine.nom} »` : `Lancer une séance de ${choix.minutes} min`,
  }
}
