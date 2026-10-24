import { useCallback, useState } from 'react'
import { useAuth } from '../../../core/auth/AuthProvider'
import { chargeLisible } from '../../../core/progression/chargeLisible'
import { formaterDureeBilan, formaterTonnage, texteProposition, texteStatut } from './bilan'
import type { DecisionEnregistree } from '../../../core/progression/marqueur'
import { useReport, type EtatProposition, type LigneBilan, type PropositionBilan } from './useReport'

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
})

// Orchestration de l'écran de bilan : données (useReport), textes formatés, ouverture du récap.
// Le récap s'ouvre de lui-même tant qu'une proposition attend une décision ; une fois une décision
// prise, il reste ouvert jusqu'à « Fermer » (l'utilisateur voit le résultat de son choix).
export function useEcranBilan(instanceId: string) {
  const { session } = useAuth()
  const r = useReport(instanceId, { userId: session?.user.id })
  const [ouvert, setOuvert] = useState<boolean | null>(null)
  const { accepter, refuser, ajuster } = r

  const recap = r.propositions.map(versLigneRecap)
  const enAttente = r.propositions.some((p) => p.actionnable && p.etat === 'en_attente')
  const garderOuvert = useCallback(() => setOuvert((o) => o ?? true), [])

  return {
    chargement: r.chargement,
    erreur: r.erreur,
    trouvee: r.trouvee,
    terminee: r.terminee,
    nomSeance: r.nomSeance,
    tonnage: formaterTonnage(r.resume.tonnageKg),
    series: String(r.resume.seriesTotal),
    duree: formaterDureeBilan(r.resume.dureeSec),
    exercices: r.exercices.map((e) => ({
      ...e,
      libelleSeries: `${e.seriesRealisees} / ${e.seriesPrevues} séries`,
      libelleStatut: LIBELLES_LIGNE[e.statut],
    })),
    recap,
    recapOuvert: !r.chargement && (ouvert ?? enAttente) && recap.length > 0,
    aDesDecisions: r.propositions.length > 0,
    ouvrirRecap: useCallback(() => setOuvert(true), []),
    fermerRecap: useCallback(() => setOuvert(false), []),
    accepter: useCallback(
      (id: string) => {
        garderOuvert()
        return accepter(id)
      },
      [accepter, garderOuvert],
    ),
    refuser: useCallback(
      (id: string) => {
        garderOuvert()
        return refuser(id)
      },
      [refuser, garderOuvert],
    ),
    ajuster: useCallback(
      (id: string, kg: number) => {
        garderOuvert()
        return ajuster(id, kg)
      },
      [ajuster, garderOuvert],
    ),
    lienSeance: `/strength/instance/${instanceId}`,
  }
}
