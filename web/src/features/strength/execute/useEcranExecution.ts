import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../../core/auth/AuthProvider'
import { useImagePanda } from '../../../core/images/usePandaVariante'
import type { SerieHisto } from './lignesSeries'
import { recapCircuit, lancementPour } from './circuit/plan'
import { useCircuit } from './circuit/useCircuit'
import { useReglagesCircuit } from './circuit/useReglagesCircuit'
import { useExecute } from './useExecute'
import { useHistoriqueExercice } from './useHistoriqueExercice'
import { useMateriel } from './useMateriel'
import { useMinuteurRepos } from './useMinuteurRepos'
import { useMontee } from './useMontee'
import { useTitreOnglet } from './useTitreOnglet'
import { useSuppressionSeanceEnCours } from './useSuppressionSeanceEnCours'
import { useNavExercices } from './useNavExercices'
import { useNotesSeance } from './useNotesSeance'
import { useGardeSortie } from './useGardeSortie'
import { useRenommageSeance } from './useRenommageSeance'
import { useTableauSeries } from './useTableauSeries'
import { useWakeLock } from './useWakeLock'
import { bandeauProgression } from './bandeauProgression'
import { messageFin } from './confirmationFin'
import { titreOnglet } from './seanceActive'
import { aProgression, gardeSortieActive } from './sortie'
import { chargeInitialeCalculateur } from './disques'
import { monteeDisponible } from './montee'
import { formaterDuree, libelleDureeAccessible } from './vue'

const SANS_HISTORIQUE: SerieHisto[] = []

