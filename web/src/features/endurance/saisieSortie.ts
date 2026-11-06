import { LIMITES_SORTIE, type SaisieSortie, type Sport } from '../../core/db/repos/sorties'
import { lienValide } from '../calendar/seancesCardio/lienValide'

// Brouillon du formulaire : tout est du texte tel que tapé. `lireBrouillon` le valide champ par champ et produit la saisie
// destinée à core/db/repos/sorties (qui revérifie les mêmes bornes que les contraintes SQL).
export interface BrouillonSortie {
  date: string
  titre: string
  /** « h:mm:ss » ou « mm:ss ». */
  duree: string
  /** Kilomètres, virgule ou point. */
  distanceKm: string
  denivele: string
  fcMoy: string
  fcMax: string
  rpe: string
  notes: string
  lien: string
  enSalle: boolean
  /** Séance planifiée à valider avec la sortie (id), ou ''. */
  seanceId: string
}

export type ChampSortie = keyof BrouillonSortie
export type ErreursSortie = Partial<Record<ChampSortie, string>>

export const BROUILLON_VIERGE = (date: string): BrouillonSortie => ({
  date, titre: '', duree: '', distanceKm: '', denivele: '', fcMoy: '', fcMax: '', rpe: '', notes: '', lien: '', enSalle: false, seanceId: '',
})

// « 1:05:30 » -> 3930 ; « 52:30 » -> 3150 ; vide -> null ; invalide -> undefined.
export function analyserDuree(texte: string): number | null | undefined {
  const t = texte.trim()
  if (t === '') return null
  const m = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return undefined
  const [h, min, s] = [Number(m[1] ?? 0), Number(m[2]), Number(m[3])]
  if (s > 59 || (m[1] !== undefined && min > 59)) return undefined
  return h * 3600 + min * 60 + s
}

// Nombre décimal positif avec virgule ou point ; vide -> null ; invalide -> undefined.
function analyserDecimal(texte: string): number | null | undefined {
  const t = texte.trim().replace(',', '.')
  if (t === '') return null
  if (!/^\d+(\.\d+)?$/.test(t)) return undefined
  return Number(t)
}

function analyserEntier(texte: string): number | null | undefined {
  const t = texte.trim()
  if (t === '') return null
  return /^\d+$/.test(t) ? Number(t) : undefined
}

export type ResultatBrouillon = { ok: true; saisie: SaisieSortie } | { ok: false; erreurs: ErreursSortie }

export function lireBrouillon(b: BrouillonSortie, sport: Sport): ResultatBrouillon {
  const erreurs: ErreursSortie = {}
  const { fc, rpe } = LIMITES_SORTIE

  const dureeS = analyserDuree(b.duree)
  if (dureeS === undefined) erreurs.duree = 'Durée au format h:mm:ss ou mm:ss (par exemple 52:30).'
  else if (dureeS !== null && dureeS > LIMITES_SORTIE.dureeS) erreurs.duree = 'Durée trop longue.'

  const km = analyserDecimal(b.distanceKm)
  if (km === undefined) erreurs.distanceKm = 'Distance en kilomètres (par exemple 10,5).'
  else if (km !== null && km * 1000 > LIMITES_SORTIE.distanceM) erreurs.distanceKm = 'Distance trop grande.'

  const deniveleM = analyserDecimal(b.denivele)
  if (deniveleM === undefined) erreurs.denivele = 'Dénivelé en mètres (par exemple 120).'
  else if (deniveleM !== null && deniveleM > LIMITES_SORTIE.deniveleM) erreurs.denivele = 'Dénivelé trop grand.'

  const bornes = (libelle: string, texte: string, min: number, max: number): number | null | undefined => {
    const n = analyserEntier(texte)
    if (n === undefined || (n !== null && (n < min || n > max))) return void (erreurs[libelle as ChampSortie] = `Entier entre ${min} et ${max}.`)
    return n
  }
  const fcMoy = bornes('fcMoy', b.fcMoy, fc.min, fc.max)
  const fcMax = bornes('fcMax', b.fcMax, fc.min, fc.max)
  if (!erreurs.fcMoy && !erreurs.fcMax && fcMoy != null && fcMax != null && fcMoy > fcMax) erreurs.fcMoy = 'La FC moyenne dépasse la maximale.'
  const rpeN = bornes('rpe', b.rpe, rpe.min, rpe.max)

  const lien = lienValide(b.lien)
  if (!lien.ok) erreurs.lien = lien.raison

  if (Object.keys(erreurs).length > 0 || !lien.ok) return { ok: false, erreurs }
  return {
    ok: true,
    saisie: {
      sport,
      date: b.date,
      titre: b.titre,
      dureeS: dureeS ?? null,
      distanceM: km === null || km === undefined ? null : Math.round(km * 1000),
      denivelePosM: deniveleM ?? null,
      fcMoy: fcMoy ?? null,
      fcMax: fcMax ?? null,
      rpe: rpeN ?? null,
      notes: b.notes,
      lien: lien.valeur,
      enSalle: b.enSalle,
      seanceId: b.seanceId === '' ? null : b.seanceId,
    },
  }
}
