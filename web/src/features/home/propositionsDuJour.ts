import { dateIsoLocale } from '../../core/common/dates'
import type { DbLecture } from '../../core/db/Db'
import { lireSeancesMobilite } from '../../core/db/repos/mobilite'
import { lireSeancesDepuis } from '../../core/db/repos/respiration'
import { lireSorties } from '../../core/db/repos/sorties'
import { lireEvenementsPlage } from '../calendar/calendrier'
import { ajouterJours } from '../endurance/calculCharge'
import { duree } from './bilanSemaine'
import { lireRoutines } from '../mobilite/routines'
import { suggerer } from '../mobilite/suggestion'
import { lireFavorite, lireObjectifQuotidien } from '../respiration/reglages'
import { METHODES_INTEGREES } from '../respiration/methodes'
import { dureeParJour } from '../respiration/statsRespiration'
import { volumeParMuscle } from '../stats/statsQueries'
import { JOURS_EQUILIBRE } from '../strength/useSuggestionsRenfo'
import { lireGroupesParSeance, suggererSeances } from '../strength/suggestionsRenfo'
import type { ChoixMobilite } from '../mobilite/stockage'

// Propositions du jour de l'accueil : jusqu'à trois suggestions tirées des modules, chacune sur ses propres règles (séance de
// renforcement suggérée, routine de mobilité après une grosse sortie, respiration quand l'objectif du jour n'est pas atteint).
// Indicatif : elles ne remplacent pas les sensations. Une lecture qui échoue retire simplement la proposition.

export type ActionProposition =
  | { type: 'lien'; vers: string; libelle: string }
  | { type: 'mobilite'; choix: ChoixMobilite; libelle: string }

export interface Proposition {
  id: 'renforcement' | 'mobilite' | 'respiration'
  /** « Renforcement · séance du jour ». */
  categorie: string
  titre: string
  detail: string
  /** Pastille du menu (public/icons/menu/<icone>.webp). */
  icone: 'halteres' | 'mobilite' | 'souffle'
  action: ActionProposition
}

async function renforcement(db: DbLecture, aujourdhui: string): Promise<Proposition | null> {
  // Une séance de renforcement déjà prévue aujourd'hui est proposée par la carte « Prochaine séance » : pas de doublon
  const prevues = await lireEvenementsPlage(db, aujourdhui, aujourdhui)
  if (prevues.some((e) => e.genre === 'renfo' && e.etat !== 'terminee')) return null
  const [volume, groupes] = await Promise.all([volumeParMuscle(db, ajouterJours(aujourdhui, -(JOURS_EQUILIBRE - 1)), aujourdhui), lireGroupesParSeance(db)])
  const s = suggererSeances(volume, groupes)[0]
  if (!s) return null
  const ligne = await db.getOptional<{ nom: string }>('SELECT nom FROM seances WHERE id = ? AND deleted_at IS NULL', [s.seanceId])
  if (!ligne) return null
  return {
    id: 'renforcement', categorie: 'Renforcement · séance du jour', titre: ligne.nom, icone: 'halteres',
    detail: `${s.enRetard[0].libelle}${s.enRetard[1] ? ` et ${s.enRetard[1].libelle.toLowerCase()}` : ''} ${s.enRetard[1] ? 'sont les moins travaillés' : 'est le moins travaillé'} de la quinzaine.`,
    action: { type: 'lien', vers: `/strength/${s.seanceId}`, libelle: 'Voir' },
  }
}

async function mobilite(db: DbLecture, aujourdhui: string): Promise<Proposition | null> {
  const [sorties, faites] = await Promise.all([lireSorties(db, { limite: 20 }), lireSeancesMobilite(db)])
  const s = suggerer(sorties, faites, lireRoutines(), aujourdhui)
  if (!s) return null
  const sortie = sorties.find((x) => (x.date === aujourdhui || x.date === ajouterJours(aujourdhui, -1)) && (x.dureeS ?? 0) >= 3600)
  const quand = sortie?.date === aujourdhui ? 'd’aujourd’hui' : 'd’hier'
  return {
    id: 'mobilite', categorie: `Mobilité · après ${sortie?.sport === 'course' ? 'la course' : 'le vélo'} ${quand}`, icone: 'mobilite',
    titre: s.libelleAction.startsWith('Lancer «') ? s.libelleAction.replace('Lancer ', '') : `Séance de ${s.choix.minutes} min`,
    detail: `${s.choix.minutes} min pour relâcher après ${sortie ? duree(sortie.dureeS ?? 0) : 'l’effort'} d’effort.`,
    action: { type: 'mobilite', choix: s.choix, libelle: 'Lancer' },
  }
}

async function respiration(db: DbLecture, aujourdhui: string): Promise<Proposition | null> {
  const toutes = await lireSeancesDepuis(db, '0000-01-01')
  // Pas de relance pour qui n'a jamais utilisé le module
  if (toutes.length === 0) return null
  const objectif = lireObjectifQuotidien()
  const faitesMin = Math.round((dureeParJour(toutes).get(aujourdhui) ?? 0) / 60)
  if (faitesMin >= objectif) return null
  const favorite = lireFavorite()
  const nom = METHODES_INTEGREES.find((m) => m.id === favorite)?.nom ?? 'Cohérence cardiaque'
  return {
    id: 'respiration', categorie: `Respiration · ${faitesMin} min aujourd’hui`, titre: nom, icone: 'souffle',
    detail: `Il vous manque ${objectif - faitesMin} min pour votre objectif du jour.`,
    action: { type: 'lien', vers: '/breathing', libelle: 'Respirer' },
  }
}

export async function lirePropositions(db: DbLecture, maintenant: Date): Promise<Proposition[]> {
  const aujourdhui = dateIsoLocale(maintenant)
  const resultats = await Promise.all(
    [renforcement, mobilite, respiration].map((f) =>
      f(db, aujourdhui).catch((e: unknown) => {
        console.error('Proposition du jour impossible', e)
        return null
      }),
    ),
  )
  return resultats.filter((p): p is Proposition => p !== null).slice(0, 3)
}
