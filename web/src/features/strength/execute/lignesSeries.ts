import type { ExerciceVue, Mesures } from './vue'

// Tableau de séries façon Android : une ligne par série PRÉVUE, pré-remplie avec le prévu. Fonctions pures.

// Série d'une séance précédente du même exercice (pré-remplissage « comme la dernière fois »)
export interface SerieHisto {
  numero: number
  reps: number | null
  chargeKg: number | null
}

export interface LigneSerie {
  // Rang de la série (1..N) ; pour un bilatéral, un rang par côté (impair G, pair D)
  numero: number
  // « 3 » ou, en bilatéral, « 2G » / « 2D »
  libelle: string
  // « G », « D » ou vide
  cote: string
  terminee: boolean
  // Série enregistrée en base (validée ou laissée non validée par Android), sinon null
  serieId: string | null
  reps: number | null
  chargeKg: number | null
  rpe: number | null
  // Reps et charge viennent du prévu / de l'historique et non d'une saisie : affichés grisés
  preRemplie: boolean
  // Repos affiché (s), 0 si aucun
  reposSec: number
}

// Premier nombre d'un texte de cible : « 8 » → 8, « 8-10 » → 8, « 45s » → 45, « 17,5 kg » → 17.5, « PDC » → null.
export function premierNombre(texte: string): number | null {
  const m = /\d+(?:[.,]\d+)?/.exec(texte)
  return m ? Number(m[0].replace(',', '.')) : null
}

// RPE proposé hors échauffement / activation / récupération et hors exercice en durée.
export function rpeApplicable(blocType: string | null, repsType: string): boolean {
  const sansRpe = blocType === 'ECHAUFFEMENT' || blocType === 'ACTIVATION' || blocType === 'RECUPERATION'
  return !sansRpe && repsType !== 'DURATION'
}

const multiplicateur = (e: Pick<ExerciceVue, 'isBilateral'>) => (e.isBilateral ? 2 : 1)

// Nombre de lignes : séries prévues (× 2 si bilatéral), plus les séries enregistrées au-delà.
export function nombreLignes(e: Pick<ExerciceVue, 'isBilateral' | 'nombreSeriesPrevues' | 'series'>): number {
  const maxEnBase = e.series.reduce((m, s) => Math.max(m, s.numero), 0)
  return Math.max(e.nombreSeriesPrevues * multiplicateur(e), maxEnBase)
}

export function construireLignes(e: ExerciceVue, historique: SerieHisto[] = []): LigneSerie[] {
  const enBase = new Map(e.series.map((s) => [s.numero, s]))
  const repsPrevu = premierNombre(e.repsCibles)
  const chargePrevue = premierNombre(e.chargeCible)
  const lignes: LigneSerie[] = []
  for (let numero = 1; numero <= nombreLignes(e); numero++) {
    const cote = e.isBilateral ? (numero % 2 === 1 ? 'G' : 'D') : ''
    const base = { numero, cote, libelle: e.isBilateral ? `${Math.ceil(numero / 2)}${cote}` : String(numero), reposSec: e.reposAfficheSec }
    const s = enBase.get(numero)
    if (s) {
      lignes.push({ ...base, terminee: s.terminee, serieId: s.id, reps: s.reps, chargeKg: s.chargeKg, rpe: s.rpe, preRemplie: false })
      continue
    }
    const histo = historique.find((h) => h.numero === numero)
    // La charge d'une série déjà faite se propage aux suivantes (comme Android) ; sinon cible si progression
    // activée, historique, cible.
    const precedente = [...lignes].reverse().find((l) => l.terminee && l.chargeKg !== null)
    const charge = precedente
      ? precedente.chargeKg
      : e.progressionActivee ? chargePrevue : (histo?.chargeKg ?? chargePrevue)
    lignes.push({
      ...base,
      terminee: false,
      serieId: null,
      reps: e.progressionActivee ? repsPrevu : (histo?.reps ?? repsPrevu),
      chargeKg: charge,
      rpe: null,
      preRemplie: true,
    })
  }
  return lignes
}

// Série courante : première non validée.
export function numeroCourant(lignes: LigneSerie[]): number | null {
  return lignes.find((l) => !l.terminee)?.numero ?? null
}

export interface Brouillon {
  reps?: number | null
  chargeKg?: number | null
  rpe?: number | null
  // Repos saisi pour cette ligne (s) ; absent ou vide : repos prévu
  repos?: number | null
}

// Repos d'une ligne : la saisie (arrondie à la seconde, jamais négative) remplace le prévu ; vide ou illisible : prévu.
// `override` est la durée à imposer au repos qui suit la validation (null : celle de l'exercice).
export function reposLigne(l: Pick<LigneSerie, 'reposSec'>, b: Brouillon | undefined): { sec: number; saisi: boolean; override: number | null } {
  const v = b?.repos
  if (v === undefined || v === null || !Number.isFinite(v)) return { sec: l.reposSec, saisi: false, override: null }
  const sec = Math.max(0, Math.round(v))
  return { sec, saisi: true, override: sec }
}

// Charge saisie sur la ligne `numero` : elle se répercute sur les lignes SUIVANTES non validées (applyBuffer Android).
// Une charge vidée ne se propage pas.
export function propagerCharge(lignes: LigneSerie[], numero: number, chargeKg: number | null): { numero: number; chargeKg: number }[] {
  if (chargeKg === null || !Number.isFinite(chargeKg)) return []
  return lignes.filter((l) => l.numero > numero && !l.terminee).map((l) => ({ numero: l.numero, chargeKg }))
}

// Valeurs d'une ligne : la saisie en cours prime sur le prévu. Un champ reps vide donne NaN (refusé
// par la validation avec un message français).
export function valeursLigne(l: LigneSerie, b: Brouillon | undefined): { reps: number | null; chargeKg: number | null; rpe: number | null; repsSaisies: boolean; chargeSaisie: boolean } {
  return {
    reps: b?.reps !== undefined ? b.reps : l.reps,
    chargeKg: b?.chargeKg !== undefined ? b.chargeKg : l.chargeKg,
    rpe: b?.rpe !== undefined ? b.rpe : l.rpe,
    repsSaisies: b?.reps !== undefined || !l.preRemplie,
    chargeSaisie: b?.chargeKg !== undefined || !l.preRemplie,
  }
}

export function mesuresLigne(l: LigneSerie, b: Brouillon | undefined): Mesures {
  const v = valeursLigne(l, b)
  return { reps: v.reps ?? Number.NaN, chargeKg: v.chargeKg, rpe: v.rpe }
}

// Texte de la colonne « Repos » : « 90s », vide si 0.
export const texteRepos = (sec: number): string => (sec > 0 ? `${sec}s` : '')

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

// Ligne de l'historique d'un exercice : « 24 oct. — 8 reps @ 60 kg » (durée : « 45 s »).
export function texteHistorique(p: { dateIso: string; maxChargeKg: number; reps: number; enSecondes: boolean }): string {
  const [, m, j] = p.dateIso.split('-')
  const date = `${Number(j)} ${MOIS[Number(m) - 1] ?? m}`
  const effort = p.enSecondes ? `${p.reps} s` : `${p.reps} reps`
  const charge = p.maxChargeKg > 0 ? ` @ ${String(p.maxChargeKg).replace('.', ',')} kg` : ''
  return `${date} — ${effort}${charge}`
}
