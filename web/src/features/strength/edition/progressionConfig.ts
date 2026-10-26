import type { TypeExercice } from '../../../core/db/types'
import type { EquipmentStocke } from '../../../core/import/equipment'
import { chargeLisible } from '../../../core/progression/chargeLisible'
import { proposerMontee } from '../../../core/progression/engine'
import { chargeNonComposableHint } from '../../../core/progression/inventory'
import type { ExerciceDraft } from '../draft'
import { chargesAtteignablesExercice, parseChargeKg, pasMaterielExercice } from '../progression/cible'
import { normaliserCharge } from './resume'

// Configuration de la surcharge progressive (miroir de ProgressionConfigSection.kt). Fonctions pures :
// les valeurs écrites ici sont celles que lit le moteur (core/progression/engine) à la fin de la séance.

export const SYSTEMES_PROGRESSION = [
  { valeur: 'LINEAIRE', libelle: 'Linéaire' },
  { valeur: 'DOUBLE', libelle: 'Double progression' },
  { valeur: 'TEMPORELLE', libelle: 'Temporelle' },
] as const

export const TYPES_EXERCICE: { valeur: TypeExercice; libelle: string }[] = [
  { valeur: 'COMPOSE_BAS', libelle: 'Composé bas' },
  { valeur: 'COMPOSE_HAUT', libelle: 'Composé haut' },
  { valeur: 'ISOLATION', libelle: 'Isolation' },
  { valeur: 'MACHINE', libelle: 'Machine' },
  { valeur: 'PDC', libelle: 'Poids du corps' },
]

const AIDES: Record<string, string> = {
  LINEAIRE: 'Linéaire : quand toutes les séries sont réussies, la charge monte d’un cran à la séance suivante.',
  DOUBLE:
    'Double progression : vous visez d’abord le haut de la plage de répétitions ; une fois atteint sur toutes les séries, la charge monte et les répétitions repartent du bas de la plage.',
  TEMPORELLE: 'Temporelle : pour les exercices en durée (gainage…), la durée cible augmente quand toutes les séries sont tenues.',
}

/** Aide courte sur ce que fera le système choisi (double progression si aucun : valeur par défaut du moteur). */
export function aideSysteme(systeme: string | null): string {
  return AIDES[systeme ?? 'DOUBLE'] ?? AIDES.DOUBLE
}

const REPS_MIN_DEFAUT = 8
const REPS_MAX_DEFAUT = 12
const INCREMENT_KG_DEFAUT = 2.5

// En double progression, des répétitions cibles de départ numériques sont indispensables : le moteur lit
// repsCibles comme un entier (« 8-12 » n'est pas évaluable). Elles sont donc préremplies avec le bas de plage.
function avecRepsDeDepart(e: ExerciceDraft): ExerciceDraft {
  return e.systemeProgression === 'DOUBLE' && e.repsType === 'REPS' && e.repsCibles.trim() === '' && e.repsMin !== null
    ? { ...e, repsCibles: String(e.repsMin) }
    : e
}

/** Active la surcharge : mêmes défauts qu'Android (double 8–12, +2,5 kg), sans écraser une saisie existante. */
export function activerProgression(e: ExerciceDraft): ExerciceDraft {
  return avecRepsDeDepart({
    ...e,
    progressionActivee: true,
    systemeProgression: e.systemeProgression ?? 'DOUBLE',
    repsMin: e.repsMin ?? REPS_MIN_DEFAUT,
    repsMax: e.repsMax ?? REPS_MAX_DEFAUT,
    incrementKg: e.incrementKg ?? INCREMENT_KG_DEFAUT,
  })
}

export function desactiverProgression(e: ExerciceDraft): ExerciceDraft {
  return { ...e, progressionActivee: false, repsMin: null, repsMax: null }
}

export function choisirSysteme(e: ExerciceDraft, systeme: string): ExerciceDraft {
  const base = { ...e, systemeProgression: systeme }
  if (systeme !== 'DOUBLE') return base
  return avecRepsDeDepart({ ...base, repsMin: e.repsMin ?? REPS_MIN_DEFAUT, repsMax: e.repsMax ?? REPS_MAX_DEFAUT })
}

/** Poids de corps coché => type PDC ; décoché => le type d'exercice reste (comme Android). */
export function basculerPoidsDeCorps(e: ExerciceDraft, coche: boolean): ExerciceDraft {
  return { ...e, isBodyweight: coche, typeExercice: coche ? 'PDC' : e.typeExercice }
}

/** Options affichées : plage de reps (double), type d'exercice, et quel incrément (charge, durée, aucun). */
export function optionsIncrement(e: ExerciceDraft): { plage: boolean; typeExercice: boolean; increment: 'charge' | 'duree' | 'aucun' } {
  const temporelle = e.systemeProgression === 'TEMPORELLE'
  return {
    plage: e.systemeProgression === 'DOUBLE',
    typeExercice: !e.isBodyweight && !temporelle,
    increment: e.isBodyweight ? 'aucun' : temporelle ? 'duree' : 'charge',
  }
}

const formaterKg = (kg: number) => String(chargeLisible(kg)).replace('.', ',')

const CONSIGNE_CHARGE = 'Indiquez une charge cible en kg (ex. 20 kg) pour voir la montée prévue.'

