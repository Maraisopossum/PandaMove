import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { useProfile } from './useProfile'

// Profil : variante du panda, mode sombre et accès au matériel, au catalogue et à l'import.
// Pas d'export pour l'instant (tâche 19). La logique vit dans useProfile.
export default function ProfileScreen() {
  const { session } = useAuth()
  const p = useProfile({ userId: session?.user.id })

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
    </>
  )
}
