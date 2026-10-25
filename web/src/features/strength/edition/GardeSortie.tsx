import { useContext, type RefObject } from 'react'
import { UNSAFE_DataRouterContext, useBlocker } from 'react-router'
import { DialogueConfirmation } from './DialogueConfirmation'

function Blocage({ modifieRef }: { modifieRef: RefObject<boolean> }) {
  const blocage = useBlocker(() => modifieRef.current)
  if (blocage.state !== 'blocked') return null
  return (
    <DialogueConfirmation
      titre="Quitter sans enregistrer ?"
      libelleConfirmer="Quitter sans enregistrer"
      libelleAnnuler="Rester sur la séance"
      onConfirmer={() => blocage.proceed()}
      onAnnuler={() => blocage.reset()}
    >
      <p>Les modifications de cette séance n’ont pas été enregistrées ; elles seront perdues.</p>
    </DialogueConfirmation>
  )
}

// Garde de sortie : tant que `modifieRef` vaut true, toute navigation interne (retour, menu, lien) demande
// confirmation. N'agit qu'avec un routeur de données (celui de l'application) : useBlocker n'existe pas
// sous un routeur simple (tests de composants).
export function GardeSortie({ modifieRef }: { modifieRef: RefObject<boolean> }) {
  const routeur = useContext(UNSAFE_DataRouterContext)
  return routeur ? <Blocage modifieRef={modifieRef} /> : null
}
