import { useCallback, useMemo, useState } from 'react'
import {
  construireLignes, mesuresLigne, numeroCourant, rpeApplicable, texteRepos, valeursLigne,
  type Brouillon, type SerieHisto,
} from './lignesSeries'
import type { ExerciceVue, Mesures } from './vue'

export interface LigneAffichee {
  numero: number
  libelle: string
  terminee: boolean
  courante: boolean
  reps: number | null
  chargeKg: number | null
  rpe: number | null
  // Reps / charge issues du prévu (grisées) et non d'une saisie
  repsGrisees: boolean
  chargeGrisee: boolean
  repos: string
}

export interface ActionsSeries {
  valider: (exerciceId: string, m: Mesures, numero: number, cote: string) => Promise<boolean>
  devalider: (exerciceId: string, numero: number) => Promise<boolean>
  ajouter: (exerciceId: string) => Promise<boolean>
  supprimer: (exerciceId: string) => Promise<boolean>
}

// Tableau de séries de l'exercice actif : lignes pré-remplies, brouillons de saisie (conservés quand on
// change d'exercice), validation / dé-validation, ajout et suppression. Les données restent écrites
// par useExecute ; ici seulement la présentation et les brouillons.
export function useTableauSeries(exercice: ExerciceVue | null, historique: SerieHisto[], actions: ActionsSeries) {
  // Clé « exercice#rang »
  const [brouillons, setBrouillons] = useState<Record<string, Brouillon>>({})
  const [enCours, setEnCours] = useState(false)

  const lignesBrutes = useMemo(() => (exercice ? construireLignes(exercice, historique) : []), [exercice, historique])
  const cle = (numero: number) => `${exercice?.id}#${numero}`
  const courant = numeroCourant(lignesBrutes)

  const lignes: LigneAffichee[] = lignesBrutes.map((l) => {
    const v = valeursLigne(l, brouillons[cle(l.numero)])
    return {
      numero: l.numero,
      libelle: l.libelle,
      terminee: l.terminee,
      courante: l.numero === courant,
      reps: v.reps,
      chargeKg: v.chargeKg,
      rpe: v.rpe,
      repsGrisees: !v.repsSaisies,
      chargeGrisee: !v.chargeSaisie,
      repos: texteRepos(l.reposSec),
    }
  })

  const modifier = useCallback(
    (numero: number, patch: Brouillon) => setBrouillons((b) => {
      const k = `${exercice?.id}#${numero}`
      return { ...b, [k]: { ...b[k], ...patch } }
    }),
    [exercice?.id],
  )

  // Efface la saisie en cours d'une ligne (ex. validée par le circuit automatique, hors de ce tableau)
  const oublier = useCallback(
    (exerciceId: string, numero: number) =>
      setBrouillons((b) => {
        const k = `${exerciceId}#${numero}`
        return k in b ? Object.fromEntries(Object.entries(b).filter(([cle]) => cle !== k)) : b
      }),
    [],
  )

  // Enchaîne une action unique à la fois (anti double appui), pour tout le tableau
  const exclusif = useCallback(async (action: () => Promise<boolean>) => {
    setEnCours(true)
    try {
      return await action()
    } finally {
      setEnCours(false)
    }
  }, [])

  const valider = (numero: number) => {
    const ligne = lignesBrutes.find((l) => l.numero === numero)
    if (!exercice || !ligne || ligne.terminee || enCours) return Promise.resolve(false)
    return exclusif(async () => {
      const ok = await actions.valider(exercice.id, mesuresLigne(ligne, brouillons[cle(numero)]), numero, ligne.cote)
      if (ok) setBrouillons((b) => Object.fromEntries(Object.entries(b).filter(([k]) => k !== cle(numero))))
      return ok
    })
  }

  // Les valeurs de la série annulée restent dans la ligne (modifiables) avant une nouvelle validation
  const devalider = (numero: number) => {
    const ligne = lignesBrutes.find((l) => l.numero === numero)
    if (!exercice || !ligne || !ligne.terminee || enCours) return Promise.resolve(false)
    return exclusif(async () => {
      const ok = await actions.devalider(exercice.id, numero)
      if (ok) modifier(numero, { reps: ligne.reps, chargeKg: ligne.chargeKg, rpe: ligne.rpe })
      return ok
    })
  }

  const ajouter = () => (exercice && !enCours ? exclusif(() => actions.ajouter(exercice.id)) : Promise.resolve(false))
  const supprimer = () => (exercice && !enCours ? exclusif(() => actions.supprimer(exercice.id)) : Promise.resolve(false))

  return {
    lignes,
    /** Saisies en cours, clé « exercice#rang » : le circuit s'en sert pour chronométrer la durée affichée. */
    brouillons,
    oublier,
    rpeVisible: exercice ? rpeApplicable(exercice.blocType, exercice.repsType) : false,
    enDuree: exercice?.repsType === 'DURATION',
    enCours,
    setReps: (numero: number, reps: number | null) => modifier(numero, { reps }),
    setCharge: (numero: number, chargeKg: number | null) => modifier(numero, { chargeKg }),
    // Re-clic sur la valeur choisie : efface le RPE
    choisirRpe: (numero: number, valeur: number) => {
      const actuel = lignes.find((l) => l.numero === numero)?.rpe
      modifier(numero, { rpe: actuel === valeur ? null : valeur })
    },
    valider,
    devalider,
    ajouter,
    supprimer,
  }
}
