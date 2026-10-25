// Identifiants numériques de l'export.
//
// Le format Android « PandaMoveExport » attend des ids Long ; la base web n'a que des UUID. On dérive
// chaque Long de l'UUID de la ligne (52 bits utiles, hors quartet de version) plutôt que d'un compteur
// séquentiel :
//  - STABLE : la même ligne a le même id dans tous les exports successifs. Avec un compteur, l'id 5 d'un
//    export de lundi et l'id 5 d'un export de jeudi pourraient désigner deux séances différentes ; or
//    l'import web (deterministicId(user:table, id)) et l'import Android (upsert par id) écraseraient alors
//    une séance par une autre en réimportant deux fichiers dans le même compte ;
//  - GRAND : de l'ordre de 10^15, donc sans risque de tomber sur les petits ids auto-incrémentés d'un
//    téléphone Android (l'import Android réutilise les ids du fichier) ;
//  - EXACT en JSON : < 2^53, donc représentable sans perte par un nombre JavaScript et un Long Kotlin.
// Collision (probabilité ~n²/2^53, négligeable) : résolue par sondage linéaire dans l'ordre des UUID
// triés, donc indépendante de l'ordre de lecture.

const BITS_BAS = 2 ** 48

/** Entier strictement positif (1 .. 2^52) dérivé des chiffres hexadécimaux de l'UUID. */
export function idLongDepuisUuid(uuid: string): number {
  const hex = uuid.replace(/-/g, '').toLowerCase().padEnd(32, '0')
  // 12 premiers chiffres (48 bits) + 14e chiffre (4 bits) : on saute le 13e, figé par la version (4 ou 5)
  const haut = parseInt(hex[13], 16) || 0
  const bas = parseInt(hex.slice(0, 12), 16) || 0
  return haut * BITS_BAS + bas + 1
}

/** Ids d'une table : UUID exporté -> Long unique dans la table. */
export class AllocateurIds {
  private readonly ids = new Map<string, number>()

  constructor(uuids: Iterable<string>) {
    const pris = new Set<number>()
    for (const uuid of [...new Set(uuids)].sort()) {
      let id = idLongDepuisUuid(uuid)
      while (pris.has(id)) id = id >= 2 ** 52 ? 1 : id + 1
      pris.add(id)
      this.ids.set(uuid, id)
    }
  }

  /** Long de l'UUID ; un UUID non exporté (référence vers une ligne absente) reçoit son entier dérivé. */
  id(uuid: string): number {
    return this.ids.get(uuid) ?? idLongDepuisUuid(uuid)
  }
}
