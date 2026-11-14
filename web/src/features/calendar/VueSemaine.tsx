import { useState } from 'react'
import { formaterMinutes, libelleSemaine, type ChargeSemaine, type NiveauCharge } from './chargeCalendrier'
import { LIBELLE_GENRE, peutDeplacer } from './evenements'
import type { EvenementAgenda, JourVue } from './types'

const LIBELLE_NIVEAU: Record<NiveauCharge, string> = { bas: 'légère', moyen: 'soutenue', haut: 'élevée' }

/** « Mardi 17 » : jour de la semaine et numéro, première lettre en capitale. */
function nomJour(dateIso: string): string {
  const [a, m, j] = dateIso.split('-').map(Number)
  const t = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(new Date(a, m - 1, j, 12))
  return `${t.charAt(0).toUpperCase()}${t.slice(1)} ${j}`
}

/** Carte d'alerte indicative : semaine chargée, jours d'affilée et jour libre conseillé. Rien hors niveau « élevé ». */
export function AlerteSemaine({ charge }: { charge: ChargeSemaine }) {
  if (charge.niveau !== 'haut') return null
  const debut = charge.debut
  const nom = (iso: string) => nomJour(iso).split(' ')[0].toLowerCase()
  return (
    <section className="calendrier__alerte" aria-labelledby="calendrier-alerte">
      <h2 id="calendrier-alerte">Semaine du {libelleSemaine(debut)} chargée</h2>
      <p>
        {charge.seances} séance{charge.seances > 1 ? 's' : ''} prévue{charge.seances > 1 ? 's' : ''}
        {charge.suite.longueur >= 3 && charge.suite.debut && charge.suite.fin ? ` dont ${charge.suite.longueur} jours d’affilée (${nom(charge.suite.debut)} à ${nom(charge.suite.fin)})` : ''}
        {charge.ecartPct !== null ? ` : charge estimée ${charge.ecartPct} % au-dessus de votre moyenne` : ` : ${formaterMinutes(charge.minutes)} prévues`}.
        {charge.jourLibre ? ` Déplacez une séance vers ${nom(charge.jourLibre)}, jour libre.` : ''}
      </p>
      <p className="aide">Indicatif : estimation d’après la durée prévue de chaque séance.</p>
    </section>
  )
}

