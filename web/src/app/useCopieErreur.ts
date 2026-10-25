import { useCallback, useState } from 'react'
import { detailsErreur } from './erreurs'

export const MESSAGE_COPIE_OK = 'Détails copiés dans le presse-papiers.'
export const MESSAGE_COPIE_ECHEC = 'Copie impossible : sélectionnez le détail et copiez-le à la main.'

// Copie des détails techniques d'une erreur ; `confirmation` est annoncée dans une zone role="status".
export function useCopieErreur(erreur: unknown) {
  const [confirmation, setConfirmation] = useState('')
  const copier = useCallback(async () => {
    try {
      if (!navigator.clipboard) throw new Error('Presse-papiers indisponible')
      await navigator.clipboard.writeText(detailsErreur(erreur))
      setConfirmation(MESSAGE_COPIE_OK)
    } catch {
      setConfirmation(MESSAGE_COPIE_ECHEC)
    }
  }, [erreur])
  return { confirmation, copier }
}
