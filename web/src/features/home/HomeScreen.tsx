import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import { MODULES, urlIcone } from '../../app/modules'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { CarteDemarrage } from '../demarrage/CarteDemarrage'
import { ObjectifsAccueil, PropositionsDuJour } from './CartesAccueil'
import { LIBELLE_GENRE } from '../calendar/evenements'
import type { EvenementAgenda } from '../calendar/types'
import { libelleJour } from './semaine'
import { useEcranAccueil } from './useEcranAccueil'

// Où mène le bouton de la prochaine séance : renforcement = exécution de l'instance ; cardio = saisie de la sortie
// (course et vélo n'ont pas de minuteur : la séance se retrouve dans l'agenda, la sortie s'enregistre au retour).
function actionProchaine(e: EvenementAgenda): { vers: string; libelle: string } {
  if (e.genre === 'renfo') return { vers: `/strength/instance/${e.id}`, libelle: 'Commencer' }
  return { vers: e.genre === 'course' ? '/running/new' : '/cycling/new', libelle: 'Enregistrer la sortie' }
}

// Modules proposés en accès rapide, dans l'ordre d'affichage (libellé, chemin, couleur et pastille viennent de MODULES).
// Statistiques n'y figure pas : les cartes « Cette semaine » et « Forme du jour » y mènent.
const TUILES = ['strength', 'running', 'cycling', 'mobility', 'breathing', 'calendar'] as const

const DATE_COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const dateCourte = (iso: string) => DATE_COURTE.format(new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))))
const SENS = { hausse: 'accueil__ecart--hausse', baisse: 'accueil__ecart--baisse', stable: 'accueil__ecart--stable' } as const

// Courbe de fraîcheur des 42 derniers jours (ligne zéro en pointillés) ; décorative, le chiffre et l'état sont écrits à côté.
function CourbeForme({ serie }: { serie: number[] }) {
  const max = Math.max(10, ...serie.map(Math.abs))
  const y = (v: number) => 28 - (v / max) * 24
  const x = (i: number) => 4 + (i / Math.max(1, serie.length - 1)) * 322
  const points = serie.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="accueil__forme-courbe" viewBox="0 0 330 56" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <line x1="0" y1="28" x2="330" y2="28" className="accueil__forme-zero" />
      <polyline points={points} className="accueil__forme-trace" />
      <circle cx={x(serie.length - 1)} cy={y(serie[serie.length - 1])} r="5" className="accueil__forme-point" />
    </svg>
  )
}

// Accueil : panda sur halo, accroche, accès directs aux six modules (pastilles illustrées). Le titre de page « Accueil »
// reste dans l'arbre d'accessibilité (la barre du haut l'affiche déjà). La maquette montre aussi un widget « Dernière
// activité locale » : aucune donnée de dernière séance n'est exposée à l'accueil, il n'est donc pas affiché
// (la reprise d'une séance en cours se fait par le bandeau « Séance en cours » de la coque).
export default function HomeScreen() {
  const { panda, prochaine, semaine, date, indicateurs, forme, derniere, propositions, objectifs } = useEcranAccueil()
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
              <Link to={actionProchaine(prochaine.evenement).vers} className="accueil__prochaine-action">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                  <path d="M7 4.5l12 7.5-12 7.5z" />
                </svg>
                {actionProchaine(prochaine.evenement).libelle}
                <span className="visuellement-cache"> : {prochaine.evenement.titre}</span>
              </Link>
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
      <PropositionsDuJour propositions={propositions} />
      {(semaine || indicateurs) && (
        <section className="accueil__carte" aria-labelledby="accueil-semaine">
          <div className="accueil__carte-tete">
            <h2 id="accueil-semaine" className="accueil__carte-titre">
              Cette semaine
            </h2>
            <Link to="/calendar" className="accueil__carte-lien">
              Calendrier
            </Link>
          </div>
          {semaine && (
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
          )}
          {indicateurs && (
            <ul className="accueil__kpis" aria-label="Bilan de la semaine, comparé à la même période de la semaine précédente">
              {indicateurs.map((k) => (
                <li key={k.id} className="accueil__kpi">
                  <span className="accueil__kpi-valeur">{k.valeur}</span>
                  <span className="accueil__kpi-libelle">{k.libelle}</span>
                  <span className={`accueil__ecart ${SENS[k.ecart.sens]}`}>
                    {k.ecart.texte}
                    <span className="visuellement-cache"> par rapport à la semaine précédente</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <ObjectifsAccueil objectifs={objectifs} />
      {forme && (
        <section className="accueil__carte" aria-labelledby="accueil-forme">
          <div className="accueil__carte-tete">
            <h2 id="accueil-forme" className="accueil__carte-titre">
              Forme du jour
            </h2>
            <Link to="/stats" className="accueil__carte-lien">
              Détail
            </Link>
          </div>
          <div className="accueil__forme">
            <p className={`accueil__forme-rond accueil__forme-rond--${forme.fraicheur >= -10 && forme.fraicheur <= 25 ? 'bon' : 'attention'}`}>
              <span className="visuellement-cache">Fraîcheur </span>
              {forme.fraicheur > 0 ? `+${forme.fraicheur}` : forme.fraicheur}
            </p>
            <div>
              <p className="accueil__forme-etat">{forme.etat.libelle}</p>
              <p className="accueil__forme-aide">
                Charge sur 7 jours {forme.fatigue} · sur 6 semaines {forme.forme}
              </p>
            </div>
          </div>
          <CourbeForme serie={forme.serie} />
        </section>
      )}
      {derniere && (
        <section className="accueil__carte" aria-labelledby="accueil-derniere">
          <h2 id="accueil-derniere" className="accueil__carte-titre">
            Dernière activité
          </h2>
          <Link to={derniere.vers} className="accueil__derniere">
            <img className="accueil__derniere-puce" src={urlIcone(derniere.icone)} alt="" width={40} height={40} decoding="async" />
            <span className="accueil__derniere-texte">
              <span className="accueil__derniere-titre">
                {derniere.titre} · {dateCourte(derniere.dateIso)}
              </span>
              {derniere.detail && <span className="accueil__derniere-detail">{derniere.detail}</span>}
            </span>
          </Link>
        </section>
      )}
      <CarteDemarrage />
      <h2 className="accueil__libelle accueil__libelle--section">Accès rapides</h2>
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
    </div>
  )
}
