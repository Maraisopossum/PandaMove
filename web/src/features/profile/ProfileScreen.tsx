import { Link } from 'react-router'
import { useAuth } from '../../core/auth/AuthProvider'
import { ReglagesRetours } from '../strength/execute/circuit/ReglagesRetours'
import { useReglageRpe } from '../strength/execute/reglageRpe'
import { useExport } from './useExport'
import { useProfile } from './useProfile'

const trace = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function IconeLune() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...trace}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

// Liens du profil : icône décorative (le nom accessible reste le libellé)
const LIENS = [
  {
    to: '/profile/equipment',
    libelle: 'Mon matériel',
    icone: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...trace}>
        <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
      </svg>
    ),
  },
  {
    to: '/strength/catalog',
    libelle: "Catalogue d'exercices",
    icone: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...trace}>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6" />
      </svg>
    ),
  },
  {
    to: '/import',
    libelle: 'Importer des données',
    icone: (
      <svg width="20" height="20" viewBox="0 0 24 24" {...trace}>
        <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
      </svg>
    ),
  },
]

// Profil : variante du panda, mode sombre, accès au matériel, au catalogue et à l'import, et
// sauvegarde (export JSON). La logique vit dans useProfile et useExport.
export default function ProfileScreen() {
  const { session } = useAuth()
  const p = useProfile({ userId: session?.user.id })
  const { rpeActif, changerRpe } = useReglageRpe()
  const sauvegarde = useExport({ userId: session?.user.id })

  return (
    <>
      <h1 className="titre-ecran">Profil</h1>

      <fieldset className="profil__groupe">
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

      <button type="button" className="bouton profil__sombre" aria-pressed={p.dark} onClick={() => void p.changerDark(!p.dark)}>
        <span className="profil__icone" aria-hidden="true">
          <IconeLune />
        </span>
        <span>Mode sombre</span>
        <span className="profil__interrupteur" aria-hidden="true" />
      </button>

      <button type="button" className="bouton profil__sombre" aria-pressed={rpeActif} onClick={() => changerRpe(!rpeActif)}>
        <span className="profil__icone" aria-hidden="true">
          RPE
        </span>
        <span>RPE dans les séances</span>
        <span className="profil__interrupteur" aria-hidden="true" />
      </button>

      {p.erreur && <p role="alert">{p.erreur}</p>}

      <nav aria-label="Réglages" className="profil__liens">
        {LIENS.map((l) => (
          <Link key={l.to} className="bouton profil__lien" to={l.to}>
            <span className="profil__lien-icone" aria-hidden="true">
              {l.icone}
            </span>
            <span className="profil__lien-texte">{l.libelle}</span>
            <span className="profil__lien-chevron" aria-hidden="true">
              ›
            </span>
          </Link>
        ))}
      </nav>

      <section aria-labelledby="profil-seance" className="profil__seance">
        <h2 id="profil-seance">Séance</h2>
        <p className="aide">Retours du circuit automatique et du minuteur d’exercice, mémorisés sur cet appareil.</p>
        <ReglagesRetours />
      </section>

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
