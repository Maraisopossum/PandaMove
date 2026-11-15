import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import { creerCourseHyrox, modifierCourseHyrox } from '../../core/db/repos/hyrox'
import { formaterMinutes } from '../calendar/chargeCalendrier'
import {
  AFFUTAGE_MAX, dureeSemaine, ecrireReglagesPlanHyrox, genererPlanHyrox, LIBELLE_PHASE_HYROX, LIBELLE_TYPE_HYROX, lireReglagesPlanHyrox, REGLAGES_PLAN_HYROX_DEFAUT,
  SEANCES_MAX, SEANCES_MIN, SEMAINES_MAX, SEMAINES_MIN, type PhaseHyrox, type ReglagesPlanHyrox,
} from './planHyrox'
import { useHyrox } from './useHyrox'

const jourCourt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))
const jourLong = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))
const COULEUR: Record<PhaseHyrox, string> = { base: '#5c6b73', construction: '#1565c0', specifique: '#b3261e', affutage: '#2e7d32' }

// Plan de préparation : entièrement réglable (durée, séances par semaine, affûtage, semaines allégées, début ou fin sur la date de course).
// Il se recalcule à chaque réglage ; seuls les réglages sont enregistrés (avec l'objectif).
export default function PlanHyroxScreen() {
  const h = useHyrox()
  if (!h.pret) return <div className="plans hyrox"><h1 className="titre-ecran">Plan de préparation</h1></div>
  return <PlanReglable key={h.objectif?.id ?? 'sans-objectif'} h={h} />
}

