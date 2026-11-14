import { useCallback, useEffect, useState } from 'react'
import { urlIcone } from '../../app/modules'
import { getDb } from '../../core/db/client'
import type { DbLecture } from '../../core/db/Db'
import { ecrireObjectif, lireObjectif, OBJECTIF_MAX_KM, OBJECTIF_MIN_KM } from '../endurance/objectif'
import {
  ecrireObjectifQuotidien, OBJECTIF_QUOTIDIEN_MAX, OBJECTIF_QUOTIDIEN_MIN, lireObjectifQuotidien,
} from '../respiration/reglages'
import { ecrireObjectifsPerso, LIMITES_OBJECTIFS, lireObjectifsPerso, lireProgressionObjectifs, type ProgressionObjectif } from './objectifs'

const MAINTENANT = () => new Date()

interface Champ {
  id: 'seancesSemaine' | 'mobiliteSemaine' | 'distanceAnnee' | 'course' | 'velo' | 'respiration'
  libelle: string
  aide: string
  min: number
  max: number
  decimal?: boolean
  /** Vide permis : pas d'objectif pour ce champ (la respiration garde toujours un objectif quotidien). */
  facultatif: boolean
}

const CHAMPS: Champ[] = [
  { id: 'seancesSemaine', libelle: 'Séances par semaine', aide: 'Séances terminées de l’agenda (renforcement, course, vélo)', min: LIMITES_OBJECTIFS.seancesSemaine[0], max: LIMITES_OBJECTIFS.seancesSemaine[1], facultatif: true },
  { id: 'course', libelle: 'Course par semaine (km)', aide: 'Réglable aussi dans la liste Course', min: OBJECTIF_MIN_KM, max: OBJECTIF_MAX_KM, decimal: true, facultatif: true },
  { id: 'velo', libelle: 'Vélo par semaine (km)', aide: 'Réglable aussi dans la liste Vélo', min: OBJECTIF_MIN_KM, max: OBJECTIF_MAX_KM, decimal: true, facultatif: true },
  { id: 'distanceAnnee', libelle: 'Distance de l’année (km)', aide: 'Course et vélo, du 1er janvier au 31 décembre', min: LIMITES_OBJECTIFS.distanceAnnee[0], max: LIMITES_OBJECTIFS.distanceAnnee[1], facultatif: true },
  { id: 'mobiliteSemaine', libelle: 'Séances de mobilité par semaine', aide: 'Séances menées jusqu’au bout', min: LIMITES_OBJECTIFS.mobiliteSemaine[0], max: LIMITES_OBJECTIFS.mobiliteSemaine[1], facultatif: true },
  { id: 'respiration', libelle: 'Respiration par jour (min)', aide: 'Objectif quotidien de l’écran Respiration', min: OBJECTIF_QUOTIDIEN_MIN, max: OBJECTIF_QUOTIDIEN_MAX, facultatif: false },
]

function valeursActuelles(): Record<Champ['id'], string> {
  const p = lireObjectifsPerso()
  const t = (v: number | null) => (v === null ? '' : String(v).replace('.', ','))
  return {
    seancesSemaine: t(p.seancesSemaine), mobiliteSemaine: t(p.mobiliteSemaine), distanceAnnee: t(p.distanceAnnee),
    course: t(lireObjectif('course')), velo: t(lireObjectif('velo')), respiration: String(lireObjectifQuotidien()),
  }
}

// Lecture d'un champ : null = vide, NaN = invalide, sinon la valeur (entier, ou décimal pour les kilomètres hebdomadaires).
function lire(c: Champ, texte: string): number | null {
  const t = texte.trim().replace(',', '.')
  if (t === '') return null
  const v = Number(t)
  if (!Number.isFinite(v) || v < c.min || v > c.max || (!c.decimal && !Number.isInteger(v))) return Number.NaN
  return v
}

