import { useState } from 'react'
import { dateIsoLocale } from '../../core/common/dates'
import { ecart } from '../../core/common/ecart'
import type { Sortie, Sport } from '../../core/db/repos/sorties'
import { duree } from '../home/bilanSemaine'
import { ecrireObjectif, lireObjectif, OBJECTIF_MAX_KM, OBJECTIF_MIN_KM } from './objectif'
import { formaterDuree } from './presentation'
import { bilanHebdo, joursRestants } from './recordsSorties'

const FORMAT_KM = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const km = (m: number) => `${FORMAT_KM.format(m / 1000)} km`
const MAINTENANT = () => new Date()

// Carte « Cette semaine » : distance, objectif réglable (progression, reste à faire), écart au même point de la semaine passée et
// trois chiffres (sorties, durée, allure ou vitesse). Objectif propre à l'appareil. Calculs dans recordsSorties.ts.
export function CarteSemaine({ sport, sorties, maintenant = MAINTENANT }: { sport: Sport; sorties: Sortie[]; maintenant?: () => Date }) {
  const aujourdhui = dateIsoLocale(maintenant())
  const b = bilanHebdo(sorties, sport, aujourdhui)
  const [objectif, setObjectif] = useState<number | null>(() => lireObjectif(sport))
  const [saisie, setSaisie] = useState<string | null>(null)
  const e = ecart(b.distanceM, b.distancePrecedenteM, km)
  const reste = objectif === null ? 0 : Math.max(0, objectif * 1000 - b.distanceM)
  const part = objectif === null ? 0 : Math.min(100, Math.round((b.distanceM / (objectif * 1000)) * 100))
  const jours = joursRestants(aujourdhui)
  const valeur = Number(saisie?.replace(',', '.'))
  const saisieValide = saisie !== null && saisie.trim() !== '' && Number.isFinite(valeur) && valeur >= OBJECTIF_MIN_KM && valeur <= OBJECTIF_MAX_KM
  const rythme =
    b.rythme === null ? '—' : sport === 'course' ? `${formaterDuree(b.rythme)} /km` : `${FORMAT_KM.format(b.rythme)} km/h`

  return (
    <section className="sorties__semaine" aria-labelledby={`semaine-${sport}`}>
      <div className="sorties__semaine-tete">
        <h2 id={`semaine-${sport}`}>Cette semaine</h2>
        <button type="button" className="sorties__semaine-lien" onClick={() => setSaisie(objectif === null ? '' : String(objectif).replace('.', ','))}>
          {objectif === null ? 'Définir un objectif' : 'Modifier l’objectif'}
        </button>
      </div>

      {saisie !== null && (
        <form
          className="sorties__objectif-form"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (!saisieValide) return
            ecrireObjectif(sport, valeur)
            setObjectif(Math.round(valeur * 10) / 10)
            setSaisie(null)
          }}
        >
          <label>
            Objectif de la semaine (km)
            <input inputMode="decimal" value={saisie} autoFocus onChange={(ev) => setSaisie(ev.target.value)} />
          </label>
          {saisie.trim() !== '' && !saisieValide && (
            <p role="alert" className="sorties__objectif-erreur">
              Entre {OBJECTIF_MIN_KM} et {OBJECTIF_MAX_KM} km.
            </p>
          )}
          <div className="sorties__objectif-actions">
            <button type="button" className="bouton" onClick={() => setSaisie(null)}>
              Annuler
            </button>
            {objectif !== null && (
              <button
                type="button"
                className="bouton"
                onClick={() => {
                  ecrireObjectif(sport, null)
                  setObjectif(null)
                  setSaisie(null)
                }}
              >
                Retirer
              </button>
            )}
            <button type="submit" className="bouton bouton--principal" disabled={!saisieValide}>
              Enregistrer
            </button>
          </div>
        </form>
      )}

      <div className="sorties__semaine-haut">
        <p className="sorties__semaine-distance">
          <span className="sorties__semaine-valeur">{FORMAT_KM.format(b.distanceM / 1000)}</span> km
          {objectif !== null && <span className="sorties__semaine-objectif"> sur un objectif de {FORMAT_KM.format(objectif)} km</span>}
        </p>
        <p className={`sorties__ecart sorties__ecart--${e.sens}`}>
          {e.sens === 'hausse' ? '↑ ' : e.sens === 'baisse' ? '↓ ' : ''}
          {e.texte}
          <span className="visuellement-cache"> par rapport à la semaine passée</span>
        </p>
      </div>

      {objectif !== null && (
        <>
          <div role="progressbar" aria-label="Objectif hebdomadaire" aria-valuemin={0} aria-valuemax={objectif} aria-valuenow={Math.round(b.distanceM / 100) / 10} className="sorties__progression">
            <span style={{ width: `${part}%` }} />
          </div>
          <p className="sorties__semaine-reste">
            {reste === 0
              ? 'Objectif atteint : bravo.'
              : `Encore ${km(reste)} pour l’atteindre${jours === 0 ? ', dernier jour de la semaine.' : `, il reste ${jours} jour${jours > 1 ? 's' : ''}.`}`}
          </p>
        </>
      )}

      <dl className="sorties__semaine-trio">
        <div>
          <dd>{b.nombre}</dd>
          <dt>{b.nombre > 1 ? 'sorties' : 'sortie'}</dt>
        </div>
        <div>
          <dd>{b.dureeS > 0 ? duree(b.dureeS) : '—'}</dd>
          <dt>{sport === 'course' ? 'de course' : 'de vélo'}</dt>
        </div>
        <div>
          <dd>{rythme}</dd>
          <dt>{sport === 'course' ? 'en moyenne' : 'de moyenne'}</dt>
        </div>
      </dl>
    </section>
  )
}
