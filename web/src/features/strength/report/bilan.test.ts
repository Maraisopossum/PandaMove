import { describe, expect, it } from 'vitest'
import type { SerieRealisee } from '../../../core/db/types'
import type { PropositionProgression } from '../../../core/progression/engine'
import {
  phrasesRecalcul,
  compterSeries, conseilCharge, formaterDateLongue, formaterDureeBilan, formaterRpe, formaterTonnage, libelleCible, ligneSerie,
  messageEnregistrement, resumerSeance, sousTitreRecap, texteProposition, texteStatut, titreBloc,
} from './bilan'

const serie = (champs: Partial<SerieRealisee>): SerieRealisee => ({
  id: 's', instanceSeanceId: 'i1', exerciceSeanceId: 'e1', numeroSerie: 1, repsRealisees: 10, chargeKg: 60,
  chargeLabel: null, rpe: null, notes: '', isCompleted: true, updatedAt: 'u', validatedAt: null, ...champs,
})

const proposition = (champs: Partial<PropositionProgression> = {}): PropositionProgression => ({
  statut: 'SUCCES', nouvelleChargeCible: 62.5, nouveauRepsCible: 8, nouvelleDureeCible: null, nouveauCompteurEchec: 0,
  deload: false, nouveauNombreSeries: null, ...champs,
})

describe('resumerSeance', () => {
  it('tonnage = Σ reps × charge des séries terminées hors DURATION ; séries = toutes les séries terminées', () => {
    const exercices = [
      { id: 'e1', repsType: 'REPS' as const },
      { id: 'e2', repsType: 'DURATION' as const },
    ]
    const series = [
      serie({ id: 'a', exerciceSeanceId: 'e1', repsRealisees: 10, chargeKg: 60 }),
      serie({ id: 'b', exerciceSeanceId: 'e1', numeroSerie: 2, repsRealisees: 8, chargeKg: 62.5 }),
      serie({ id: 'c', exerciceSeanceId: 'e1', numeroSerie: 3, repsRealisees: 5, chargeKg: 60, isCompleted: false }),
      // DURATION : 60 s lestées de 10 kg ne comptent pas dans le tonnage
      serie({ id: 'd', exerciceSeanceId: 'e2', repsRealisees: 60, chargeKg: 10 }),
      serie({ id: 'e', exerciceSeanceId: 'e1', numeroSerie: 4, repsRealisees: 12, chargeKg: null }),
    ]
    expect(resumerSeance(exercices, series, 2730)).toEqual({ tonnageKg: 1100, seriesTotal: 4, dureeSec: 2730 })
  })
})

describe('formats', () => {
  it('durée comme l’Android : mm:ss, h:mm:ss au-delà d’une heure, tiret si nulle', () => {
    expect(formaterDureeBilan(2730)).toBe('45:30')
    expect(formaterDureeBilan(0)).toBe('—')
    expect(formaterDureeBilan(3900)).toBe('1:05:00')
    expect(formaterDureeBilan(4530)).toBe('1:15:30')
  })

  it('date longue en français, initiale en majuscule', () => {
    expect(formaterDateLongue('2026-10-24')).toBe('Samedi 24 octobre 2026')
    expect(formaterDateLongue('2024-05-13')).toBe('Lundi 13 mai 2024')
    expect(formaterDateLongue('pas une date')).toBe('')
  })

  it('RPE : entier ou une décimale à virgule, tiret si absent', () => {
    expect(formaterRpe(8)).toBe('8')
    expect(formaterRpe(8.5)).toBe('8,5')
    expect(formaterRpe(null)).toBe('—')
  })

  it('tonnage : kg sous une tonne, t au-delà', () => {
    expect(formaterTonnage(1100)).toBe('1,1 t')
    expect(formaterTonnage(487.5)).toBe('488 kg')
  })
})

describe('texteProposition', () => {
  it('formate charge et reps à la française', () => {
    expect(texteProposition(proposition({ nouvelleChargeCible: 17.69999885559082, nouveauRepsCible: 8 }))).toBe('Proposer 8 reps à 17,7 kg')
    expect(texteProposition(proposition({ nouveauRepsCible: null, nouvelleChargeCible: 45 }))).toBe('Proposer 45 kg')
    expect(texteProposition(proposition({ nouvelleChargeCible: null, nouveauRepsCible: 9 }))).toBe('Proposer 9 reps')
    expect(texteProposition(proposition({ nouvelleDureeCible: 50 }))).toBe('Proposer 50 s')
    expect(texteProposition(proposition({ nouveauNombreSeries: 4, nouveauRepsCible: 8 }))).toBe('Proposer +1 série (4) — reps remis à 8')
  })
})

