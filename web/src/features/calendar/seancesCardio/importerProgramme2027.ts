import type { Db } from '../../../core/db/Db'
import { deterministicId } from '../../../core/db/ids'
import { creer, type GenreCardio, lireParId } from '../../../core/db/repos/seancesCardio'
import programme from './programme2027.json'

// Une séance du programme 2027, telle que l'écrit scripts/extraire-programme-2027.mjs dans programme2027.json.
export interface EntreeProgramme {
  /** w{semaine}|e{rang} : sert à calculer l'identifiant, ne change jamais. */
  cle: string
  genre: GenreCardio
  /** yyyy-MM-dd */
  date: string
  titre: string
  consigne: string | null
  detail: string | null
  optionnelle: boolean
  jalon: string | null
}

export interface ResultatImportProgramme {
  creees: number
  /** Séances dont l'identifiant existe déjà (y compris déplacées, validées ou supprimées) : laissées telles quelles. */
  dejaPresentes: number
}

// Même utilisateur et même clé donnent le même identifiant sur tous les appareils : réimporter ne crée pas de doublon.
export const idSeanceProgramme2027 = (userId: string, cle: string) => deterministicId(userId, `programme2027|${cle}`)

// Importe le programme 2027 dans l'agenda, en une seule transaction (tout ou rien). Rejouable : une séance déjà présente
// n'est jamais touchée, donc ni une date déplacée, ni un état validé, ni une suppression ne sont défaits.
export async function importerProgramme2027(
  db: Db,
  userId: string,
  entrees: EntreeProgramme[] = programme as EntreeProgramme[],
): Promise<ResultatImportProgramme> {
  if (!userId) throw new Error('Vous devez être connecté pour importer le programme.')
  return db.writeTransaction(async (tx) => {
    let creees = 0
    let dejaPresentes = 0
    for (const e of entrees) {
      const id = idSeanceProgramme2027(userId, e.cle)
      // lireParId voit aussi les séances supprimées logiquement : une séance supprimée ne revient pas
      if (await lireParId(tx, e.genre, id)) {
        dejaPresentes += 1
        continue
      }
      await creer(tx, e.genre, {
        id, date: e.date, titre: e.titre, consigne: e.consigne, detail: e.detail, optionnelle: e.optionnelle, jalon: e.jalon,
      })
      creees += 1
    }
    return { creees, dejaPresentes }
  })
}
