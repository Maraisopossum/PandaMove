import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { Sport } from '../../core/db/repos/sorties'
import { DialogueConfirmation } from '../strength/edition/DialogueConfirmation'
import { lienValide } from '../calendar/seancesCardio/lienValide'
import { CHEMIN_SPORT } from './chemins'
import { distanceKm, formaterDate, formaterDuree, formaterRythme } from './presentation'
import { AnalyseSortieBloc } from './AnalyseSortieBloc'
import { BandeauSortie } from './BandeauSortie'
import { TraceSortie } from './TraceSortie'
import { useSeanceLiee } from './useSeanceLiee'
import { useToutesLesSorties } from './useRecordsSorties'
import { useSortie } from './useSorties'

// Détail d'une sortie (`/running/:id`, `/cycling/:id`) : métriques, notes, lien, modification et suppression.
export default function SortieDetailScreen({ sport }: { sport: Sport }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sortie: s, chargement, introuvable, erreur, supprimer } = useSortie(id)
  const [confirmer, setConfirmer] = useState(false)
  const liee = useSeanceLiee(s)
  // Toutes les sorties : comparaison avec les précédentes, records, FTP et FC max estimées
  const { sorties: toutes, charge: toutesChargees } = useToutesLesSorties()
  const chemin = CHEMIN_SPORT[sport]

  if (chargement) return <p role="status">Chargement…</p>
  if (introuvable || !s || s.sport !== sport) {
    return (
      <div className={`sorties sorties--${sport}`}>
        <h1 className="titre-ecran">Sortie introuvable</h1>
        <p>Cette sortie n’existe plus.</p>
        <Link to={chemin} className="bouton">
          Retour aux sorties
        </Link>
      </div>
    )
  }

  const rythme = formaterRythme(s)
  const lien = lienValide(s.lien)
  // Chiffres secondaires, en lignes libellé / valeur (les trois principaux sont dans l'encadré du haut)
  const lignes: [string, string | null][] = [
    ['Dénivelé positif', s.denivelePosM !== null ? `${Math.round(s.denivelePosM)} m` : null],
    ['FC moyenne', s.fcMoy !== null ? `${s.fcMoy} bpm` : null],
    ['FC maximale', s.fcMax !== null ? `${s.fcMax} bpm` : null],
    ['RPE', s.rpe !== null ? `${s.rpe} / 10` : null],
  ]
  const uniteRythme = sport === 'course' ? '/km' : 'km/h'
  const valeurRythme = rythme?.replace(/\s*(\/km|km\/h)$/, '') ?? null

  return (
    <div className={`sorties sorties--${sport}`}>
      <BandeauSortie sortie={s} />

      {(s.distanceM !== null || s.dureeS !== null || rythme) && (
        <section className="sorties__principal" aria-label="Chiffres principaux">
          {s.distanceM !== null && (
            <p className="sorties__grand">
              <span className="visuellement-cache">Distance : </span>
              {distanceKm(s.distanceM)}
              <span className="sorties__grand-unite">km</span>
            </p>
          )}
          <dl className="sorties__duo">
            {s.dureeS !== null && (
              <div>
                <dt>Durée</dt>
                <dd>{formaterDuree(s.dureeS)}</dd>
              </div>
            )}
            {valeurRythme && (
              <div>
                <dt>{sport === 'course' ? 'Allure' : 'Vitesse moyenne'}</dt>
                <dd>
                  {valeurRythme}
                  <span className="sorties__unite">{uniteRythme}</span>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <dl className="sorties__details">
        {lignes
          .filter((l): l is [string, string] => l[1] !== null)
          .map(([libelle, valeur]) => (
            <div key={libelle} className="sorties__detail">
              <dt>{libelle}</dt>
              <dd>{valeur}</dd>
            </div>
          ))}
      </dl>

      <TraceSortie sortie={s} />

      {toutesChargees && <AnalyseSortieBloc sortie={s} toutes={toutes} />}

      {liee && (
        <p className="sorties__liee">
          <strong>Liée à « {liee.titre} »</strong>, {formaterDate(liee.date)}. {liee.isValidated ? 'Séance validée.' : ''}
        </p>
      )}

      {s.notes && <p className="sorties__notes">{s.notes}</p>}
      {s.lien &&
        (lien.ok && lien.valeur ? (
          <a className="sorties__lien" href={lien.valeur} target="_blank" rel="noopener noreferrer">
            Voir l’activité
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </a>
        ) : (
          <p>{s.lien}</p>
        ))}

      {erreur && <p role="alert">{erreur}</p>}

      <div className="sorties__actions-bas">
        <Link to={chemin} className="sorties__retour">
          Retour
        </Link>
        <button type="button" className="bouton bouton--alerte" onClick={() => setConfirmer(true)}>
          Supprimer
        </button>
        <Link to={`${chemin}/${s.id}/edit`} className="sorties__principal-bouton">
          Modifier
        </Link>
      </div>

      {confirmer && (
        <DialogueConfirmation
          titre="Supprimer cette sortie ?"
          libelleConfirmer="Supprimer"
          libelleAnnuler="Annuler"
          onAnnuler={() => setConfirmer(false)}
          onConfirmer={() => {
            setConfirmer(false)
            void supprimer().then((ok) => ok && navigate(chemin))
          }}
        >
          <p>« {s.titre} » du {formaterDate(s.date)} sera supprimée.</p>
        </DialogueConfirmation>
      )}
    </div>
  )
}
