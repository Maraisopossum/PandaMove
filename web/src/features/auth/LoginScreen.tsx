import { useActionState } from 'react'
import { urlIcone } from '../../app/modules'
import { useAuth } from '../../core/auth/AuthProvider'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { pandaImage } from '../../core/images/pandaImage'

// Splash commun aux deux variantes (la variante n'est connue qu'après connexion) ; précaché par le service worker
const SPLASH = pandaImage('splash', 'male', 'sm')

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
    <main className="connexion">
      <header className="connexion__tete">
        <PandaIllustration image={SPLASH} sizes="130px" prioritaire className="connexion__splash" />
        <h1 className="titre-ecran">Connexion</h1>
        <p className="connexion__sous-titre">Retrouvez vos séances sur tous vos appareils.</p>
      </header>
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
        <p className="connexion__ou" aria-hidden="true">
          <span>ou</span>
        </p>
        <button type="submit" name="intent" value="magic" disabled={enCours} className="connexion__magique">
          <img src={urlIcone('cle')} alt="" width={26} height={26} decoding="async" />
          Recevoir un lien magique
        </button>
        <p className="connexion__compte">
          Pas encore de compte ?{' '}
          <button type="submit" name="intent" value="signup" disabled={enCours} className="connexion__lien">
            Créer un compte
          </button>
        </p>
      </form>
      {message && <p role="status">{message}</p>}
    </main>
  )
}