// « Mes objectifs » du profil : avancement de chaque objectif défini et formulaire de réglage. Objectifs propres à l'appareil.
// Calculs dans objectifs.ts.
export function ObjectifsSection({ db, maintenant = MAINTENANT }: { db?: DbLecture; maintenant?: () => Date }) {
  const [progression, setProgression] = useState<ProgressionObjectif[] | null>(null)
  const [edition, setEdition] = useState<Record<Champ['id'], string> | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let annule = false
    lireProgressionObjectifs(db ?? getDb(), maintenant())
      .then((p) => !annule && setProgression(p))
      .catch((e: unknown) => {
        console.error('Progression des objectifs impossible', e)
        if (!annule) setProgression([])
      })
    return () => {
      annule = true
    }
    // « Maintenant » est lu au chargement et après chaque enregistrement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, version])

  const erreurs = edition ? CHAMPS.filter((c) => Number.isNaN(lire(c, edition[c.id]))).map((c) => c.id) : []
  const enregistrer = useCallback(() => {
    if (!edition) return
    const v = Object.fromEntries(CHAMPS.map((c) => [c.id, lire(c, edition[c.id])])) as Record<Champ['id'], number | null>
    if (Object.values(v).some((x) => x !== null && Number.isNaN(x))) return
    ecrireObjectifsPerso({ seancesSemaine: v.seancesSemaine, distanceAnnee: v.distanceAnnee, mobiliteSemaine: v.mobiliteSemaine })
    ecrireObjectif('course', v.course)
    ecrireObjectif('velo', v.velo)
    if (v.respiration !== null) ecrireObjectifQuotidien(v.respiration)
    setEdition(null)
    setVersion((n) => n + 1)
  }, [edition])

  return (
    <section className="profil__carte" aria-labelledby="profil-objectifs">
      <div className="profil__carte-tete">
        <h2 id="profil-objectifs">Mes objectifs</h2>
        {!edition && (
          <button type="button" className="profil__lien-texte-bouton" onClick={() => setEdition(valeursActuelles())}>
            {progression && progression.length > 0 ? 'Modifier' : 'Définir'}
          </button>
        )}
      </div>

      {edition ? (
        <form
          className="profil__objectifs-form"
          onSubmit={(e) => {
            e.preventDefault()
            enregistrer()
          }}
        >
          {CHAMPS.map((c) => (
            <div key={c.id} className="formulaire__champ">
              <label htmlFor={`obj-${c.id}`}>{c.libelle}</label>
              <input
                id={`obj-${c.id}`}
                inputMode="decimal"
                value={edition[c.id]}
                aria-invalid={erreurs.includes(c.id)}
                aria-describedby={`obj-${c.id}-aide`}
                onChange={(e) => setEdition({ ...edition, [c.id]: e.target.value })}
              />
              <p id={`obj-${c.id}-aide`} className={erreurs.includes(c.id) ? 'formulaire__erreur' : 'aide'} role={erreurs.includes(c.id) ? 'alert' : undefined}>
                {erreurs.includes(c.id) ? `Entre ${c.min} et ${c.max}${c.decimal ? '' : ' (nombre entier)'}.` : `${c.aide}${c.facultatif ? ' · vide : pas d’objectif' : ''}`}
              </p>
            </div>
          ))}
          <div className="formulaire__ligne">
            <button type="button" className="bouton" onClick={() => setEdition(null)}>
              Annuler
            </button>
            <button type="submit" className="bouton bouton--principal" disabled={erreurs.length > 0}>
              Enregistrer
            </button>
          </div>
        </form>
      ) : progression === null ? (
        <p className="aide">Chargement…</p>
      ) : progression.length === 0 ? (
        <p className="aide">Aucun objectif pour l’instant. Définissez par exemple 4 séances par semaine ou 3 000 km dans l’année.</p>
      ) : (
        <ul className="profil__objectifs">
          {progression.map((o) => (
            <li key={o.id}>
              <span className="profil__objectif-ligne">
                <span className="profil__objectif-nom">
                  <img src={urlIcone(o.icone)} alt="" width={28} height={28} decoding="async" />
                  {o.nom}
                </span>
                <span className="profil__objectif-valeur">{o.valeur}</span>
              </span>
              <span role="progressbar" aria-label={o.nom} aria-valuemin={0} aria-valuemax={100} aria-valuenow={o.pct} className="profil__objectif-piste">
                <span className={o.atteint ? 'profil__objectif-barre profil__objectif-barre--atteint' : 'profil__objectif-barre'} style={{ width: `${o.pct}%` }} />
              </span>
              <span className="aide">{o.detail}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="aide">Les objectifs restent sur cet appareil. Ceux de la semaine en cours s’affichent aussi à l’accueil.</p>
    </section>
  )
}