function montee(e: ExerciceDraft, materiel: EquipmentStocke) {
  const inventaire = { halteres: materiel.halteres, barre: materiel.barre, kettlebell: materiel.kettlebell, cable: materiel.cable }
  const pas = pasMaterielExercice(e.equipementCatalogue, materiel.pasParCategorie)
  const charges = chargesAtteignablesExercice(e.equipementCatalogue, inventaire)
  const chargeKg = parseChargeKg(e.chargeCible)
  const proposition = proposerMontee(e, { chargeKg, reps: null, dureeSec: null }, 0, pas, charges)
  const origine = charges
    ? 'avec les charges de votre matériel'
    : pas !== null
      ? `avec le pas de votre matériel (${formaterKg(pas)} kg)`
      : 'avec l’incrément choisi'
  return { chargeKg, proposition, origine }
}

function texteCharge(e: ExerciceDraft, materiel: EquipmentStocke): { texte: string; charge: string } | { consigne: string } {
  const { chargeKg, proposition, origine } = montee(e, materiel)
  if (chargeKg === null) return { consigne: CONSIGNE_CHARGE }
  const nouvelle = proposition.nouvelleChargeCible ?? chargeKg
  const delta = chargeLisible(nouvelle - chargeKg)
  if (delta <= 0) return { consigne: 'Avec ces réglages la charge ne monterait pas : augmentez l’incrément.' }
  return { texte: `${formaterKg(chargeKg)} kg → ${formaterKg(nouvelle)} kg (+${formaterKg(delta)} kg), ${origine}`, charge: formaterKg(nouvelle) }
}

/**
 * Ce que fera la progression en cas de succès, avec le matériel déclaré : calculé par le moteur lui-même
 * (proposerMontee), donc identique à la proposition faite à la fin de la séance.
 */
export function apercuMontee(e: ExerciceDraft, materiel: EquipmentStocke): string {
  switch (e.systemeProgression) {
    case 'TEMPORELLE': {
      const duree = /^\d+$/.test(e.repsCibles.trim()) ? Number(e.repsCibles.trim()) : 0
      if (duree <= 0) return 'Indiquez une durée cible (en secondes) pour voir la montée prévue.'
      return `Si toutes les séries sont tenues : durée cible ${duree} s → ${duree + e.incrementDureeSec} s.`
    }
    case 'LINEAIRE': {
      if (e.isBodyweight) return 'Au poids de corps la charge ne change pas : choisissez la double progression (répétitions puis séries).'
      const r = texteCharge(e, materiel)
      return 'consigne' in r ? r.consigne : `Si toutes les séries sont réussies : ${r.texte}.`
    }
    default: {
      if (e.repsMin === null || e.repsMax === null) return 'Indiquez la plage de répétitions (minimum et maximum).'
      const plage = `Tant que toutes les séries n’atteignent pas ${e.repsMax} répétitions : +1 répétition par séance.`
      if (e.isBodyweight) return `${plage} Puis retour à ${e.repsMin} répétitions avec une série de plus.`
      const r = texteCharge(e, materiel)
      if ('consigne' in r) return `${plage} ${r.consigne}`
      return `${plage} Puis charge ${r.texte.split(' (')[0]} et retour à ${e.repsMin} répétitions.`
    }
  }
}

export interface IndiceCharge {
  texte: string
  /** Charge à appliquer si l'utilisateur accepte d'arrondir, au format stocké (« 12 kg ») */
  chargeProche: string
}

/**
 * Indice non bloquant quand la charge cible n'est pas composable avec l'inventaire déclaré
 * (ChargeComposabiliteHint) : jamais de correction silencieuse, une action explicite « Arrondir ».
 */
export function indiceCharge(e: ExerciceDraft, materiel: EquipmentStocke): IndiceCharge | null {
  const inventaire = { halteres: materiel.halteres, barre: materiel.barre, kettlebell: materiel.kettlebell, cable: materiel.cable }
  const charges = chargesAtteignablesExercice(e.equipementCatalogue, inventaire)
  const chargeKg = parseChargeKg(normaliserCharge(e.chargeCible))
  if (!charges || chargeKg === null) return null
  const proche = chargeNonComposableHint(charges, chargeKg)
  if (proche === null) return null
  return {
    texte: `Charge non composable avec votre matériel : la plus proche est ${formaterKg(proche)} kg.`,
    chargeProche: `${chargeLisible(proche)} kg`,
  }
}

/** Réglages dont le moteur ne pourrait rien faire à la fin de la séance (avertissements, jamais bloquants). */
export function avertissementsProgression(e: ExerciceDraft): string[] {
  if (!e.progressionActivee) return []
  const avertissements: string[] = []
  const texte = e.repsCibles.trim()
  if (e.systemeProgression === 'TEMPORELLE') {
    if (e.repsType !== 'DURATION') avertissements.push('La progression temporelle s’applique à un exercice en durée : passez le type sur « Durée ».')
    return avertissements
  }
  if (e.repsType === 'REPS') {
    if (texte === '') {
      avertissements.push('Indiquez les répétitions cibles de départ (ex. 8) : sans elles, toutes les séries comptent comme réussies.')
    } else if (!/^\d+$/.test(texte)) {
      avertissements.push(
        `Les répétitions cibles « ${texte} » ne sont pas un nombre : indiquez le nombre de départ (ex. 8) pour que la fin de séance puisse évaluer chaque série.`,
      )
    }
  }
  return avertissements
}
