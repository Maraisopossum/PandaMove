import type { PandaImageName } from '../../core/images/pandaImage'

// Onboarding du premier lancement : contenu des étapes et état « vu » persisté dans localStorage.

export const CLE_ONBOARDING = 'pandamove.onboarding.vu'

export interface EtapeOnboarding {
  titre: string
  texte: string
  image: PandaImageName
}

export const ETAPES_ONBOARDING: readonly EtapeOnboarding[] = [
  {
    titre: 'Bienvenue sur PandaMove',
    texte: 'Votre compagnon d’entraînement, utilisable même sans réseau : tout est enregistré sur l’appareil puis synchronisé.',
    image: 'onboarding_01',
  },
  {
    titre: 'Vos séances de renforcement',
    texte: 'Créez vos séances ou importez celles de l’application Android, puis planifiez-les dans le calendrier.',
    image: 'onboarding_02',
  },
  {
    titre: 'Récupérer, c’est progresser',
    texte: 'Temps de repos, séries et ressenti : le panda vous accompagne à chaque séance, sans brûler les étapes.',
    image: 'onboarding_03',
  },
  {
    titre: 'Suivez vos progrès',
    texte: 'Tonnage, volume par muscle et charges proposées séance après séance : vous voyez où vous en êtes.',
    image: 'onboarding_04',
  },
  {
    titre: 'C’est parti !',
    texte: 'Choisissez votre panda dans le profil et lancez votre première séance.',
    image: 'onboarding_05',
  },
]

/** Accès au stockage, lui-même susceptible de lever (données de site bloquées). */
export type AccesStockage = () => Storage

const stockageNavigateur: AccesStockage = () => window.localStorage

// Stockage illisible : l'onboarding est considéré comme non vu (il reste ignorable à tout moment).
export function lireVu(stockage: AccesStockage = stockageNavigateur): boolean {
  try {
    return stockage().getItem(CLE_ONBOARDING) === '1'
  } catch (e) {
    console.warn('Lecture de l’état de l’onboarding impossible', e)
    return false
  }
}

// Écriture impossible : sans conséquence, l'onboarding reviendra au prochain lancement.
export function marquerVu(stockage: AccesStockage = stockageNavigateur): void {
  try {
    stockage().setItem(CLE_ONBOARDING, '1')
  } catch (e) {
    console.warn('Enregistrement de l’état de l’onboarding impossible', e)
  }
}