// Vue semaine : répartition du temps prévu par jour, et pour chaque jour ses séances avec « Déplacer » (liste des autres jours
// de la semaine, ou « Autre date… ») ; sur ordinateur, une séance se glisse aussi sur un jour. Une séance terminée ne se déplace
// pas. Logique dans useEcranCalendrier et chargeCalendrier.ts.
export function VueSemaine({
  jours, charge, onDeplacer, onAutreDate,
}: {
  jours: JourVue[]
  charge: ChargeSemaine
  onDeplacer: (e: EvenementAgenda, dateIso: string) => void
  onAutreDate: (e: EvenementAgenda) => void
}) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [survol, setSurvol] = useState<string | null>(null)
  const max = Math.max(60, ...charge.jours.map((j) => j.minutes))
  const resume = charge.jours.filter((j) => j.minutes > 0).map((j) => `${nomJour(j.dateIso).split(' ')[0].toLowerCase()} ${formaterMinutes(j.minutes)}`).join(', ')

  return (
    <>
      <section className="calendrier__repartition" aria-labelledby="calendrier-repartition">
        <h2 id="calendrier-repartition">Répartition de la semaine</h2>
        <ul className="calendrier__repartition-liste" aria-label={`Temps prévu par jour : ${resume || 'aucune séance'}`}>
          {charge.jours.map((j) => (
            <li key={j.dateIso}>
              <span className="calendrier__repartition-jour">{nomJour(j.dateIso).charAt(0)}</span>
              <span className="calendrier__repartition-piste" aria-hidden="true">
                <span className={`calendrier__repartition-barre calendrier__repartition-barre--${charge.niveau}`} style={{ width: `${Math.round((j.minutes / max) * 100)}%` }} />
              </span>
              <span className="calendrier__repartition-duree">{formaterMinutes(j.minutes)}</span>
            </li>
          ))}
        </ul>
        <p className="aide">Charge estimée : {LIBELLE_NIVEAU[charge.niveau]}.</p>
      </section>

      <section aria-labelledby="calendrier-deplacer" className="calendrier__section">
        <div className="calendrier__section-tete">
          <h2 id="calendrier-deplacer">Déplacer une séance</h2>
          <span className="aide">Glisser sur un jour, ou « Déplacer »</span>
        </div>
        <ol className="calendrier__jours-semaine">
          {jours.map((j) => {
            const c = charge.jours.find((x) => x.dateIso === j.dateIso)
            const libre = charge.jourLibre === j.dateIso && charge.niveau === 'haut'
            return (
              <li
                key={j.dateIso}
                className={`calendrier__jour-semaine${libre ? ' calendrier__jour-semaine--libre' : ''}${survol === j.dateIso ? ' calendrier__jour-semaine--survol' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setSurvol(j.dateIso)
                }}
                onDragLeave={() => setSurvol(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setSurvol(null)
                  const id = e.dataTransfer.getData('text/plain')
                  const evenement = jours.flatMap((x) => x.evenements).find((x) => x.id === id)
                  if (evenement && evenement.dateIso !== j.dateIso && peutDeplacer(evenement)) onDeplacer(evenement, j.dateIso)
                }}
              >
                <div className="calendrier__jour-semaine-tete">
                  <strong>{nomJour(j.dateIso)}</strong>
                  <span className={libre ? 'calendrier__jour-etat calendrier__jour-etat--libre' : 'calendrier__jour-etat'}>
                    {libre ? 'Jour libre conseillé' : c && c.minutes > 0 ? `${formaterMinutes(c.minutes)}${charge.niveau === 'haut' && c.minutes >= 90 ? ' · chargé' : ''}` : 'Repos'}
                  </span>
                </div>
                {j.evenements.length > 0 && (
                  <ul className="calendrier__jour-seances">
                    {j.evenements.map((e) => (
                      <li
                        key={e.id}
                        className={`calendrier__seance-semaine calendrier__seance-semaine--${e.genre}`}
                        draggable={peutDeplacer(e)}
                        onDragStart={(ev) => ev.dataTransfer.setData('text/plain', e.id)}
                      >
                        <span className="calendrier__seance-texte">
                          <strong>{e.titre}</strong>
                          <span className="aide">
                            {LIBELLE_GENRE[e.genre]}
                            {e.etat === 'terminee' ? ' · terminée' : ''}
                          </span>
                        </span>
                        {peutDeplacer(e) && (
                          <button type="button" className="bouton" aria-expanded={ouvert === e.id} aria-label={`Déplacer ${e.titre}`} onClick={() => setOuvert(ouvert === e.id ? null : e.id)}>
                            Déplacer
                          </button>
                        )}
                        {ouvert === e.id && (
                          <div role="group" aria-label={`Déplacer ${e.titre} vers`} className="calendrier__choix-jour">
                            {charge.jours
                              .filter((x) => x.dateIso !== e.dateIso)
                              .map((x) => (
                                <button
                                  key={x.dateIso}
                                  type="button"
                                  className="bouton"
                                  onClick={() => {
                                    setOuvert(null)
                                    onDeplacer(e, x.dateIso)
                                  }}
                                >
                                  {nomJour(x.dateIso)}
                                  <span className="aide"> · {x.seances === 0 ? 'repos' : formaterMinutes(x.minutes)}</span>
                                </button>
                              ))}
                            <button
                              type="button"
                              className="bouton"
                              onClick={() => {
                                setOuvert(null)
                                onAutreDate(e)
                              }}
                            >
                              Autre date…
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </>
  )
}