// Orchestration de l'écran d'exécution : données et actions (useExecute), écran gardé allumé pendant
// la séance, confirmation de fin puis ouverture du bilan, textes du chrono et du repos.
export function useEcranExecution(instanceId: string) {
  const { session } = useAuth()
  const ex = useExecute(instanceId, { userId: session?.user.id })
  const nav = useNavExercices(ex.blocs, ex.exercices)
  const actif = nav.exerciceActif
  // Repos : celui des séries validées, réglable (+30 s / −30 s / arrêt / durée saisie) + minuteur manuel
  const minuteur = useMinuteurRepos(instanceId, ex.infoRepos, ex.maintenantMs)
  const { noterValidation, noterDevalidation } = minuteur
  const tableau = useTableauSeries(actif, (actif && ex.precedentes.get(actif.exerciseId)) || SANS_HISTORIQUE, {
    valider: ex.validerSerie,
    devalider: ex.devaliderSerie,
    ajouter: ex.ajouterSerie,
    supprimer: ex.supprimerSerie,
    surValidation: (exerciceId, numero, reposSaisiSec) => noterValidation(`${exerciceId}#${numero}`, reposSaisiSec),
    surDevalidation: (exerciceId, numero) => noterDevalidation(`${exerciceId}#${numero}`),
  })
  // Outil ouvert (feuille du bas) : minuteur manuel, calculateur de disques, montée en charge
  const [feuille, setFeuille] = useState<'minuteur' | 'disques' | 'echauffement' | null>(null)
  const fermerFeuille = useCallback(() => setFeuille(null), [])
  // « Mon matériel » : disques du calculateur, charges composables de la montée en charge
  const materiel = useMateriel(session?.user.id)
  const montee = useMontee(materiel)
  const { ouvrir: ouvrirMontee } = montee
  const { demarre, demarrer } = ex
  // Circuit automatique et minuteur d'exercice : valide par le même chemin d'écriture que le tableau
  const { reglages } = useReglagesCircuit()
  const circuit = useCircuit({
    exercices: ex.exercices,
    precedentes: ex.precedentes,
    brouillons: tableau.brouillons,
    valider: ex.validerSerie,
    oublierBrouillon: tableau.oublier,
    demarrerSeance: () => (demarre ? Promise.resolve(true) : demarrer()),
    surExercice: nav.choisir,
    reglages,
  })
  // Le bouton reste affiché sous l'écran du circuit (le focus y revient à l'arrêt) ; `lancer` ignore un second lancement
  const lancement = ex.terminee ? null : lancementPour(nav.blocActif, actif)
  const historique = useHistoriqueExercice(actif?.exerciseId ?? null)
  const notes = useNotesSeance(ex.notes, ex.enregistrerNotes)
  const navigate = useNavigate()
  // Garde de sortie (dialogue de l'Android) : désarmée avant toute navigation voulue par l'écran lui-même
  const garde = useGardeSortie(gardeSortieActive({ trouvee: ex.trouvee, terminee: ex.terminee, exercices: ex.exercices }))
  const { contourner } = garde
  const suppression = useSuppressionSeanceEnCours(instanceId, undefined, contourner)
  const renommage = useRenommageSeance(ex.nomSeance, ex.renommer)
  const modifierExercices = useCallback(() => {
    contourner()
    void navigate(`/strength/instance/${instanceId}/edit`)
  }, [contourner, instanceId, navigate])
  const { terminer } = ex
  useWakeLock(ex.demarre && !ex.terminee)
  useTitreOnglet(
    titreOnglet({
      nomSeance: ex.chargement ? 'Séance' : ex.nomSeance,
      chrono: formaterDuree(ex.elapsedMs),
      repos: minuteur.restantMs !== null && minuteur.restantMs > 0 ? formaterDuree(minuteur.restantMs) : null,
      enPause: ex.enPause,
      termine: ex.terminee,
      demarre: ex.demarre,
    }),
  )
  const pandaMotivation = useImagePanda('motivation', { userId: session?.user.id, taille: 'sm' })

  // Fin de séance : confirmation (texte de l'Android + séries non validées), puis clôture et ouverture du bilan
  const [finOuverte, setFinOuverte] = useState(false)
  const demanderFin = useCallback(() => setFinOuverte(true), [])
  const annulerFin = useCallback(() => setFinOuverte(false), [])
  const confirmerFin = useCallback(async () => {
    setFinOuverte(false)
    if (await terminer()) {
      contourner()
      void navigate(`/strength/instance/${instanceId}/report`)
    }
  }, [contourner, instanceId, navigate, terminer])

  return {
    ...ex,
    nav,
    tableau,
    historique,
    circuit: {
      affichage: circuit.affichage,
      message: circuit.message,
      erreur: circuit.erreur,
      lancement,
      recap: lancement?.type === 'circuit' && nav.blocActif ? recapCircuit(nav.blocActif.exercices) : '',
      lancer: () => {
        if (lancement) circuit.lancer(lancement)
      },
      arreter: circuit.arreter,
    },
    notes,
    chrono: formaterDuree(ex.elapsedMs),
    libelleChrono: libelleDureeAccessible(ex.elapsedMs),
    repos: {
      restantMs: minuteur.restantMs,
      texte: minuteur.restantMs === null ? '' : formaterDuree(minuteur.restantMs),
      termine: minuteur.restantMs === 0,
      urgent: minuteur.restantMs !== null && minuteur.restantMs > 0 && minuteur.restantMs <= 5000,
      allonger: minuteur.allonger,
      ecourter: minuteur.ecourter,
      arreter: minuteur.arreter,
    },
    minuteurManuel: { derniereSec: minuteur.derniereManuelleSec, demarrer: minuteur.demarrerManuel },
    // Menu « Séance » (crayon Android) : modifier le nom (de la séance jouée), les exercices, supprimer la séance
    menuSeance: [
      { id: 'renommer', libelle: 'Modifier le nom', onChoisir: renommage.ouvrir },
      { id: 'modifier', libelle: 'Modifier les exercices', onChoisir: modifierExercices },
      { id: 'supprimer', libelle: 'Supprimer la séance', destructive: true, onChoisir: () => suppression.demander('menu') },
    ],
    renommage,
    suppression,
    // Dialogue de sortie : « Annuler la séance » ouvre la confirmation de suppression
    sortie: {
      bloquerRef: garde.bloquerRef,
      progression: aProgression(ex.exercices),
      quitter: ex.abandonnerDemarrage,
      annuler: () => suppression.demander('sortie'),
    },
    modifierExercices,
    feuille,
    ouvrirFeuille: setFeuille,
    fermerFeuille,
    // Outils de l'exercice actif : disques (charge de la prochaine série), montée en charge (si elle a un sens)
    outilsExercice: {
      inventaire: materiel,
      chargeDisques: chargeInitialeCalculateur(tableau.lignes.find((l) => !l.terminee)?.chargeKg ?? null, actif?.chargeCible ?? ''),
      monteeDisponible: actif ? monteeDisponible(actif.blocType, actif.chargeCible) : false,
      ouvrirDisques: () => setFeuille('disques'),
      ouvrirMontee: () => {
        if (actif) ouvrirMontee(actif)
        setFeuille('echauffement')
      },
      montee: {
        etat: actif ? montee.etats[actif.id] : undefined,
        changerProtocole: (p: Parameters<typeof montee.changerProtocole>[1]) => actif && montee.changerProtocole(actif, p),
        cocher: (i: number) => actif && montee.cocher(actif, i),
      },
    },
    bandeau: actif ? bandeauProgression(actif, ex.apercus.get(actif.id)) : null,
    // Note de l'exercice actif : enregistrée en base à la sortie du champ (colonne exercices_seance.notes, migration 0007)
    noteExercice: {
      enregistree: actif?.ligne.notes ?? '',
      enregistrer: (texte: string) => (actif ? ex.noterExercice(actif.id, texte) : Promise.resolve(false)),
    },
    lienBilan: `/strength/instance/${instanceId}/report`,
    // Panda de motivation, affiché avant le démarrage de la séance
    pandaMotivation: ex.trouvee && !ex.demarre && !ex.terminee ? pandaMotivation : undefined,
    fin: { ouverte: finOuverte, message: messageFin(ex.exercices), demander: demanderFin, annuler: annulerFin, confirmer: confirmerFin },
  }
}
