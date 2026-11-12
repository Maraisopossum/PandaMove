import { useNavigate } from 'react-router'
import { BarreActionsFlottante } from '../../app/BarreActionsFlottante'
import { urlIcone } from '../../app/modules'
import { useAuth } from '../../core/auth/AuthProvider'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { formaterDate } from '../endurance/presentation'
import { DUREES_MIN, MOMENTS, SEANCES_TYPES, ZONES } from './donnees'
import { useChoixMobilite } from './useChoixMobilite'

// Mobilité : choix du temps disponible, d'une séance type (sport), des zones à cibler et du moment ; « Générer » prépare la
// séance et ouvre l'aperçu. La logique est dans useChoixMobilite et generer.ts.
export default function MobiliteScreen() {
  const { session } = useAuth()
  const panda = useImagePanda('pose_sitting', { userId: session?.user.id, taille: 'lg' })
  const navigate = useNavigate()
  const m = useChoixMobilite()
  const { choix } = m

  return (
    <div className="mobilite">
      <header className="mobilite__hero">
        <div>
          <h1 className="titre-ecran">Mobilité</h1>
          <p className="mobilite__accroche">Une séance sur mesure, selon le temps que vous avez et les zones à relâcher.</p>
        </div>
        <PandaIllustration image={panda} sizes="96px" decoratif className="mobilite__panda" />
      </header>

      {m.bilan.seances > 0 && (
        <p className="mobilite__bilan">
          Cette semaine : {m.bilan.seances} séance{m.bilan.seances > 1 ? 's' : ''}, {m.bilan.minutes} min de mobilité.
        </p>
      )}

      <section aria-labelledby="mob-temps" className="mobilite__section">
        <h2 id="mob-temps">Temps disponible</h2>
        <div role="group" aria-label="Durée de la séance" className="mobilite__durees">
          {DUREES_MIN.map((d) => (
            <button key={d} type="button" className="mobilite__duree" aria-label={`${d} minutes`} aria-pressed={choix.minutes === d} onClick={() => m.choisirMinutes(d)}>
              <strong>{d}</strong>
              <span>min</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="mob-sport" className="mobilite__section">
        <h2 id="mob-sport">Séance type</h2>
        <ul className="mobilite__sports">
          {SEANCES_TYPES.map((s) => (
            <li key={s.id}>
              <button type="button" className="mobilite__sport" aria-pressed={choix.sport === s.id} onClick={() => m.choisirSport(s.id)}>
                <img src={urlIcone(s.icone)} alt="" width={40} height={40} decoding="async" />
                <span>
                  <strong>{s.libelle}</strong>
                  <span className="mobilite__sport-texte">{s.texte}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="mob-zones" className="mobilite__section">
        <h2 id="mob-zones">Zones à cibler</h2>
        <div role="group" aria-label="Zones du corps" className="mobilite__zones">
          <button type="button" className="mobilite__zone" aria-pressed={choix.zones.length === 0} onClick={m.toutesLesZones}>
            Tout le corps
          </button>
          {ZONES.map((z) => (
            <button key={z.id} type="button" className="mobilite__zone" aria-pressed={choix.zones.includes(z.id)} onClick={() => m.basculerZone(z.id)}>
              {z.libelle}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="mob-moment" className="mobilite__section">
        <h2 id="mob-moment">Moment</h2>
        <div role="group" aria-label="Moment de la séance" className="mobilite__moments">
          {MOMENTS.map((x) => (
            <button key={x.id} type="button" className="mobilite__moment" aria-pressed={choix.moment === x.id} onClick={() => m.choisirMoment(x.id)}>
              {x.libelle}
            </button>
          ))}
        </div>
        <p className="aide">{MOMENTS.find((x) => x.id === choix.moment)?.aide}</p>
      </section>

      {m.historique.length > 0 && (
        <section aria-labelledby="mob-historique" className="mobilite__section">
          <h2 id="mob-historique">Dernières séances</h2>
          <ul className="mobilite__historique">
            {m.historique.slice(0, 3).map((s, i) => (
              <li key={`${s.date}|${i}`}>
                <span>{formaterDate(s.date)}</span>
                <span>
                  {Math.round(s.dureeS / 60)} min · {s.exercices} exercices
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BarreActionsFlottante
        libelle="Actions de la mobilité"
        principal={
          <button
            type="button"
            className="bouton bouton--principal"
            onClick={() => {
              m.generer()
              navigate('/mobility/apercu')
            }}
          >
            Générer ma séance de {choix.minutes} min
          </button>
        }
      />
    </div>
  )
}
