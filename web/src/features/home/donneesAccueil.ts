import type { DbLecture } from '../../core/db/Db'
import { lireSorties, type Sortie } from '../../core/db/repos/sorties'
import { lireInstancesPlage } from '../calendar/calendrier'
import {
  ajouterJours, calculerSerieCharge, etatForme, parametresEffectifs, type EtatForme, type ReglagesCharge,
} from '../endurance/calculCharge'
import { duree } from './bilanSemaine'

// Données des cartes « Forme du jour » et « Dernière activité » de l'accueil. Lecture seule, calculs locaux.

export interface FormeJour {
  /** Fraîcheur (forme moins fatigue), arrondie : le grand chiffre de la carte. */
  fraicheur: number
  /** Charge sur 42 jours (forme) et sur 7 jours (fatigue), arrondies. */
  forme: number
  fatigue: number
  etat: EtatForme
  /** Fraîcheur quotidienne des 42 derniers jours, du plus ancien au plus récent (courbe). */
  serie: number[]
}

const FENETRE_JOURS = 42

// Sans sortie, aucune charge n'est calculable : la carte n'est pas affichée (null).
export function calculerFormeJour(sorties: readonly Sortie[], reglages: ReglagesCharge, aujourdhuiIso: string): FormeJour | null {
  if (sorties.length === 0) return null
  const complete = calculerSerieCharge(sorties, parametresEffectifs(sorties, reglages), aujourdhuiIso)
  const dernier = complete.at(-1)
  if (!dernier) return null
  const debut = ajouterJours(aujourdhuiIso, -(FENETRE_JOURS - 1))
  return {
    fraicheur: Math.round(dernier.fraicheur),
    forme: Math.round(dernier.forme),
    fatigue: Math.round(dernier.fatigue),
    etat: etatForme(dernier.fraicheur),
    serie: complete.filter((j) => j.date >= debut).map((j) => j.fraicheur),
  }
}

export interface DerniereActivite {
  id: string
  titre: string
  dateIso: string
  /** « 42,1 km · 1 h 38 » ou « 52 min · 18 séries ». */
  detail: string
  /** Illustration du menu (public/icons/menu/<icone>.webp) et destination du lien. */
  icone: 'halteres' | 'course' | 'velo'
  vers: string
}

const km = (m: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(m / 1000)} km`
const MOIS_RECUL_JOURS = 60

// La séance terminée la plus récente, tous sports : sortie de course ou de vélo, ou séance de renforcement jouée.
// À date égale, la sortie l'emporte (elle porte les chiffres les plus parlants).
export async function lireDerniereActivite(db: DbLecture, aujourdhuiIso: string): Promise<DerniereActivite | null> {
  const [sorties, instances] = await Promise.all([
    lireSorties(db, { limite: 1 }),
    lireInstancesPlage(db, ajouterJours(aujourdhuiIso, -MOIS_RECUL_JOURS), aujourdhuiIso),
  ])
  const sortie = sorties[0] && sorties[0].date <= aujourdhuiIso ? sorties[0] : undefined
  const renfo = instances.filter((i) => i.etat === 'terminee').sort((a, b) => b.dateIso.localeCompare(a.dateIso))[0]
  if (sortie && (!renfo || sortie.date >= renfo.dateIso)) {
    const morceaux = [sortie.distanceM ? km(sortie.distanceM) : null, sortie.dureeS ? duree(sortie.dureeS) : null].filter(Boolean)
    return {
      id: sortie.id,
      titre: sortie.titre,
      dateIso: sortie.date,
      detail: morceaux.join(' · '),
      icone: sortie.sport,
      vers: `/${sortie.sport === 'course' ? 'running' : 'cycling'}/${sortie.id}`,
    }
  }
  if (!renfo) return null
  const morceaux = [
    renfo.dureeSec ? duree(renfo.dureeSec) : null,
    renfo.nbSeries ? `${renfo.nbSeries} série${renfo.nbSeries > 1 ? 's' : ''}` : null,
  ].filter(Boolean)
  return { id: renfo.id, titre: renfo.nom, dateIso: renfo.dateIso, detail: morceaux.join(' · '), icone: 'halteres', vers: `/strength/instance/${renfo.id}/report` }
}
