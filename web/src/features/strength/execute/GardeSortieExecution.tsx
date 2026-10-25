import { useCallback, useContext, useState, type RefObject } from 'react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router'
import { DialogueSortie } from './DialogueSortie'
import { optionsSortie } from './sortie'

interface Props {
  /** Vrai : la navigation est interceptée (lu à chaque tentative de navigation). */
  bloquerRef: RefObject<boolean>
  /** Au moins une série validée (change le libellé du choix « menu »). */
  progression: boolean
  /** Appelé avant de quitter par « Aller dans le menu » / « Quitter sans enregistrer » (ex. remise à zéro sans série). */
  onQuitter: () => Promise<unknown>
  /** « Annuler la séance » : ouvre la confirmation de suppression (le dialogue de sortie se ferme). */
  onAnnuler: () => void
}

function Blocage({ bloquerRef, progression, onQuitter, onAnnuler }: Props) {
  const blocage = useBlocker(() => bloquerRef.current)
  const [enCours, setEnCours] = useState(false)
  const quitter = useCallback(async () => {
    if (blocage.state !== 'blocked') return
    setEnCours(true)
    try {
      await onQuitter()
    } catch (e) {
      console.error('Sortie de la séance : remise à zéro impossible', e)
    } finally {
      setEnCours(false)
    }
    blocage.proceed()
  }, [blocage, onQuitter])
  if (blocage.state !== 'blocked') return null
  return (
    <DialogueSortie
      options={optionsSortie(progression)}
      enCours={enCours}
      onRester={() => blocage.reset()}
      onMenu={() => void quitter()}
      onAnnuler={() => {
        blocage.reset()
        onAnnuler()
      }}
    />
  )
}

// Garde de navigation (retour du navigateur, menu, liens) de l'écran d'exécution : dialogue de sortie de l'Android.
// N'agit qu'avec un routeur de données (celui de l'application) : useBlocker n'existe pas sous un routeur simple
// (tests de composants).
export function GardeSortieExecution(props: Props) {
  const routeur = useContext(UNSAFE_DataRouterContext)
  return routeur ? <Blocage {...props} /> : null
}