describe('ligneSerie (ReportSerieRow Android)', () => {
  it('charge : libellé, sinon kg, sinon PDC ; reps : tiret si absent, secondes pour DURATION', () => {
    expect(ligneSerie(serie({ numeroSerie: 2, repsRealisees: 8, chargeKg: 62.5, rpe: 8.5 }), 'REPS')).toEqual({
      numero: '2', libelle: 'Série 2', reps: '8', charge: '62,5 kg', rpe: '8,5', realisee: true,
    })
    expect(ligneSerie(serie({ repsRealisees: 12, chargeKg: null }), 'REPS').charge).toBe('PDC')
    expect(ligneSerie(serie({ chargeKg: 10, chargeLabel: 'Élastique', repsRealisees: null }), 'REPS')).toMatchObject({ charge: 'Élastique', reps: '—' })
    expect(ligneSerie(serie({ repsRealisees: 45, chargeKg: null }), 'DURATION').reps).toBe('45 s')
  })

  it('côté G / D : numéro de la série réelle suivi du côté ; série non validée signalée', () => {
    expect(ligneSerie(serie({ numeroSerie: 3, notes: 'G' }), 'REPS')).toMatchObject({ numero: '2G', libelle: 'Série 2 G' })
    expect(ligneSerie(serie({ numeroSerie: 4, notes: 'D' }), 'REPS')).toMatchObject({ numero: '2D' })
    expect(ligneSerie(serie({ isCompleted: false }), 'REPS').realisee).toBe(false)
  })
})

describe('compterSeries / libelleCible / conseilCharge', () => {
  it('séries réalisées sur prévues (jamais moins que les lignes saisies)', () => {
    expect(compterSeries([{ seriesPrevues: 3, seriesRealisees: 3, seriesSaisies: 3 }, { seriesPrevues: 2, seriesRealisees: 1, seriesSaisies: 1 }])).toEqual({ realisees: 4, prevues: 5 })
    // 4 séries faites alors que 3 étaient prévues : le total ne descend pas sous ce qui a été fait
    expect(compterSeries([{ seriesPrevues: 3, seriesRealisees: 4, seriesSaisies: 4 }])).toEqual({ realisees: 4, prevues: 4 })
  })

  it('cible lisible : séries × reps ou secondes, charge si connue', () => {
    expect(libelleCible({ nombreSeriesPrevues: 3, repsCibles: '8-10', chargeCible: '50 kg', repsType: 'REPS' })).toBe('3 × 8-10 reps à 50 kg')
    expect(libelleCible({ nombreSeriesPrevues: 2, repsCibles: '45', chargeCible: '', repsType: 'DURATION' })).toBe('2 × 45 s')
    expect(libelleCible({ nombreSeriesPrevues: 3, repsCibles: '', chargeCible: '', repsType: 'REPS' })).toBe('3 séries')
  })

  it('charge non composable : la plus proche, sinon rien', () => {
    expect(conseilCharge([40, 42.5, 45], 43)).toBe(42.5)
    expect(conseilCharge([40, 42.5, 45], 45)).toBeNull()
    expect(conseilCharge([], 43)).toBeNull()
    expect(conseilCharge([40], null)).toBeNull()
  })
})

describe('texteStatut (messages du récap)', () => {
  it('un message français pour chaque cas', () => {
    expect(texteStatut(proposition({ deload: true }))).toBe('Deload proposé : réduction de 10 % après échecs répétés. Vous pouvez le refuser ou choisir votre charge.')
    expect(texteStatut(proposition({ statut: 'SUCCES' }))).toContain('progression proposée')
    expect(texteStatut(proposition({ statut: 'SUCCES_SANS_MARGE' }))).toContain('RPE élevé')
    expect(texteStatut(proposition({ statut: 'ECHEC', nouveauCompteurEchec: 2 }))).toContain('échec n° 2')
    expect(texteStatut(proposition({ statut: 'NON_LOGGE' }))).toContain('Non loggé')
  })
})

describe('titreBloc', () => {
  it('superset et circuit : nom + repos entre exercices et de fin de tour', () => {
    expect(titreBloc('SUPERSET', 'Pecs', 20, 90)).toBe('Superset — Pecs · repos entre exercices 20 s, fin de tour 1 min 30 s')
    expect(titreBloc('CIRCUIT', 'Finisher', 0, 120)).toBe('Circuit — Finisher · repos entre exercices —, fin de tour 2 min')
  })

  it('échauffement, activation, récupération : type + nom, sans repos ; bloc inconnu : nom seul', () => {
    expect(titreBloc('ECHAUFFEMENT', 'Mobilité', 20, 90)).toBe('Échauffement — Mobilité')
    expect(titreBloc('RECUPERATION', '', 0, 0)).toBe('Récupération')
    expect(titreBloc('AUTRE', 'Bonus', 0, 0)).toBe('Bonus')
  })
})

describe('annonces du récap', () => {
  it('sous-titre et message d’enregistrement, au singulier et au pluriel', () => {
    expect(sousTitreRecap(0)).toBe('')
    expect(sousTitreRecap(1)).toBe('1 exercice prêt à progresser')
    expect(sousTitreRecap(3)).toBe('3 exercices prêts à progresser')
    expect(messageEnregistrement(1)).toBe('Progression enregistrée pour 1 exercice.')
    expect(messageEnregistrement(2)).toBe('Progression enregistrée pour 2 exercices.')
  })
})

describe('phrasesRecalcul', () => {
  it('une phrase par exercice, selon l’effet', () => {
    expect(
      phrasesRecalcul([
        { exerciceId: 'a', nom: 'Squat', effet: 'recalculee' },
        { exerciceId: 'b', nom: 'Rowing', effet: 'a_redecider' },
        { exerciceId: 'c', nom: 'Tractions', effet: 'objectif_deja_evolue' },
      ]),
    ).toEqual([
      'Squat : progression recalculée après votre correction.',
      'Rowing : nouvelle proposition à valider après votre correction.',
      'Tractions : objectif déjà modifié par une séance plus récente, il n’est pas changé.',
    ])
    expect(phrasesRecalcul([])).toEqual([])
  })
})
