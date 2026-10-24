// Horloge de la séance en cours, pure : le temps écoulé est TOUJOURS recalculé depuis des
// horodatages stockés (instances_seance.started_at / paused_json), jamais incrémenté en mémoire.
// Ainsi un rechargement de la page, un onglet en arrière-plan ou une mise en veille ne perdent rien.

export type Pause = { fromMs: number; toMs: number | null }
export type SessionClock = { startedAtMs: number | null; pauses: Pause[] }

// Forme stockée en base (colonnes de instances_seance).
export type LigneHorloge = { started_at: string | null; paused_json: string | null }

// Temps actif en ms : (maintenant - démarrage) moins les pauses (fusionnées si elles se chevauchent),
// une pause ouverte comptant jusqu'à maintenant. Bornes : chaque pause est ramenée dans
// [démarrage, maintenant] ; jamais négatif, même si l'horloge système a reculé.
export function elapsedMs(clock: SessionClock, nowMs: number): number {
  const debut = clock.startedAtMs
  if (debut === null || nowMs <= debut) return 0
  const intervalles = clock.pauses
    .map((p) => {
      const de = Math.min(Math.max(p.fromMs, debut), nowMs)
      const a = Math.min(Math.max(p.toMs ?? nowMs, de), nowMs)
      return [de, a] as const
    })
    .filter(([de, a]) => a > de)
    .sort((x, y) => x[0] - y[0])

  let enPause = 0
  let finCourante = -Infinity
  let debutCourant = -Infinity
  for (const [de, a] of intervalles) {
    if (de > finCourante) {
      if (finCourante > debutCourant) enPause += finCourante - debutCourant
      debutCourant = de
      finCourante = a
    } else {
      finCourante = Math.max(finCourante, a)
    }
  }
  if (finCourante > debutCourant) enPause += finCourante - debutCourant
  return Math.max(0, nowMs - debut - enPause)
}

// Vrai si une pause est en cours (dernière pause sans fin).
export function estEnPause(clock: SessionClock): boolean {
  return clock.pauses.some((p) => p.toMs === null)
}

const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// Relit le JSON des pauses : JSON malformé ou non-tableau => aucune pause ; éléments invalides écartés.
function lirePauses(json: string | null): Pause[] {
  if (!json) return []
  let brut: unknown
  try {
    brut = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(brut)) return []
  return brut.flatMap((e: unknown): Pause[] => {
    if (typeof e !== 'object' || e === null) return []
    const { fromMs, toMs } = e as Record<string, unknown>
    if (!estNombre(fromMs)) return []
    if (toMs !== null && !estNombre(toMs)) return []
    return [{ fromMs, toMs }]
  })
}

export function clockFromRow(ligne: LigneHorloge): SessionClock {
  const ms = ligne.started_at === null ? Number.NaN : Date.parse(ligne.started_at)
  return { startedAtMs: Number.isFinite(ms) ? ms : null, pauses: lirePauses(ligne.paused_json) }
}

export function clockToRow(clock: SessionClock): { started_at: string | null; paused_json: string } {
  return {
    started_at: clock.startedAtMs === null ? null : new Date(clock.startedAtMs).toISOString(),
    paused_json: JSON.stringify(clock.pauses.map((p) => ({ fromMs: p.fromMs, toMs: p.toMs }))),
  }
}
