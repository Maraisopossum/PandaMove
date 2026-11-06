import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { MODULES, urlIcone } from '../../app/modules'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { CarteDemarrage } from '../demarrage/CarteDemarrage'
import { LIBELLE_GENRE } from '../calendar/evenements'
import type { EvenementAgenda } from '../calendar/types'
import { libelleJour } from './semaine'
import { useEcranAccueil } from './useEcranAccueil'

// Modules proposés en accès rapide, dans l'ordre d'affichage (libellé, chemin, couleur et pastille viennent de MODULES).
// Où mène le bouton de la prochaine séance : renforcement = exécution de l'instance ; cardio = son module.
function actionProchaine(e: EvenementAgenda): { vers: string; libelle: string } {
  if (e.genre === 'renfo') return { vers: `/strength/instance/${e.id}`, libelle: 'Commencer' }
  return { vers: e.genre === 'course' ? '/running' : '/cycling', libelle: 'Voir la course' }
}

const TUILES = ['strength', 'running', 'cycling', 'calendar', 'stats', 'breathing'] as const

// Accueil : panda sur halo, accroche, accès directs aux six modules (pastilles illustrées). Le titre de page « Accueil »
// reste dans l'arbre d'accessibilité (la barre du haut l'affiche déjà). La maquette montre aussi un widget « Dernière
// activité locale » : aucune donnée de dernière séance n'est exposée à l'accueil, il n'est donc pas affiché
// (la reprise d'une séance en cours se fait par le bandeau « Séance en cours » de la coque).
export default function HomeScreen() {
  const { panda, prochaine, semaine, date } = useEcranAccueil()
  return (
    <div className="accueil">
      <h1 className="visuellement-cache">Accueil</h1>
      <header className="accueil__tete">
        <p className="accueil__date">{date}</p>
        <p className="accueil__titre">Prêt pour votre séance ?</p>
      </header>
      <section className="accueil__carte-hero" aria-labelledby="accueil-prochaine">
        <div className="accueil__hero-texte">
          {prochaine ? (
            <>
              <h2 id="accueil-prochaine" className="visuellement-cache">
                Prochaine séance
              </h2>
              <p className="accueil__prochaine-surtitre">
                <span className="accueil__prochaine-pastille">Prochaine séance</span>
                <span>{LIBELLE_GENRE[prochaine.evenement.genre]}</span>
              </p>
              <p className="accueil__prochaine-nom">{prochaine.evenement.titre}</p>
              <p className="accueil__prochaine-quand">{prochaine.quand}</p>
              {prochaine.evenement.genre === 'renfo' ? (
                <Link to={actionProchaine(prochaine.evenement).vers} className="accueil__prochaine-action">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    <path d="M7 4.5l12 7.5-12 7.5z" />
                  </svg>
                  {actionProchaine(prochaine.evenement).libelle}
                  <span className="visuellement-cache"> : {prochaine.evenement.titre}</span>
                </Link>
              ) : (
                <Link to="/calendar" className="accueil__prochaine-action accueil__prochaine-action--secondaire">
                  Voir dans le calendrier
                </Link>
              )}
            </>
          ) : (
            <>
              <h2 id="accueil-prochaine" className="accueil__prochaine-nom">
                Bienvenue
              </h2>
              <p className="accueil__texte">Vos données sont enregistrées en direct sur l’appareil. Tout reste accessible même sans réseau.</p>
            </>
          )}
        </div>
        <PandaIllustration image={panda} sizes="118px" className="accueil__panda" />
      </section>
      {semaine && (
        <section className="accueil__semaine" aria-labelledby="accueil-semaine">
          <div className="accueil__semaine-tete">
            <h2 id="accueil-semaine" className="accueil__libelle">
              Cette semaine
            </h2>
            <p className="accueil__semaine-compte">
              <strong>{semaine.terminees}</strong> terminée{semaine.terminees > 1 ? 's' : ''} sur {semaine.total}
            </p>
          </div>
          <ol className="accueil__jours">
            {semaine.jours.map((j) => (
              <li key={j.dateIso} className={`accueil__jour accueil__jour--${j.etat}${j.estAujourdhui ? ' accueil__jour--auj' : ''}`}>
                <span aria-hidden="true" className="accueil__jour-lettre">
                  {j.lettre}
                </span>
                <span aria-hidden="true" className="accueil__jour-rond">
                  {j.etat === 'fait' ? '✓' : j.estAujourdhui || j.etat === 'prevu' ? j.jourDuMois : ''}
                </span>
                <span className="visuellement-cache">
                  {libelleJour(j.dateIso, semaine.jours.find((x) => x.estAujourdhui)?.dateIso ?? '')}
                  {' : '}
                  {{ fait: 'séance terminée', prevu: 'séance prévue', manque: 'séance non faite', repos: 'repos' }[j.etat]}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <CarteDemarrage />
      <div className="accueil__section">
        <h2 className="accueil__libelle">Actions rapides</h2>
        <span className="accueil__version">PandaMove v2</span>
      </div>
      <nav aria-label="Accès rapides" className="accueil__tuiles">
        {TUILES.map((id) => {
          const { path, label, color, icone } = MODULES[id]
          return (
            <Link key={id} to={path} className="accueil__tuile" aria-label={label} style={{ '--couleur-module': color } as CSSProperties}>
              <img className="accueil__puce" src={urlIcone(icone)} alt="" width={50} height={50} decoding="async" />
              <span className="accueil__tuile-titre">{label}</span>
            </Link>
          )
        })}
      </nav>
      <p className="accueil__stockage">
        <span className="accueil__chip">Stockage local sécurisé</span>
        <span>Accessible sans réseau</span>
      </p>
    </div>
  )
}
