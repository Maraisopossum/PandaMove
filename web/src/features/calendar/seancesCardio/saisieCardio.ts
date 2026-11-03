import { dateIsoValide } from '../../../core/common/dates'
import { type ChampsSeanceCardio, type GenreCardio, LIMITES_CARDIO, type SaisieSeanceCardio } from '../../../core/db/repos/seancesCardio'
import type { EvenementCardio } from '../types'
import { lienValide } from './lienValide'

// Formulaire d'une séance de cardio : état du brouillon (tout en texte, comme dans les champs) et validation avant
// écriture. Les mêmes règles sont revérifiées par le module d'accès aux données et par la base ; elles sont contrôlées ici
// d'abord pour afficher un message par champ, sans rien envoyer.

export interface BrouillonSeanceCardio {
  genre: GenreCardio
  /** yyyy-MM-dd */
  date: string
  titre: string
  consigne: string
  /** Texte « durée · zone », par exemple « 45 min · Z2 ». */
  detail: string
  jalon: string
  optionnelle: boolean
  lien: string
}

export type ChampBrouillon = 'titre' | 'date' | 'consigne' | 'detail' | 'jalon' | 'lien'
export type ErreursSaisie = Partial<Record<ChampBrouillon, string>>

export type ResultatSaisie =
  /** `saisie` pour une création ; `champs` (tous les champs modifiables, les vidés à null) pour une modification. */
  | { ok: true; saisie: SaisieSeanceCardio; champs: ChampsSeanceCardio }
  | { ok: false; erreurs: ErreursSaisie }

export const brouillonVide = (dateIso: string, genre: GenreCardio = 'course'): BrouillonSeanceCardio => ({
  genre, date: dateIso, titre: '', consigne: '', detail: '', jalon: '', optionnelle: false, lien: '',
})

export const brouillonDepuis = (e: EvenementCardio): BrouillonSeanceCardio => ({
  genre: e.genre,
  date: e.dateIso,
  titre: e.titre,
  consigne: e.consigne ?? '',
  detail: e.detail ?? '',
  jalon: e.jalon ?? '',
  optionnelle: e.optionnelle,
  lien: e.lien ?? '',
})

const longueur = (texte: string) => Array.from(texte).length
const vide = (texte: string): string | null => (texte.trim() === '' ? null : texte.trim())

const LIBELLES = { consigne: 'La consigne', detail: 'Le détail', jalon: 'Le jalon' } as const

// Valide le brouillon. En édition la date n'est pas contrôlée : elle se change par « Changer la date ».
export function validerBrouillon(b: BrouillonSeanceCardio, mode: 'creation' | 'edition'): ResultatSaisie {
  const erreurs: ErreursSaisie = {}

  const titre = b.titre.trim()
  if (titre === '') erreurs.titre = 'Le titre est obligatoire.'
  else if (longueur(titre) > LIMITES_CARDIO.titre) erreurs.titre = `Le titre est trop long (${LIMITES_CARDIO.titre} caractères au plus).`

  if (mode === 'creation' && !dateIsoValide(b.date)) erreurs.date = 'Choisissez une date réelle.'

  const facultatif = (champ: keyof typeof LIBELLES): string | null => {
    const valeur = vide(b[champ])
    if (valeur !== null && longueur(valeur) > LIMITES_CARDIO[champ]) {
      erreurs[champ] = `${LIBELLES[champ]} est trop long (${LIMITES_CARDIO[champ]} caractères au plus).`
    }
    return valeur
  }
  const consigne = facultatif('consigne')
  const detail = facultatif('detail')
  const jalon = facultatif('jalon')

  const lien = lienValide(b.lien)
  if (!lien.ok) erreurs.lien = lien.raison

  if (Object.keys(erreurs).length > 0 || !lien.ok) return { ok: false, erreurs }
  const valeurs = { titre, consigne, detail, optionnelle: b.optionnelle, jalon, lien: lien.valeur }
  const saisie: SaisieSeanceCardio = { date: b.date, ...valeurs }
  const champs: ChampsSeanceCardio = valeurs
  return { ok: true, saisie, champs }
}