function PlanReglable({ h }: { h: ReturnType<typeof useHyrox> }) {
  const objectif = h.objectif
  const aujourdhui = dateIsoLocale(new Date())
  const [r, setR] = useState<ReglagesPlanHyrox>(() => lireReglagesPlanHyrox(objectif?.repartitionJson))
  const [enregistre, setEnregistre] = useState(false)
  const [erreur, setErreur] = useState('')
  const dateCourse = objectif?.date ?? null
  const plan = useMemo(() => genererPlanHyrox(r, dateCourse, aujourdhui), [r, dateCourse, aujourdhui])
  const changer = (suite: Partial<ReglagesPlanHyrox>) => {
    setR((x) => ({ ...x, ...suite }))
    setEnregistre(false)
  }
  const nombre = (v: string, min: number, max: number, defaut: number) => (v === '' ? defaut : Math.min(max, Math.max(min, Math.round(Number(v)) || defaut)))
  const total = plan.reduce((t, s) => t + dureeSemaine(s), 0)
  const finSurCourseActive = r.finSurCourse && dateCourse !== null

  async function enregistrer() {
    setErreur('')
    try {
      const base = getDb()
      if (objectif) {
        await modifierCourseHyrox(base, objectif.id, {
          nom: objectif.nom, lieu: objectif.lieu, date: objectif.date, categorie: objectif.categorie, genre: objectif.genre, objectifS: objectif.objectifS, resultatS: objectif.resultatS,
          repartitionJson: ecrireReglagesPlanHyrox(objectif.repartitionJson, r),
        })
      } else {
        await creerCourseHyrox(base, { nom: 'Préparation Hyrox', categorie: 'open', genre: 'homme', repartitionJson: ecrireReglagesPlanHyrox(null, r) })
      }
      setEnregistre(true)
      h.recharger()
    } catch {
      setErreur('L’enregistrement des réglages a échoué.')
    }
  }

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">Plan de préparation</h1>
      <p className="aide">Réglez la durée et le rythme comme vous voulez : le plan se recalcule tout de suite. Rien n’est imposé, ni 17 semaines, ni une date de course.</p>

      <section className="plans__carte" aria-labelledby="ph-reglages">
        <h2 id="ph-reglages" className="plans__titre">Réglages</h2>
        <div className="plans__formulaire">
          <label className="formulaire__champ">
            Nombre de semaines : {r.semaines}
            <input type="range" min={SEMAINES_MIN} max={SEMAINES_MAX} value={r.semaines} onChange={(e) => changer({ semaines: nombre(e.target.value, SEMAINES_MIN, SEMAINES_MAX, r.semaines) })} />
          </label>
          <label className="formulaire__champ">
            Séances par semaine
            <select value={r.seancesParSemaine} onChange={(e) => changer({ seancesParSemaine: Number(e.target.value) })}>
              {Array.from({ length: SEANCES_MAX - SEANCES_MIN + 1 }, (_, i) => SEANCES_MIN + i).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="formulaire__champ">
            Semaines d’affûtage
            <select value={r.affutageSemaines} onChange={(e) => changer({ affutageSemaines: Number(e.target.value) })}>
              {Array.from({ length: AFFUTAGE_MAX + 1 }, (_, i) => i).map((n) => <option key={n} value={n}>{n === 0 ? 'Aucune' : n}</option>)}
            </select>
          </label>
          <label className="formulaire__champ">
            Semaine allégée
            <select value={r.allegeeToutesLes} onChange={(e) => changer({ allegeeToutesLes: Number(e.target.value) as 0 | 3 | 4 })}>
              <option value={0}>Jamais</option>
              <option value={3}>Toutes les 3 semaines</option>
              <option value={4}>Toutes les 4 semaines</option>
            </select>
          </label>
          <label className="hyrox__case">
            <input type="checkbox" checked={r.simulations} onChange={(e) => changer({ simulations: e.target.checked })} />
            <span>Inclure des simulations chronométrées en phase spécifique</span>
          </label>
          {dateCourse && (
            <label className="hyrox__case">
              <input type="checkbox" checked={r.finSurCourse} onChange={(e) => changer({ finSurCourse: e.target.checked })} />
              <span>Terminer le plan la semaine de la course ({jourLong(dateCourse)})</span>
            </label>
          )}
          {!finSurCourseActive && (
            <label className="formulaire__champ">
              Début du plan (le lundi de cette semaine)
              <input type="date" value={r.debut ?? ''} onChange={(e) => changer({ debut: e.target.value || null })} />
              <span className="aide">Vide : le plan commence cette semaine.</span>
            </label>
          )}
          {erreur && <p role="alert">{erreur}</p>}
          {enregistre && <p role="status" className="plans__niveau" data-niveau="bon">Réglages enregistrés avec votre objectif.</p>}
          <button type="button" className="bouton bouton--principal" onClick={() => void enregistrer()}>Enregistrer les réglages</button>
          <button type="button" className="bouton" onClick={() => changer({ ...REGLAGES_PLAN_HYROX_DEFAUT })}>Rétablir les valeurs par défaut</button>
        </div>
      </section>

      <section className="plans__carte" aria-labelledby="ph-resume">
        <h2 id="ph-resume" className="plans__titre">Résumé</h2>
        <p>{plan.length} semaine{plan.length > 1 ? 's' : ''} du {jourLong(plan[0].debut)} au {jourLong(plan[plan.length - 1].debut)} · {formaterMinutes(total)} au total.</p>
        <ul className="plans__legende">
          {(Object.keys(LIBELLE_PHASE_HYROX) as PhaseHyrox[]).filter((p) => plan.some((s) => s.phase === p)).map((p) => (
            <li key={p}><span className="plans__pastille" style={{ background: COULEUR[p] }} aria-hidden="true" />{LIBELLE_PHASE_HYROX[p]} · {plan.filter((s) => s.phase === p).length}</li>
          ))}
        </ul>
      </section>

      <section aria-label="Semaines du plan" className="hyrox__semaines">
        {plan.map((s) => (
          <article key={s.debut} className="plans__carte" aria-label={`Semaine ${s.rang}`}>
            <h2 className="plans__titre">
              <span><span className="plans__pastille" style={{ background: COULEUR[s.phase] }} aria-hidden="true" /> Semaine {s.rang} · {LIBELLE_PHASE_HYROX[s.phase]}{s.allegee ? ' · allégée' : ''}</span>
              <span className="plans__sous">{formaterMinutes(dureeSemaine(s))}</span>
            </h2>
            <ul className="plans__phases">
              {s.seances.map((x) => (
                <li key={x.date}>
                  <span className="plans__phase-texte">
                    <strong>{jourCourt(x.date)} · {x.titre}</strong>
                    <span className="plans__phase-detail">{LIBELLE_TYPE_HYROX[x.type]} · {formaterMinutes(x.dureeMin)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <Link className="plans__lien" to="/hyrox">Retour à Hyrox</Link>
    </div>
  )
}
