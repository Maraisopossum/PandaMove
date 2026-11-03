import { dateIsoValide } from '../../core/common/dates'
import type { Db, DbLecture, DbTx } from '../../core/db/Db'
import type { Ligne } from '../../core/db/repos/mappers'
import { lireNomSeance } from '../../core/db/repos/seances'
import {
  ErreurSeanceCardio, type ChampsSeanceCardio, type GenreCardio, type SaisieSeanceCardio,
  creer as creerCardio, definirValidation as definirValidationCardio, deplacer as deplacerCardio, lirePlage as lirePlageCardio,
  lireProchaines as lireProchainesCardio, modifier as modifierCardio, supprimer as supprimerCardio,
} from '../../core/db/repos/seancesCardio'
import { listSeries } from '../../core/db/repos/series'
import { depuisCardio, depuisInstance, exhaustif, messageRefusDeplacement, peutDeplacer, trierEvenements } from './evenements'
import type { EvenementAgenda, InstanceVue } from './types'

// Erreur destinée à l'utilisateur (message en français).
export class ErreurCalendrier extends Error {}

export const NOM_SEANCE_INCONNUE = 'Séance (supprimée)'

// Transforme une ligne d'instance en vue : nom (même si la séance est supprimée, pour l'historique
// conservé), état et, pour les séances démarrées ou terminées, durée et nombre de séries terminées.
export async function instanceEnVue(db: DbLecture, l: Ligne): Promise<InstanceVue> {
  const id = String(l.id)
  const seanceId = String(l.seance_id)
  const terminee = l.is_completed === 1
  const etat = terminee ? 'terminee' : l.started_at != null ? 'en_cours' : 'planifiee'
  const vue: InstanceVue = {
    id,
    seanceId,
    // Nom propre de la séance jouée (renommée à l'exécution), sinon nom du modèle
    nom: (await lireNomSeance(db, seanceId, l.nom == null ? null : String(l.nom))) ?? NOM_SEANCE_INCONNUE,
    dateIso: String(l.date),
    etat,
  }
  if (terminee) vue.dureeSec = Number(l.duration_seconds ?? 0)
  if (etat !== 'planifiee') vue.nbSeries = (await listSeries(db, id)).filter((s) => s.isCompleted).length
  return vue
}

// Instances vivantes dont la date PLANIFIÉE (colonne date, jamais completed_at) est dans [debutIso, finIso].
export async function lireInstancesPlage(db: DbLecture, debutIso: string, finIso: string): Promise<InstanceVue[]> {
  const lignes = await db.getAll<Ligne>(
    'SELECT * FROM instances_seance WHERE deleted_at IS NULL AND date >= ? AND date <= ? ORDER BY date, id',
    [debutIso, finIso],
  )
  return Promise.all(lignes.map((l) => instanceEnVue(db, l)))
}

// Prochaines séances : à partir d'aujourd'hui, non terminées (planifiées ou en cours), indépendamment du mois affiché.
export async function lireProchaines(db: DbLecture, aujourdhuiIso: string, limite: number): Promise<InstanceVue[]> {
  const lignes = await db.getAll<Ligne>(
    `SELECT * FROM instances_seance
     WHERE deleted_at IS NULL AND is_completed = 0 AND date >= ? ORDER BY date, id LIMIT ?`,
    [aujourdhuiIso, limite],
  )
  return Promise.all(lignes.map((l) => instanceEnVue(db, l)))
}

// Déplace UNE instance. Une instance terminée ne se déplace pas : sa date ancre les statistiques.
// Les contrôles précèdent l'écriture (rien n'est écrit en cas d'erreur).
export async function deplacerInstance(db: Db, instanceId: string, dateIso: string): Promise<void> {
  if (!dateIsoValide(dateIso)) throw new ErreurCalendrier('Date invalide : choisissez une date réelle au format jj/mm/aaaa.')
  await db.writeTransaction(async (tx) => {
    const l = await tx.getOptional<{ is_completed: number | null }>(
      'SELECT is_completed FROM instances_seance WHERE id = ? AND deleted_at IS NULL',
      [instanceId],
    )
    if (!l) throw new ErreurCalendrier('Séance introuvable.')
    if (l.is_completed === 1) throw new ErreurCalendrier("Une séance terminée ne peut pas être déplacée : sa date sert aux statistiques.")
    await tx.execute('UPDATE instances_seance SET date = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [
      dateIso, new Date().toISOString(), instanceId,
    ])
  })
}

// Marque supprimées (tombstone synchronisable) les lignes vivantes de `table` rattachées à l'instance.
async function tombstone(tx: DbTx, table: string, colonne: string, instanceId: string, maintenant: string) {
  await tx.execute(
    `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE ${colonne} = ? AND deleted_at IS NULL`,
    [maintenant, maintenant, instanceId],
  )
}

