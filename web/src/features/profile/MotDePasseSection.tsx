import { urlIcone } from '../../app/modules'
import { useMotDePasse } from './useMotDePasse'

// Section « Mot de passe » du profil : nouveau mot de passe + confirmation. Logique dans useMotDePasse.
export function MotDePasseSection() {
  const { retour, action, enCours } = useMotDePasse()
  return (
    <section aria-labelledby="profil-mdp" className="profil__sauvegarde">
      <h2 id="profil-mdp" className="profil__titre-icone">
        <img className="profil__puce" src={urlIcone('cle')} alt="" width={30} height={30} decoding="async" />
        Mot de passe
      </h2>
      {/* key : les champs sont vidés après un changement réussi */}
      <form action={action} key={retour.ok ? 'ok' : 'saisie'}>
        <label>
          Nouveau mot de passe
          <input name="nouveau" type="password" autoComplete="new-password" required minLength={8} />
        </label>
        <label>
          Confirmer le mot de passe
          <input name="confirmation" type="password" autoComplete="new-password" required minLength={8} />
        </label>
        <button type="submit" className="bouton" disabled={enCours}>
          Modifier le mot de passe
        </button>
      </form>
      {retour.message && <p role={retour.ok ? 'status' : 'alert'}>{retour.message}</p>}
    </section>
  )
}
