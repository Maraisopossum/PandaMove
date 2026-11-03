import { LIMITES_CARDIO } from '../../../core/db/repos/seancesCardio'

export const LONGUEUR_MAX_LIEN = LIMITES_CARDIO.lien

export type ResultatLien =
  /** `valeur` est ce qu'il faut enregistrer : la forme normalisée, ou null quand il n'y a pas de lien. */
  | { ok: true; valeur: string | null }
  | { ok: false; raison: string }

const refus = (raison: string): ResultatLien => ({ ok: false, raison })

// Espace, saut de ligne, tabulation ou autre caractère de contrôle (0 à 31 et 127).
const contientEspaceOuControle = (texte: string): boolean =>
  /\s/.test(texte) || Array.from(texte).some((c) => c.charCodeAt(0) <= 0x1f || c.charCodeAt(0) === 0x7f)

// Valide le lien vers les statistiques d'une séance (Strava, Suunto, MyWoosh...). C'est le premier lien externe de
// l'application : la fonction sert à l'écriture (saisie, import) ET à l'affichage, car la synchronisation peut apporter
// un lien écrit par un autre appareil. Un lien refusé s'affiche en texte brut, jamais cliquable.
//   - vide ou absent : valide, à enregistrer à null (jamais une chaîne vide : la contrainte SQL la refuse) ;
//   - schéma https: seulement (pas http:, javascript:, data:, ftp:), deux barres puis un domaine, sans identifiants ;
//   - aucun espace ni caractère de contrôle à l'intérieur (seuls les bords sont retirés) ;
//   - on enregistre la forme normalisée (schéma et domaine en minuscules) : la contrainte SQL exige `https://` en
//     minuscules, et relire une valeur enregistrée donne le même résultat ;
//   - la longueur maximale (2048) s'applique à la forme normalisée, celle qui est enregistrée.
export function lienValide(saisie: string | null | undefined): ResultatLien {
  const texte = saisie?.trim() ?? ''
  if (texte === '') return { ok: true, valeur: null }
  if (contientEspaceOuControle(texte)) return refus('Le lien ne doit contenir ni espace ni saut de ligne.')
  // Le lecteur d'URL du navigateur accepte « https:///x » ou « https:\\x » et les corrige : on exige la forme canonique.
  if (!/^https:\/\/[^/\\]/i.test(texte)) return refus('Le lien doit commencer par https:// suivi d\'un nom de domaine.')
  let url: URL
  try {
    url = new URL(texte)
  } catch {
    return refus("Ce lien n'est pas une adresse valide.")
  }
  if (url.protocol !== 'https:') return refus('Le lien doit commencer par https://.')
  if (url.username !== '' || url.password !== '') return refus("Le lien ne doit pas contenir d'identifiant ni de mot de passe.")
  if (url.hostname === '') return refus("Le lien doit contenir un nom de domaine.")
  if (Array.from(url.href).length > LONGUEUR_MAX_LIEN) return refus(`Le lien est trop long (${LONGUEUR_MAX_LIEN} caractères au plus).`)
  return { ok: true, valeur: url.href }
}
