import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ajuster, arreter as arreterEtat, demarrerManuel as demarrerManuelEtat, forcerDuree, lireEtat, oublierReglage, restantMs,
  serialiserEtat, type EtatMinuteur, type InfoRepos,
} from './minuteurRepos'
import { ecrireStockage, lireStockage } from './stockageNavigateur'

const cleStockage = (instanceId: string) => `pandamove.repos.${instanceId}`

// Minuteur de repos de l'écran d'exécution : repos des séries (info), réglages (+30 s / −30 s / arrêt / durée saisie)
// et minuteur manuel. L'état est une suite d'horodatages gardée dans le navigateur par séance : un rechargement
// restitue le décompte. `maintenantMs` ne sert qu'à l'affichage ; les actions lisent `nowFn`.
export function useMinuteurRepos(
  instanceId: string,
  info: InfoRepos | null,
  maintenantMs: number,
  nowFn: () => number = Date.now,
) {
  const [etat, setEtat] = useState<EtatMinuteur>(() => lireEtat(lireStockage(cleStockage(instanceId))))
  // Dernière info lisible par les actions sans les recréer à chaque rendu
  const infoRef = useRef(info)
  useEffect(() => {
    infoRef.current = info
  })

  const modifier = useCallback(
    (f: (e: EtatMinuteur) => EtatMinuteur) =>
      setEtat((e) => {
        const suivant = f(e)
        if (suivant !== e) ecrireStockage(cleStockage(instanceId), serialiserEtat(suivant))
        return suivant
      }),
    [instanceId],
  )

  const allonger = useCallback(() => modifier((e) => ajuster(infoRef.current, e, 30, nowFn())), [modifier, nowFn])
  const ecourter = useCallback(() => modifier((e) => ajuster(infoRef.current, e, -30, nowFn())), [modifier, nowFn])
  const arreter = useCallback(() => modifier((e) => arreterEtat(infoRef.current, e, nowFn())), [modifier, nowFn])
  const demarrerManuel = useCallback((sec: number) => modifier((e) => demarrerManuelEtat(e, nowFn(), sec)), [modifier, nowFn])
  // Après la validation de la ligne `cle` : le repos saisi (s) s'applique, sinon celui de l'exercice
  const noterValidation = useCallback(
    (cle: string, reposSaisiSec: number | null) =>
      modifier((e) => (reposSaisiSec === null ? oublierReglage(e, cle) : forcerDuree(e, cle, reposSaisiSec))),
    [modifier],
  )
  const noterDevalidation = useCallback((cle: string) => modifier((e) => oublierReglage(e, cle)), [modifier])

  return {
    restantMs: restantMs(info, etat, maintenantMs),
    derniereManuelleSec: etat.derniereManuelleSec,
    allonger, ecourter, arreter, demarrerManuel, noterValidation, noterDevalidation,
  }
}
