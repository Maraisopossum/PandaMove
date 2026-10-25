import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { useExport } from './useExport'
import { useProfile } from './useProfile'

// Profil : variante du panda, mode sombre, accès au matériel, au catalogue et à l'import, et
// sauvegarde (export JSON). La logique vit dans useProfile et useExport.
export default function ProfileScreen() {
  const { session } = useAuth()
  const p = useProfile({ userId: session?.user.id })
  const sauvegarde = useExport({ userId: session?.user.id })

  return (
    <>
      <h1>Profil</h1>

      <fieldset className="formulaire__groupe">
        <legend>Variante du panda</legend>
        <label className="formulaire__case">
          <input
            type="radio"
            name="panda-variante"
            checked={p.pandaVariant === 'male'}
            disabled={!p.charge}
            onChange={() => void p.changerVariante('male')}
          />
          Panda mâle
        </label>
        <label className="formulaire__case">
          <input
            type="radio"
            name="panda-variante"
            checked={p.pandaVariant === 'female'}
            disabled={!p.charge}
            onChange={() => void p.changerVariante('female')}
          />
          Panda femelle
        </label>
      </fieldset>

      <button type="button" className="bouton" aria-pressed={p.dark} onClick={() => void p.changerDark(!p.dark)}>
        Mode sombre
      </button>

      {p.erreur && <p role="alert">{p.erreur}</p>}

      <nav aria-label="Réglages" className="profil__liens">
        <Link className="bouton profil__lien" to="/profile/equipment">
          Mon matériel
        </Link>
        <Link className="bouton profil__lien" to="/strength/catalog">
          Catalogue d'exercices
        </Link>
        <Link className="bouton profil__lien" to="/import">
          Importer des données
        </Link>
      </nav>

      <section aria-labelledby="profil-sauvegarde" className="profil__sauvegarde">
        <h2 id="profil-sauvegarde">Sauvegarde</h2>
        <p id="profil-sauvegarde-aide">
          Téléchargez toutes vos données de renforcement (séances, séances jouées, séries, exercices, objectifs et
          matériel) dans un fichier JSON au format de l'application Android. C'est une sauvegarde locale : gardez-la
          sur votre appareil ou votre propre support, hors des services tiers. Pour restaurer, importez-la avec ce
          compte depuis « Importer des données » : les éléments existants reprennent l'état du fichier, sans doublon,
          et ceux supprimés depuis reviennent.
        </p>
        <button
          type="button"
          className="bouton"
          aria-describedby="profil-sauvegarde-aide"
          aria-busy={sauvegarde.enCours}
          disabled={sauvegarde.enCours}
          onClick={() => void sauvegarde.exporter()}
        >
          Exporter mes données
        </button>
        <p role="status" className="profil__retour">
          {sauvegarde.message}
        </p>
        {sauvegarde.erreur && <p role="alert">{sauvegarde.erreur}</p>}
      </section>
    </>
  )
}
