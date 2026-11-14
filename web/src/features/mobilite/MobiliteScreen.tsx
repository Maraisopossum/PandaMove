import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { BarreActionsFlottante } from '../../app/BarreActionsFlottante'
import { urlIcone } from '../../app/modules'
import { useAuth } from '../../core/auth/AuthProvider'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { useImagePanda } from '../../core/images/usePandaVariante'
import { formaterDate } from '../endurance/presentation'
import { DUREES_MIN, EXERCICES, LIBELLE_TYPE, MOMENTS, SEANCES_TYPES, TOUS_TYPES, ZONES } from './donnees'
import { detailRoutine } from './routines'
import { useChoixMobilite } from './useChoixMobilite'

const AIDE_TYPE: Record<(typeof TOUS_TYPES)[number], string> = {
  mobilite: 'cercles, fentes dynamiques, rotations',
  activation: 'pont, bird-dog, clam',
  etirement: 'positions tenues',
}
const PARTITIF: Record<(typeof TOUS_TYPES)[number], string> = { mobilite: 'de mobilité', activation: 'd’activation', etirement: 'd’étirement' }
const NOMBRE_PAR_TYPE = Object.fromEntries(TOUS_TYPES.map((t) => [t, EXERCICES.filter((e) => e.type === t).length])) as Record<(typeof TOUS_TYPES)[number], number>

// Mobilité : routines enregistrées, temps disponible, séance type, types d'exercices, zones à cibler et moment ; « Générer »
// prépare la séance annoncée sous « Au programme » et ouvre l'aperçu. La logique est dans useChoixMobilite et generer.ts.
export default function MobiliteScreen() {
  const { session } = useAuth()
  const panda = useImagePanda('yoga', { userId: session?.user.id, taille: 'lg' })
  const navigate = useNavigate()
  const m = useChoixMobilite()
  const { choix } = m
  // Formulaire d'enregistrement d'une routine : nom proposé, modifiable
  const [nomRoutine, setNomRoutine] = useState<string | null>(null)
  const vide = m.apercu.etapes.length === 0

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

      <section aria-labelledby="mob-routines" className="mobilite__section">
        <div className="mobilite__section-tete">
          <h2 id="mob-routines">Mes routines</h2>
          <Link to="/mobility/routines" className="mobilite__lien">
            {m.routines.length > 0 ? 'Gérer' : 'Régularité'}
          </Link>
        </div>
        {m.routines.length === 0 ? (
          <p className="aide">Aucune routine pour l’instant. Réglez une séance ci-dessous, puis touchez « Enregistrer » pour la relancer en un geste.</p>
        ) : (
          <ul className="mobilite__routines">
            {m.routines.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="mobilite__routine"
                  onClick={() => {
                    m.lancerRoutine(r.choix)
                    navigate('/mobility/apercu')
                  }}
                >
                  <span className="mobilite__routine-nom">{r.nom}</span>
                  <span className="mobilite__routine-detail">{detailRoutine(r.choix)}</span>
                  <span className="mobilite__routine-action">Lancer</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

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

      <section aria-labelledby="mob-types" className="mobilite__section">
        <div className="mobilite__section-tete">
          <h2 id="mob-types">Types d’exercices</h2>
          <span className="aide">au moins un</span>
        </div>
        <div role="group" aria-label="Types d’exercices" className="mobilite__types">
          {TOUS_TYPES.map((t) => (
            <button key={t} type="button" className="mobilite__type" aria-pressed={choix.types.includes(t)} onClick={() => m.basculerType(t)}>
              <strong>{LIBELLE_TYPE[t]}</strong>
              <span>{NOMBRE_PAR_TYPE[t]} exercices</span>
            </button>
          ))}
        </div>
        <p className="aide">{TOUS_TYPES.map((t) => `${LIBELLE_TYPE[t]} : ${AIDE_TYPE[t]}`).join('. ')}.</p>
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

      <section aria-labelledby="mob-programme" className="mobilite__section mobilite__programme">
        <h2 id="mob-programme">Au programme</h2>
        {vide ? (
          <p role="status" className="aide">
            Aucun exercice ne correspond à ces zones et à ces types : ajoutez un type ou une zone.
          </p>
        ) : (
          <>
            <p role="status">
              {m.apercu.etapes.length} exercices · {Math.round(m.apercu.dureeTotaleS / 60)} min ·{' '}
              {TOUS_TYPES.filter((t) => m.apercu.etapes.some((e) => e.exercice.type === t))
                .map((t) => `${m.apercu.etapes.filter((e) => e.exercice.type === t).length} ${PARTITIF[t]}`)
                .join(', ')}
            </p>
            <p className="aide">
              {m.apercu.etapes.slice(0, 4).map((e) => e.exercice.nom).join(', ')}
              {m.apercu.etapes.length > 4 ? '…' : ''}
            </p>
          </>
        )}
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

      {nomRoutine !== null && (
        <form
          className="mobilite__enregistrer"
          onSubmit={(e) => {
            e.preventDefault()
            if (nomRoutine.trim() === '') return
            m.enregistrerRoutine(nomRoutine)
            setNomRoutine(null)
          }}
        >
          <label>
            Nom de la routine
            <input value={nomRoutine} maxLength={40} autoFocus onChange={(e) => setNomRoutine(e.target.value)} />
          </label>
          <div className="mobilite__commandes">
            <button type="button" className="bouton" onClick={() => setNomRoutine(null)}>
              Annuler
            </button>
            <button type="submit" className="bouton bouton--principal" disabled={nomRoutine.trim() === ''}>
              Enregistrer la routine
            </button>
          </div>
        </form>
      )}

      <BarreActionsFlottante
        libelle="Actions de la mobilité"
        secondaire={
          <button type="button" className="bouton" disabled={vide} onClick={() => setNomRoutine(m.nomPropose)}>
            Enregistrer
          </button>
        }
        principal={
          <button
            type="button"
            className="bouton bouton--principal"
            disabled={vide}
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
