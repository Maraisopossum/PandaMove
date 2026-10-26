import { formaterCharge } from '../../../core/common/formaterCharge'
import type { ExerciceSeance, RepsType, SerieRealisee } from '../../../core/db/types'
import { chargeLisible } from '../../../core/progression/chargeLisible'
import type { PropositionProgression } from '../../../core/progression/engine'
import { LIBELLES_BLOC } from '../draft'
import { chargeNonComposableHint } from '../../../core/progression/inventory'

// Fonctions pures d'affichage du bilan de séance et du récap de progression (miroir
// d'InstanceReportScreen / ProgressionRecapDialog Android). L'évaluation elle-même vit dans
// ../progression (partagée avec la fin de séance).

export interface ResumeSeance {
  tonnageKg: number
  seriesTotal: number
  dureeSec: number
}

// Tonnage = Σ reps × charge des séries TERMINÉES ; une série DURATION contient des secondes, pas des
// répétitions : elle compte pour 0 (KNOWN_BUGS « tonnage renforcement »). Séries = toutes les séries
// terminées (tous types) des exercices de l'instance.
export function resumerSeance(
  exercices: Pick<ExerciceSeance, 'id' | 'repsType'>[],
  series: SerieRealisee[],
  dureeSec: number,
): ResumeSeance {
  const types = new Map(exercices.map((e) => [e.id, e.repsType]))
  let tonnageKg = 0
  let seriesTotal = 0
  for (const s of series) {
    const type = types.get(s.exerciceSeanceId)
    if (type === undefined || !s.isCompleted) continue
    seriesTotal++
    if (type !== 'DURATION' && s.repsRealisees !== null && s.chargeKg !== null) tonnageKg += s.repsRealisees * s.chargeKg
  }
  // Arrondi à 0,01 kg : absorbe le bruit des sommes décimales (0,1 + 0,2)
  return { tonnageKg: Number(tonnageKg.toFixed(2)), seriesTotal, dureeSec }
}

// ── Textes (strings.xml progression_recap_*) ──

const kg = (c: number) => `${formaterCharge(chargeLisible(c))} kg`

/** Libellé de la proposition, même priorité que ProgressionRecapDialog Android. */
export function texteProposition(p: PropositionProgression): string {
  if (p.nouveauNombreSeries !== null) return `Proposer +1 série (${p.nouveauNombreSeries}) — reps remis à ${p.nouveauRepsCible ?? 0}`
  if (p.nouvelleDureeCible !== null) return `Proposer ${p.nouvelleDureeCible} s`
  if (p.nouveauRepsCible !== null && p.nouvelleChargeCible !== null) return `Proposer ${p.nouveauRepsCible} reps à ${kg(p.nouvelleChargeCible)}`
  if (p.nouvelleChargeCible !== null) return `Proposer ${kg(p.nouvelleChargeCible)}`
  if (p.nouveauRepsCible !== null) return `Proposer ${p.nouveauRepsCible} reps`
  return ''
}

/** Explication du statut en langage courant. */
export function texteStatut(p: PropositionProgression): string {
  if (p.deload) return 'Deload proposé : réduction de 10 % après échecs répétés. Vous pouvez le refuser ou choisir votre charge.'
  switch (p.statut) {
    case 'SUCCES':
      return 'Cible atteinte sur toutes les séries : progression proposée.'
    case 'SUCCES_SANS_MARGE':
      return 'Cible atteinte mais RPE élevé — pas de marge, cible maintenue.'
    case 'ECHEC':
    case 'ECHEC_MARQUE':
      return `Cible manquée : cible maintenue (échec n° ${p.nouveauCompteurEchec}).`
    case 'NON_LOGGE':
      return 'Non loggé — aucune série enregistrée cette fois-ci.'
  }
}

