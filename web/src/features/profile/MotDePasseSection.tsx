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
      <form action={action} className="profil__mdp" key={retour.ok ? 'ok' : 'saisie'}>
        <label className="profil__champ">
          <span>Nouveau mot de passe</span>
          <input name="nouveau" type="password" autoComplete="new-password" required minLength={8} />
        </label>
        <label className="profil__champ">
          <span>Confirmer le mot de passe</span>
          <input name="confirmation" type="password" autoComplete="new-password" required minLength={8} />
        </label>
        <button type="submit" className="bouton bouton--principal" disabled={enCours}>
          Modifier le mot de passe
        </button>
      </form>
      {retour.message && <p role={retour.ok ? 'status' : 'alert'} className={retour.ok ? 'profil__mdp-retour' : 'profil__mdp-retour profil__mdp-retour--erreur'}>{retour.message}</p>}
    </section>
  )
}
