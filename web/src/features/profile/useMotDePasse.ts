import { useActionState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'
import { erreurMotDePasse } from './motDePasse'

export interface RetourMotDePasse {
  ok: boolean
  message: string | null
}

// Changement de mot de passe : valide les deux champs puis appelle Supabase. Le message d'erreur ou de succès
// est géré par l'action (un seul envoi à la fois).
export function useMotDePasse() {
  const { updatePassword } = useAuth()
  const [retour, action, enCours] = useActionState(async (_precedent: RetourMotDePasse, formData: FormData): Promise<RetourMotDePasse> => {
    const nouveau = String(formData.get('nouveau') ?? '')
    const confirmation = String(formData.get('confirmation') ?? '')
    const invalide = erreurMotDePasse(nouveau, confirmation)
    if (invalide) return { ok: false, message: invalide }
    try {
      await updatePassword(nouveau)
      return { ok: true, message: 'Mot de passe modifié.' }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Le mot de passe n’a pas pu être modifié.' }
    }
  }, { ok: false, message: null })
  return { retour, action, enCours }
}
