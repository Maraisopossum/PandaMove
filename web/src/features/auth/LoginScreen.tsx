import { useActionState } from 'react'
import { useAuth } from '../../core/auth/AuthProvider'

// Écran de connexion : le formulaire ne fait qu'appeler useAuth() ; l'état du message est géré par l'action.
export default function LoginScreen() {
  const { signIn, signUp, signInWithMagicLink } = useAuth()

  const [message, action, enCours] = useActionState(async (_precedent: string | null, formData: FormData) => {
    const email = String(formData.get('email') ?? '')
    const motDePasse = String(formData.get('password') ?? '')
    try {
      switch (formData.get('intent')) {
        case 'signup':
          await signUp(email, motDePasse)
          return 'Compte créé. Vérifie ta boîte mail si une confirmation est demandée.'
        case 'magic':
          await signInWithMagicLink(email)
          return 'Lien de connexion envoyé : consulte ta boîte mail.'
        default:
          await signIn(email, motDePasse)
          return null
      }
    } catch (e) {
      return e instanceof Error ? e.message : 'Une erreur est survenue.'
    }
  }, null)

  return (
    <main>
      <h1>Connexion</h1>
      <form action={action}>
        <label>
          Adresse e-mail
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Mot de passe
          <input name="password" type="password" autoComplete="current-password" />
        </label>
        <button type="submit" name="intent" value="signin" disabled={enCours}>
          Se connecter
        </button>
        <button type="submit" name="intent" value="signup" disabled={enCours}>
          Créer un compte
        </button>
        <button type="submit" name="intent" value="magic" disabled={enCours}>
          Recevoir un lien magique
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </main>
  )
}
