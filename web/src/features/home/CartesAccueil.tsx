import { Link, useNavigate } from 'react-router'
import { urlIcone } from '../../app/modules'
import { preparerSeance } from '../mobilite/routines'
import type { ProgressionObjectif } from '../profile/objectifs'
import type { Proposition } from './propositionsDuJour'

// « Aujourd'hui » : jusqu'à trois propositions tirées des modules (séance de renforcement suggérée, routine de mobilité, respiration).
// Indicatif : elles ne remplacent pas les sensations. Lancer une routine de mobilité prépare la séance comme « Générer » puis ouvre
// son aperçu. Logique dans propositionsDuJour.ts.
export function PropositionsDuJour({ propositions }: { propositions: Proposition[] }) {
  const navigate = useNavigate()
  if (propositions.length === 0) return null
  return (
    <section className="accueil__aujourdhui" aria-labelledby="accueil-aujourdhui">
      <h2 id="accueil-aujourdhui">Aujourd’hui</h2>
      <ul className="accueil__propositions">
        {propositions.map((p) => (
          <li key={p.id} className="accueil__proposition">
            <img className="accueil__proposition-icone" src={urlIcone(p.icone)} alt="" width={44} height={44} decoding="async" />
            <span className="accueil__proposition-texte">
              <span className="accueil__proposition-categorie">{p.categorie}</span>
              <strong>{p.titre}</strong>
              <span className="aide">{p.detail}</span>
            </span>
            {p.action.type === 'lien' ? (
              <Link to={p.action.vers} className="accueil__proposition-action" aria-label={`${p.action.libelle} : ${p.titre}`}>
                {p.action.libelle}
              </Link>
            ) : (
              <button
                type="button"
                className="accueil__proposition-action"
                aria-label={`${p.action.libelle} : ${p.titre}`}
                onClick={() => {
                  if (p.action.type !== 'mobilite') return
                  preparerSeance(p.action.choix)
                  void navigate('/mobility/apercu')
                }}
              >
                {p.action.libelle}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="aide">Propositions d’après votre semaine, votre charge et vos habitudes. Elles ne remplacent pas vos sensations.</p>
    </section>
  )
}

/** Objectifs de la semaine : avancement des objectifs définis au profil (le distance de l'année reste au profil). */
export function ObjectifsAccueil({ objectifs }: { objectifs: ProgressionObjectif[] }) {
  const semaine = objectifs.filter((o) => o.id !== 'distance-annee')
  if (semaine.length === 0) return null
  return (
    <section className="accueil__carte" aria-labelledby="accueil-objectifs">
      <div className="accueil__carte-tete">
        <h2 id="accueil-objectifs" className="accueil__carte-titre">
          Objectifs de la semaine
        </h2>
        <Link to="/profile" className="accueil__carte-lien">
          Modifier
        </Link>
      </div>
      <ul className="accueil__objectifs">
        {semaine.map((o) => (
          <li key={o.id}>
            <img src={urlIcone(o.icone)} alt="" width={32} height={32} decoding="async" />
            <span className="accueil__objectif-corps">
              <span className="accueil__objectif-nom">{o.nom}</span>
              <span role="progressbar" aria-label={o.nom} aria-valuemin={0} aria-valuemax={100} aria-valuenow={o.pct} className="accueil__objectif-piste">
                <span className={o.atteint ? 'accueil__objectif-barre accueil__objectif-barre--atteint' : 'accueil__objectif-barre'} style={{ width: `${o.pct}%` }} />
              </span>
            </span>
            <span className="accueil__objectif-valeur">{o.valeur}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
