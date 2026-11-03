import type { SeanceCardio } from '../../core/db/repos/seancesCardio'
import type { EvenementAgenda, EvenementCardio, EvenementRenfo, GenreAgenda, InstanceVue } from './types'

// Libellés écrits en toutes lettres : le genre n'est jamais indiqué par la couleur seule.
export const LIBELLE_GENRE: Record<GenreAgenda, string> = { renfo: 'Renforcement', course: 'Course', velo: 'Vélo' }

// Ordre d'affichage des genres dans une même journée : renforcement, puis course, puis vélo.
export const ORDRE_GENRES: readonly GenreAgenda[] = ['renfo', 'course', 'velo']

// À appeler dans la branche `default` d'un `switch` sur `genre` : si un genre n'est pas traité, le paramètre n'est plus
// de type `never` et `tsc -b` échoue. À l'exécution, un genre inattendu lève une erreur au lieu d'être ignoré.
export function exhaustif(genre: never): never {
  throw new Error(`Genre d'événement non géré : ${String(genre)}`)
}

export function depuisInstance(instance: InstanceVue): EvenementRenfo {
  return { id: instance.id, genre: 'renfo', dateIso: instance.dateIso, titre: instance.nom, etat: instance.etat, instance }
}

export function depuisCardio(seance: SeanceCardio): EvenementCardio {
  return {
    id: seance.id,
    genre: seance.genre,
    dateIso: seance.date,
    titre: seance.titre,
    etat: seance.isValidated ? 'terminee' : 'planifiee',
    consigne: seance.consigne,
    detail: seance.detail,
    optionnelle: seance.optionnelle,
    jalon: seance.jalon,
    lien: seance.lien,
  }
}

// Jour, puis genre (renforcement, course, vélo), puis identifiant : ordre stable sur tous les appareils.
export function comparerEvenements(a: EvenementAgenda, b: EvenementAgenda): number {
  if (a.dateIso !== b.dateIso) return a.dateIso < b.dateIso ? -1 : 1
  const ecart = ORDRE_GENRES.indexOf(a.genre) - ORDRE_GENRES.indexOf(b.genre)
  if (ecart !== 0) return ecart
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

export const trierEvenements = (evenements: readonly EvenementAgenda[]): EvenementAgenda[] => [...evenements].sort(comparerEvenements)

// Une séance terminée (renforcement) ou validée (cardio) ne se déplace pas. Le renforcement terminé garde sa date parce
// qu'elle ancre les statistiques ; le cardio suit la même règle par cohérence d'interface (décision du 2026-11-02).
export function peutDeplacer(evenement: EvenementAgenda): boolean {
  switch (evenement.genre) {
    case 'renfo':
    case 'course':
    case 'velo':
      return evenement.etat !== 'terminee'
    default:
      return exhaustif(evenement)
  }
}

// Même texte que le module d'accès aux données cardio (core/db/repos/seancesCardio.ts) : il est vu avant l'écriture
// (cette fonction) comme à l'écriture (relecture dans la transaction).
export function messageRefusDeplacement(evenement: EvenementAgenda): string {
  switch (evenement.genre) {
    case 'renfo':
      return 'Une séance terminée ne peut pas être déplacée : sa date sert aux statistiques.'
    case 'course':
    case 'velo':
      return 'Dévalidez la séance pour la déplacer.'
    default:
      return exhaustif(evenement)
  }
}
