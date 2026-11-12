import { Link, useNavigate } from 'react-router'
import { BarreActionsFlottante } from '../../app/BarreActionsFlottante'
import { libelleZone, LIBELLE_POSTURE, LIBELLE_TYPE, MOMENTS } from './donnees'
import { zonesCouvertes } from './generer'
import { formaterMinutes } from './presentation'
import { useApercuMobilite } from './useApercuMobilite'

// Aperçu de la séance générée : exercices, durées et zones couvertes. On peut tirer une autre séance, remplacer ou retirer un
// exercice, puis commencer. Sans séance préparée, on renvoie vers le choix.
export default function ApercuMobiliteScreen() {
  const a = useApercuMobilite()
  const navigate = useNavigate()
  const { plan } = a

  if (!plan) {
    return (
      <div className="mobilite">
        <h1 className="titre-ecran">Votre séance</h1>
        <p>Aucune séance préparée pour l’instant.</p>
        <Link to="/mobility" className="bouton lien-bouton">
          Préparer une séance
        </Link>
      </div>
    )
  }

  return (
    <div className="mobilite">
      <h1 className="titre-ecran">Votre séance</h1>
      <p className="mobilite__resume">
        <strong>{formaterMinutes(plan.dureeTotaleS)}</strong> · {plan.etapes.length} exercices · {MOMENTS.find((m) => m.id === plan.moment)?.libelle.toLowerCase()}
      </p>
      <p className="mobilite__couvertes">Zones : {zonesCouvertes(plan.etapes).map(libelleZone).join(', ')}.</p>

      <ol className="mobilite__liste">
        {plan.etapes.map((x, i) => (
          <li key={x.exercice.id} className="mobilite__etape">
            <span className="mobilite__numero" aria-hidden="true">
              {i + 1}
            </span>
            <div className="mobilite__etape-corps">
              <p className="mobilite__etape-nom">{x.exercice.nom}</p>
              <p className="mobilite__etape-meta">
                {x.exercice.cote ? `${x.dureeS} s par côté` : `${x.dureeS} s`} · {LIBELLE_TYPE[x.exercice.type]} · {LIBELLE_POSTURE[x.exercice.posture]}
              </p>
              <p className="mobilite__etape-zones">{x.exercice.zones.map(libelleZone).join(' · ')}</p>
            </div>
            <div className="mobilite__etape-actions">
              <button type="button" className="bouton" aria-label={`Remplacer ${x.exercice.nom}`} onClick={() => a.remplacer(i)}>
                Remplacer
              </button>
              <button type="button" className="bouton" aria-label={`Retirer ${x.exercice.nom}`} disabled={plan.etapes.length <= 1} onClick={() => a.retirer(i)}>
                Retirer
              </button>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" className="bouton mobilite__tirage" onClick={a.autreTirage}>
        Autre séance
      </button>
      <Link to="/mobility" className="bouton lien-bouton mobilite__tirage">
        Modifier mon choix
      </Link>

      <BarreActionsFlottante
        libelle="Actions de la séance"
        principal={
          <button type="button" className="bouton bouton--principal" onClick={() => navigate('/mobility/seance')}>
            Commencer
          </button>
        }
      />
    </div>
  )
}
