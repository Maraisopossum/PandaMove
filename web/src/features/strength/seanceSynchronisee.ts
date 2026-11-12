import type { Db } from '../../core/db/Db'
import { aSesLignes, getInstance } from '../../core/db/repos/instances'
import { attendrePremiereSynchro } from '../../core/sync/premiereSynchro'

// Sur un appareil neuf, un lien direct vers une séance peut s'ouvrir avant la fin de la première synchronisation :
// l'instance (ou ses lignes) n'est pas encore en base locale. Tant qu'elle n'est pas complète, on attend la fin de
// cette synchronisation avant de lire la séance, et surtout avant de copier le modèle : une copie faite trop tôt
// écraserait, à l'envoi, les blocs et exercices de la séance jouée sur l'autre appareil.
// Une séance déjà complète en local s'ouvre sans attendre (hors ligne compris).
export async function attendreSeanceSynchronisee(base: Db, instanceId: string, signal?: AbortSignal): Promise<void> {
  const instance = await getInstance(base, instanceId)
  if (instance && (await aSesLignes(base, instanceId))) return
  await attendrePremiereSynchro(base, signal)
}
