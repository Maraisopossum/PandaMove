// Mise en forme de l'écran Respiration : durées et dates de l'historique, messages du panda.

/** « 1 min 05 », « 45 s » ; « — » si la durée est nulle. */
export function formaterDuree(secondes: number): string {
  if (secondes <= 0) return '—'
  const m = Math.floor(secondes / 60)
  const s = secondes % 60
  return m > 0 ? `${m} min ${String(s).padStart(2, '0')}` : `${s} s`
}

/** « 4 nov. 2026 » depuis un jour yyyy-MM-dd (sans passer par un fuseau : le jour affiché est celui enregistré). */
export function formaterDateHistorique(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export const MESSAGES_PANDA = [
  'Le panda sait que le calme se cultive, pas à pas.',
  "Chaque souffle compte. Tu viens d'en prouver quelques-uns.",
  'Le panda est fier. Et un peu jaloux de ton calme.',
  'Respirer bien, c’est vivre mieux. Le panda valide.',
  'Séance accomplie. Le bambou peut attendre.',
  'Ton souffle est ta force. Le panda le sait depuis toujours.',
] as const

export const messagePandaAuHasard = (hasard: () => number = Math.random): string =>
  MESSAGES_PANDA[Math.min(MESSAGES_PANDA.length - 1, Math.floor(hasard() * MESSAGES_PANDA.length))]