/** Durée affichée comme l'Android : mm:ss, h:mm:ss au-delà d'une heure, tiret si elle est nulle. */
export function formaterDureeBilan(dureeSec: number): string {
  const total = Math.max(0, Math.round(dureeSec))
  if (total === 0) return '—'
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const deux = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${deux(m)}:${deux(s)}` : `${deux(m)}:${deux(s)}`
}

/** Tonnage affiché : kg sous une tonne, t au-delà (comme InstanceReportScreen Android). */
export function formaterTonnage(tonnageKg: number): string {
  if (tonnageKg >= 1000) return `${(tonnageKg / 1000).toFixed(1).replace('.', ',')} t`
  return `${Math.round(tonnageKg)} kg`
}

/** Date « yyyy-MM-dd » en français (« Samedi 24 octobre 2026 ») ; vide si elle est illisible. */
export function formaterDateLongue(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return ''
  const texte = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  return texte.charAt(0).toUpperCase() + texte.slice(1)
}

/** RPE : « 8 » ou « 8,5 », tiret si absent. */
export function formaterRpe(rpe: number | null): string {
  if (rpe === null) return '—'
  return String(Number(rpe.toFixed(1))).replace('.', ',')
}

// ── Tableau des séries (ReportSerieRow Android) ──

export interface LigneSerie {
  /** Colonne « # » : numéro de la série réelle, suivi du côté (G / D) d'un exercice bilatéral */
  numero: string
  /** Libellé complet, pour la lecture d'écran et l'export */
  libelle: string
  reps: string
  charge: string
  rpe: string
  /** false : ligne laissée « non validée » (barrée, comme sur Android) */
  realisee: boolean
}

/** Une ligne du rapport. DURATION : la valeur est en secondes (jamais présentée comme des répétitions). */
export function ligneSerie(s: SerieRealisee, repsType: RepsType): LigneSerie {
  const cote = s.notes.trim()
  // Un exercice bilatéral écrit deux lignes (G puis D) par série : (n + 1) / 2 en division entière
  const rang = cote === '' ? String(s.numeroSerie) : String(Math.floor((s.numeroSerie + 1) / 2))
  const reps = s.repsRealisees === null ? '—' : repsType === 'DURATION' ? `${s.repsRealisees} s` : String(s.repsRealisees)
  const charge = s.chargeLabel ?? (s.chargeKg === null ? 'PDC' : `${formaterCharge(s.chargeKg)} kg`)
  return {
    numero: cote === '' ? rang : `${rang}${cote}`,
    libelle: cote === '' ? `Série ${rang}` : `Série ${rang} ${cote}`,
    reps,
    charge,
    rpe: formaterRpe(s.rpe),
    realisee: s.isCompleted,
  }
}

/** Séries réalisées / prévues de la séance ; le total prévu ne descend jamais sous les lignes saisies. */
export function compterSeries(exercices: { seriesPrevues: number; seriesRealisees: number; seriesSaisies: number }[]) {
  let realisees = 0
  let prevues = 0
  for (const e of exercices) {
    realisees += e.seriesRealisees
    prevues += Math.max(e.seriesPrevues, e.seriesSaisies)
  }
  return { realisees, prevues }
}

/** Cible du modèle en une ligne : « 3 × 8-10 reps à 50 kg ». */
export function libelleCible(e: Pick<ExerciceSeance, 'nombreSeriesPrevues' | 'repsCibles' | 'chargeCible' | 'repsType'>): string {
  const reps = e.repsCibles.trim()
  if (reps === '') return `${e.nombreSeriesPrevues} séries`
  const charge = e.chargeCible.trim()
  const base = `${e.nombreSeriesPrevues} × ${reps}${e.repsType === 'DURATION' ? ' s' : ' reps'}`
  return e.repsType !== 'DURATION' && charge !== '' ? `${base} à ${charge}` : base
}

/** Charge composable la plus proche si celle saisie ne l'est pas avec « Mon matériel » ; null sinon. */
export function conseilCharge(chargesAtteignables: number[], chargeKg: number | null): number | null {
  if (chargeKg === null || !Number.isFinite(chargeKg)) return null
  return chargeNonComposableHint(chargesAtteignables, chargeKg)
}

const formaterRepos = (sec: number) => {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const r = sec % 60
  return m === 0 ? `${r} s` : r === 0 ? `${m} min` : `${m} min ${r} s`
}

/** Titre d'un groupe d'exercices : type du bloc + nom, et repos pour un superset / circuit (comme l'Android). */
export function titreBloc(type: string, nom: string, reposInterSec: number, reposFinTourSec: number): string {
  const libelle = (LIBELLES_BLOC as Record<string, string | undefined>)[type]
  if (libelle === undefined) return nom
  const base = nom.trim() === '' ? libelle : `${libelle} — ${nom}`
  if (type !== 'SUPERSET' && type !== 'CIRCUIT') return base
  return `${base} · repos entre exercices ${formaterRepos(reposInterSec)}, fin de tour ${formaterRepos(reposFinTourSec)}`
}

/** Sous-titre du récap : nombre d'exercices à décider. */
export function sousTitreRecap(n: number): string {
  if (n === 0) return ''
  return n === 1 ? '1 exercice prêt à progresser' : `${n} exercices prêts à progresser`
}

/** Annonce après « Valider ». */
export function messageEnregistrement(n: number): string {
  return n === 1 ? 'Progression enregistrée pour 1 exercice.' : `Progression enregistrée pour ${n} exercices.`
}

const PHRASES_RECALCUL = {
  recalculee: 'progression recalculée après votre correction.',
  a_redecider: 'nouvelle proposition à valider après votre correction.',
  objectif_deja_evolue: 'objectif déjà modifié par une séance plus récente, il n’est pas changé.',
} as const

/** Phrases du bandeau « progression recalculée » du rapport d'une séance corrigée. */
export function phrasesRecalcul(changements: { nom: string; effet: keyof typeof PHRASES_RECALCUL }[]): string[] {
  return changements.map((c) => `${c.nom} : ${PHRASES_RECALCUL[c.effet]}`)
}
