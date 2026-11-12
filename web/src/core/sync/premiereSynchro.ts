import type { Db } from '../db/Db'

// Base capable d'annoncer la fin de sa première synchronisation (PowerSyncDatabase). Les bases de test
// (SQLite en mémoire) n'ont pas cette méthode : elles sont considérées comme déjà synchronisées.
interface AvecPremiereSynchro {
  waitForFirstSync(signal?: AbortSignal): Promise<void>
}

const avecPremiereSynchro = (base: object): base is AvecPremiereSynchro =>
  typeof (base as Partial<AvecPremiereSynchro>).waitForFirstSync === 'function'

/** Se résout quand la première synchronisation de l'appareil est terminée (tout de suite si c'est déjà le cas). */
export async function attendrePremiereSynchro(base: Db, signal?: AbortSignal): Promise<void> {
  if (avecPremiereSynchro(base)) await base.waitForFirstSync(signal)
}
