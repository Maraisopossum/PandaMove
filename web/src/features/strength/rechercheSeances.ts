import { normalizeSearch } from '../../core/common/normalizeSearch'
import type { Seance } from '../../core/db/types'
import { lireGroupes } from './catalog/filtreCatalogue'
import { libelleMuscle } from './catalog/libelles'

/** Le champ de recherche n'apparaît qu'à partir de ce nombre de modèles (en dessous, il ne ferait que charger l'écran). */
export const SEUIL_RECHERCHE = 6

// Filtre les modèles : chaque mot de la requête doit figurer dans le nom, les groupes musculaires (libellés français)
// ou les notes, sans tenir compte des accents ni de la casse. Requête vide : liste inchangée.
export function filtrerSeances(seances: Seance[], requete: string): Seance[] {
  const mots = normalizeSearch(requete).split(' ').filter((m) => m !== '')
  if (mots.length === 0) return seances
  return seances.filter((s) => {
    const texte = normalizeSearch([s.nom, ...lireGroupes(s.groupesMusculaires).map(libelleMuscle), s.notes].join(' '))
    return mots.every((m) => texte.includes(m))
  })
}
