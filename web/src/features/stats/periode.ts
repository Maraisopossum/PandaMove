// Période des statistiques. Android (StatsViewModel.startDateFor) propose semaine / mois / 3 mois / an,
// recule depuis aujourd'hui (minusWeeks / minusMonths / minusYears, bornes incluses) et démarre sur le
// mois. Le web ajoute « Tout » et retient le choix dans localStorage (Android ne le persiste pas).

export type PeriodeId = '7j' | '30j' | '3m' | '12m' | 'tout'

export const PERIODES: { id: PeriodeId; libelle: string }[] = [
  { id: '7j', libelle: '7 jours' },
  { id: '30j', libelle: '30 jours' },
  { id: '3m', libelle: '3 mois' },
  { id: '12m', libelle: '12 mois' },
  { id: 'tout', libelle: 'Tout' },
]

export const PERIODE_DEFAUT: PeriodeId = '30j'
export const CLE_PERIODE = 'pandamove.stats.periode'

const deux = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${deux(m)}-${deux(d)}`
const joursDansMois = (y: number, m: number) => new Date(y, m, 0).getDate()

// Recul de `mois` mois en ramenant le jour au dernier jour du mois cible (comme java.time)
function reculerMois(y: number, m: number, d: number, mois: number): string {
  const total = y * 12 + (m - 1) - mois
  const ya = Math.floor(total / 12)
  const ma = (total % 12) + 1
  return iso(ya, ma, Math.min(d, joursDansMois(ya, ma)))
}

// Bornes `YYYY-MM-DD` incluses, calculées sur la date LOCALE de `maintenant`.
export function bornesPeriode(periode: PeriodeId, maintenant: Date): { from: string; to: string } {
  const y = maintenant.getFullYear()
  const m = maintenant.getMonth() + 1
  const d = maintenant.getDate()
  const to = iso(y, m, d)
  switch (periode) {
    case '7j': {
      const debut = new Date(y, m - 1, d - 7)
      return { from: iso(debut.getFullYear(), debut.getMonth() + 1, debut.getDate()), to }
    }
    case '30j':
      return { from: reculerMois(y, m, d, 1), to }
    case '3m':
      return { from: reculerMois(y, m, d, 3), to }
    case '12m':
      return { from: reculerMois(y, m, d, 12), to }
    case 'tout':
      return { from: '0001-01-01', to: '9999-12-31' }
  }
}

const estPeriode = (v: unknown): v is PeriodeId => PERIODES.some((p) => p.id === v)

// Lecture tolérante : stockage bloqué ou valeur inconnue -> période par défaut.
export function lirePeriode(): PeriodeId {
  try {
    const v = localStorage.getItem(CLE_PERIODE)
    return estPeriode(v) ? v : PERIODE_DEFAUT
  } catch {
    return PERIODE_DEFAUT
  }
}

export function ecrirePeriode(periode: PeriodeId): void {
  try {
    localStorage.setItem(CLE_PERIODE, periode)
  } catch {
    // Stockage indisponible (navigation privée, quota) : le choix vaut pour la session seulement
  }
}