// Suppression logique d'une instance (planifiée, en cours ou terminée) avec ses lignes copiées et ses séries,
// en UNE transaction. Jamais de DELETE ; modèle de séance et autres instances ne sont pas touchés.
export async function supprimerInstance(db: Db, instanceId: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const vivante = await tx.getOptional<{ id: string }>('SELECT id FROM instances_seance WHERE id = ? AND deleted_at IS NULL', [instanceId])
    if (!vivante) throw new ErreurCalendrier('Séance introuvable.')
    const maintenant = new Date().toISOString()
    await tombstone(tx, 'series_realisees', 'instance_seance_id', instanceId, maintenant)
    await tombstone(tx, 'blocs_seance', 'instance_seance_id', instanceId, maintenant)
    await tombstone(tx, 'exercices_seance', 'instance_seance_id', instanceId, maintenant)
    await tombstone(tx, 'instances_seance', 'id', instanceId, maintenant)
  })
}

// ── Agenda à trois sources : renforcement, course, vélo ──
// L'écran ne voit que des EvenementAgenda. Chaque source garde ses règles : le renforcement ne change pas, le cardio
// passe par le module d'accès aux données (core/db/repos/seancesCardio.ts), dont les erreurs deviennent des erreurs d'écran.

const GENRES_CARDIO: readonly GenreCardio[] = ['course', 'velo']

// Les refus du module cardio (validation, séance introuvable ou validée) ont déjà un message en français :
// ils sont rendus tels quels à l'écran, comme les erreurs du renforcement.
async function enErreurCalendrier<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (e) {
    if (e instanceof ErreurSeanceCardio) throw new ErreurCalendrier(e.message)
    throw e
  }
}

// Tous les événements dont la date est dans [debutIso, finIso], triés (jour, genre, identifiant).
export async function lireEvenementsPlage(db: DbLecture, debutIso: string, finIso: string): Promise<EvenementAgenda[]> {
  const [instances, ...cardios] = await Promise.all([
    lireInstancesPlage(db, debutIso, finIso),
    ...GENRES_CARDIO.map((genre) => lirePlageCardio(db, genre, debutIso, finIso)),
  ])
  return trierEvenements([...instances.map(depuisInstance), ...cardios.flat().map(depuisCardio)])
}

// Prochains événements non terminés : chaque source renvoie ses `limite` premiers (un seul LIMIT sur la somme serait faux),
// puis la fusion est triée et limitée. Renforcement : planifiés ou en cours ; cardio : non validés.
export async function lireEvenementsProchains(db: DbLecture, aujourdhuiIso: string, limite: number): Promise<EvenementAgenda[]> {
  const [instances, ...cardios] = await Promise.all([
    lireProchaines(db, aujourdhuiIso, limite),
    ...GENRES_CARDIO.map((genre) => lireProchainesCardio(db, genre, aujourdhuiIso, limite)),
  ])
  return trierEvenements([...instances.map(depuisInstance), ...cardios.flat().map(depuisCardio)]).slice(0, limite)
}

// Déplace un événement. La règle de la vue (peutDeplacer) est vérifiée d'abord ; l'état est relu à l'écriture par chaque
// source, donc une validation reçue par synchronisation entre l'affichage et le déplacement est détectée.
export async function deplacerEvenement(db: Db, evenement: EvenementAgenda, dateIso: string): Promise<void> {
  if (!peutDeplacer(evenement)) throw new ErreurCalendrier(messageRefusDeplacement(evenement))
  switch (evenement.genre) {
    case 'renfo':
      return deplacerInstance(db, evenement.id, dateIso)
    case 'course':
    case 'velo':
      return enErreurCalendrier(() => deplacerCardio(db, evenement.genre, evenement.id, dateIso))
    default:
      return exhaustif(evenement)
  }
}

// Suppression logique d'un événement (une séance de cardio validée peut être supprimée).
export async function supprimerEvenement(db: Db, evenement: EvenementAgenda): Promise<void> {
  switch (evenement.genre) {
    case 'renfo':
      return supprimerInstance(db, evenement.id)
    case 'course':
    case 'velo':
      return enErreurCalendrier(() => supprimerCardio(db, evenement.genre, evenement.id))
    default:
      return exhaustif(evenement)
  }
}

// Valide ou dévalide une séance de cardio. Une instance de renforcement se termine en exécutant la séance.
export async function validerEvenement(db: Db, evenement: EvenementAgenda, validee: boolean): Promise<void> {
  switch (evenement.genre) {
    case 'renfo':
      throw new ErreurCalendrier('Une séance de renforcement se termine en exécutant la séance.')
    case 'course':
    case 'velo':
      return enErreurCalendrier(() => definirValidationCardio(db, evenement.genre, evenement.id, validee))
    default:
      return exhaustif(evenement)
  }
}

// Crée une séance de cardio ; renvoie son identifiant.
export function creerSeanceCardio(db: Db, genre: GenreCardio, saisie: SaisieSeanceCardio): Promise<string> {
  return enErreurCalendrier(() => creerCardio(db, genre, saisie))
}

// Modifie les champs d'une séance de cardio (la date et l'état validé ont leurs propres actions).
export async function modifierSeanceCardio(db: Db, evenement: EvenementAgenda, champs: ChampsSeanceCardio): Promise<void> {
  switch (evenement.genre) {
    case 'renfo':
      throw new ErreurCalendrier('Une séance de renforcement se modifie depuis ses séances.')
    case 'course':
    case 'velo':
      return enErreurCalendrier(() => modifierCardio(db, evenement.genre, evenement.id, champs))
    default:
      return exhaustif(evenement)
  }
}
