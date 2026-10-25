import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../../../core/auth/AuthProvider'
import { useImagePanda } from '../../../core/images/usePandaVariante'
import { chargeLisible } from '../../../core/progression/chargeLisible'
import type { DecisionEnregistree } from '../../../core/progression/marqueur'
import {
  compterSeries, formaterDateLongue, formaterDureeBilan, formaterTonnage, messageEnregistrement, sousTitreRecap, texteProposition, texteStatut,
} from './bilan'
import type { RapportExport } from './exportRapport'
import { useExportRapport } from './useExportRapport'
import { useReport, type ChoixRecap, type EtatProposition, type LigneBilan, type PropositionBilan } from './useReport'

/** Ligne du récap, prête à afficher (aucun calcul dans les composants). */
export interface LigneRecap {
  exerciceId: string
  nom: string
  texte: string
  explication: string
  deload: boolean
  actionnable: boolean
  etat: EtatProposition
  libelleEtat: string
  /** Charge proposée, valeur de départ du champ « Ajuster » */
  chargeProposee: number | null
  /** Charges composables avec « Mon matériel » (indice « Arrondir ») */
  chargesAtteignables: number[]
}

const LIBELLES_LIGNE: Record<LigneBilan['statut'], string> = {
  complet: 'Toutes les séries réalisées',
  partiel: 'Séance incomplète',
  aucune: 'Aucune série réalisée',
}

const LIBELLES_DECISION: Record<DecisionEnregistree, string> = {
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  ajustee: 'Ajustée',
  appliquee_auto: 'Appliquée automatiquement',
}

function libelleEtat(p: PropositionBilan): string {
  if (p.etat !== 'en_attente') return p.dejaDecide ? `Déjà décidé : ${LIBELLES_DECISION[p.etat]}` : LIBELLES_DECISION[p.etat]
  return p.actionnable ? 'En attente de votre choix' : 'Aucune décision à prendre'
}

const versLigneRecap = (p: PropositionBilan): LigneRecap => ({
  exerciceId: p.exerciceId,
  nom: p.nom,
  texte: p.proposition ? texteProposition(p.proposition) : '',
  explication: p.proposition ? texteStatut(p.proposition) : '',
  deload: p.proposition?.deload ?? false,
  actionnable: p.actionnable,
  etat: p.etat,
  libelleEtat: libelleEtat(p),
  chargeProposee: p.proposition?.nouvelleChargeCible == null ? null : chargeLisible(p.proposition.nouvelleChargeCible),
  chargesAtteignables: p.chargesAtteignables,
})

// Orchestration de l'écran de rapport : données (useReport), textes formatés, ouverture du récap, export.
// Le récap s'ouvre de lui-même tant qu'une proposition attend une décision ; « Plus tard » le ferme sans
// rien écrire (il se rouvre depuis le rapport). « Valider » applique tous les choix d'un coup, comme l'Android.
export function useEcranBilan(instanceId: string) {
  const { session } = useAuth()
  const r = useReport(instanceId, { userId: session?.user.id })
  const pandaVictoire = useImagePanda('victory', { userId: session?.user.id, taille: 'sm' })
  const [ouvert, setOuvert] = useState<boolean | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [annonce, setAnnonce] = useState('')
  const { valider: validerLot } = r

  const recap = r.propositions.map(versLigneRecap)
  const nbAValider = recap.filter((l) => l.actionnable && l.etat === 'en_attente').length
  const etatParExercice = new Map(recap.map((l) => [l.exerciceId, l.libelleEtat]))

  const series = compterSeries(r.exercices)
  const dateLongue = formaterDateLongue(r.date)
  const duree = formaterDureeBilan(r.resume.dureeSec)
  const tonnage = formaterTonnage(r.resume.tonnageKg)
  const seriesLibelle = `${series.realisees} / ${series.prevues}`

  const groupes = r.groupes.map((g) => ({
    ...g,
    exercices: g.exercices.map((e) => ({
      ...e,
      libelleSeries: `${e.seriesRealisees} / ${e.seriesPrevues} séries`,
      libelleStatut: LIBELLES_LIGNE[e.statut],
      libelleProgression: etatParExercice.get(e.exerciceId) ?? null,
    })),
  }))

  const rapportExport = useMemo<RapportExport | null>(
    () =>
      r.terminee
        ? {
            nom: r.nomSeance,
            dateLongue,
            notesSeance: r.notesSeance,
            notesInstance: r.notesInstance,
            duree,
            tonnage,
            series: seriesLibelle,
            groupes: r.groupes.map((g) => ({
              titre: g.titre,
              exercices: g.exercices.map((e) => ({ nom: e.nom, cible: e.cible, lignes: e.lignes })),
            })),
          }
        : null,
    [r.terminee, r.nomSeance, dateLongue, r.notesSeance, r.notesInstance, duree, tonnage, seriesLibelle, r.groupes],
  )
  const exportation = useExportRapport(rapportExport, r.date, setAnnonce)

  return {
    chargement: r.chargement,
    erreur: r.erreur,
    trouvee: r.trouvee,
    terminee: r.terminee,
    nomSeance: r.nomSeance,
    dateLongue,
    notesSeance: r.notesSeance,
    notesInstance: r.notesInstance,
    tonnage,
    series: seriesLibelle,
    duree,
    exercices: r.exercices,
    groupes,
    recap,
    nbAValider,
    sousTitreRecap: sousTitreRecap(nbAValider),
    recapOuvert: !r.chargement && (ouvert ?? nbAValider > 0) && recap.length > 0,
    aDesDecisions: r.propositions.length > 0,
    annonce,
    enCours,
    ouvrirRecap: useCallback(() => setOuvert(true), []),
    fermerRecap: useCallback(() => setOuvert(false), []),
    valider: useCallback(
      async (lot: ChoixRecap[]) => {
        setOuvert((o) => o ?? true)
        setEnCours(true)
        const ok = await validerLot(lot)
        setEnCours(false)
        if (ok) {
          setOuvert(false)
          setAnnonce(messageEnregistrement(lot.length))
        }
      },
      [validerLot],
    ),
    copier: exportation.copier,
    telecharger: exportation.telecharger,
    partager: exportation.partager,
    peutPartager: exportation.peutPartager,
    lienSeance: `/strength/instance/${instanceId}`,
    pandaVictoire,
  }
}
