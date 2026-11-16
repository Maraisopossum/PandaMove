import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { getDb } from '../../core/db/client'
import { enregistrerObjectifsNutrition, lireObjectifsNutrition } from '../../core/db/repos/nutrition'
import {
  kcalDesMacros, LIBELLE_ACTIVITE, LIBELLE_BUT, metabolismeDeBase, proposerObjectifs, repartitionEnergie, verifierProfil, type Activite, type But, type ObjectifsNutrition, type ProfilNutrition, type Sexe,
} from '../../core/nutrition/calculs'
import { lireMensurations } from '../profile/poids'
import { entier, decimal } from './outils'

const PROFIL_DEFAUT: ProfilNutrition = { sexe: 'homme', age: 35, tailleCm: 175, poidsKg: 75, activite: 'moderee', but: 'maintien' }
const OBJECTIFS_DEFAUT: ObjectifsNutrition = { kcal: 2400, proteinesG: 120, glucidesG: 280, lipidesG: 75, eauMl: 2500 }

function profilLu(json: string | null): ProfilNutrition | null {
  if (!json) return null
  try {
    const p = JSON.parse(json) as Partial<ProfilNutrition>
    const complet = { ...PROFIL_DEFAUT, ...p }
    return verifierProfil(complet) === null && ['homme', 'femme'].includes(complet.sexe) && complet.activite in LIBELLE_ACTIVITE && complet.but in LIBELLE_BUT ? complet : null
  } catch {
    return null
  }
}

function Nombre({ libelle, valeur, onChange, unite, min, max }: { libelle: string; valeur: number; onChange: (v: number) => void; unite: string; min: number; max: number }) {
  return (
    <label className="formulaire__champ">
      {libelle} ({unite})
      <input type="number" inputMode="decimal" min={min} max={max} step="any" value={Number.isFinite(valeur) ? valeur : ''} onChange={(e) => onChange(e.target.value === '' ? Number.NaN : Number(e.target.value))} />
    </label>
  )
}

// Objectifs quotidiens : énergie, protéines, glucides, lipides, eau. Un calculateur propose un point de départ (Mifflin-St Jeor + but) ;
// tout reste modifiable à la main. Le poids (dernière pesée) et la taille viennent du Profil : ils ne se ressaisissent pas ici.
export default function ObjectifsNutritionScreen() {
  const navigate = useNavigate()
  const [profil, setProfil] = useState<ProfilNutrition>(PROFIL_DEFAUT)
  const [mensurations] = useState(lireMensurations)
  const [o, setO] = useState<ObjectifsNutrition>(OBJECTIFS_DEFAUT)
  const [pret, setPret] = useState(false)
  const [erreur, setErreur] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let annule = false
    lireObjectifsNutrition(getDb())
      .then((actuel) => {
        if (annule) return
        if (actuel) setO({ kcal: actuel.kcal, proteinesG: actuel.proteinesG, glucidesG: actuel.glucidesG, lipidesG: actuel.lipidesG, eauMl: actuel.eauMl })
        const p = profilLu(actuel?.profilJson ?? null)
        if (p) setProfil(p)
        setPret(true)
      })
      .catch(() => {
        if (annule) return
        setErreur('Les objectifs n’ont pas pu être lus.')
        setPret(true)
      })
    return () => {
      annule = true
    }
  }, [])

  // Poids et taille du Profil remplacent ceux d'un ancien enregistrement : un seul endroit pour les modifier
  const mensurationsConnues = mensurations.poids !== null && mensurations.tailleCm !== null
  const profilCalcul: ProfilNutrition = { ...profil, tailleCm: mensurations.tailleCm ?? Number.NaN, poidsKg: mensurations.poids?.kg ?? Number.NaN }
  const erreurProfil = mensurationsConnues ? verifierProfil(profilCalcul) : null
  const proposition = mensurationsConnues && erreurProfil === null ? proposerObjectifs(profilCalcul) : null
  const repartition = repartitionEnergie({ kcal: o.kcal, proteines: o.proteinesG, glucides: o.glucidesG, lipides: o.lipidesG, fibres: 0 })
  const energieMacros = kcalDesMacros(o.proteinesG, o.glucidesG, o.lipidesG)

  function appliquer() {
    if (!proposition) return
    setO(proposition)
    setMessage('Proposition appliquée : ajustez-la si besoin, puis enregistrez.')
  }

  async function enregistrer(ev: FormEvent) {
    ev.preventDefault()
    setErreur('')
    setMessage('')
    try {
      await enregistrerObjectifsNutrition(getDb(), { ...o, profilJson: mensurationsConnues && erreurProfil === null ? JSON.stringify(profilCalcul) : null })
      navigate('/nutrition')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’enregistrement a échoué.')
    }
  }

  if (!pret) return <div className="plans nutri"><h1 className="titre-ecran">Objectifs</h1><p>Chargement…</p></div>

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Objectifs nutrition</h1>

      <details className="plans__carte charge__reglages" open>
        <summary>Calculer une proposition</summary>
        <div className="nutri__calcul">
          <div className="outils__periodes" role="group" aria-label="Sexe">
            {(['homme', 'femme'] as Sexe[]).map((s) => <button key={s} type="button" className="outils__periode" aria-pressed={profil.sexe === s} onClick={() => setProfil({ ...profil, sexe: s })}>{s === 'homme' ? 'Homme' : 'Femme'}</button>)}
          </div>
          <Nombre libelle="Âge" valeur={profil.age} unite="ans" min={14} max={100} onChange={(v) => setProfil({ ...profil, age: v })} />
          <div className="nutri__mensurations" role="group" aria-label="Mensurations du Profil">
            {mensurationsConnues ? (
              <p>
                Poids <strong>{decimal(mensurations.poids!.kg)} kg</strong> (pesée du {mensurations.poids!.date.split('-').reverse().join('/')}) · taille <strong>{mensurations.tailleCm} cm</strong>
              </p>
            ) : (
              <p role="status">
                {mensurations.poids === null && mensurations.tailleCm === null ? 'Votre poids et votre taille ne sont pas renseignés.' : mensurations.poids === null ? 'Votre poids n’est pas renseigné.' : 'Votre taille n’est pas renseignée.'}
              </p>
            )}
            <Link className="bouton" to="/profile">{mensurationsConnues ? 'Modifier dans le Profil' : 'Les renseigner dans le Profil'}</Link>
          </div>
          <label className="formulaire__champ">
            Activité
            <select value={profil.activite} onChange={(e) => setProfil({ ...profil, activite: e.target.value as Activite })}>
              {(Object.keys(LIBELLE_ACTIVITE) as Activite[]).map((a) => <option key={a} value={a}>{LIBELLE_ACTIVITE[a]}</option>)}
            </select>
          </label>
          <label className="formulaire__champ">
            Objectif
            <select value={profil.but} onChange={(e) => setProfil({ ...profil, but: e.target.value as But })}>
              {(Object.keys(LIBELLE_BUT) as But[]).map((b) => <option key={b} value={b}>{LIBELLE_BUT[b]}</option>)}
            </select>
          </label>
          {erreurProfil && <p role="alert">{erreurProfil}</p>}
          {proposition && (
            <>
              <p className="aide">Métabolisme de base {entier(metabolismeDeBase(profilCalcul))} kcal. Proposition : <strong>{entier(proposition.kcal)} kcal</strong>, protéines {proposition.proteinesG} g, glucides {proposition.glucidesG} g, lipides {proposition.lipidesG} g, eau {entier(proposition.eauMl)} ml.</p>
              <button type="button" className="bouton" onClick={appliquer}>Utiliser cette proposition</button>
            </>
          )}
          <p className="aide">Estimation indicative, pas un avis médical. Suivez votre poids sur 2 à 3 semaines et ajustez l’énergie de 100 à 200 kcal si l’évolution ne correspond pas à votre but.</p>
        </div>
      </details>

      <form className="plans__carte" onSubmit={(e) => void enregistrer(e)} aria-labelledby="ob-titre">
        <h2 id="ob-titre" className="plans__titre">Mes objectifs du jour</h2>
        <Nombre libelle="Énergie" valeur={o.kcal} unite="kcal" min={500} max={10000} onChange={(v) => setO({ ...o, kcal: v })} />
        <div className="nutri__trois">
          <Nombre libelle="Protéines" valeur={o.proteinesG} unite="g" min={0} max={1000} onChange={(v) => setO({ ...o, proteinesG: v })} />
          <Nombre libelle="Glucides" valeur={o.glucidesG} unite="g" min={0} max={2000} onChange={(v) => setO({ ...o, glucidesG: v })} />
          <Nombre libelle="Lipides" valeur={o.lipidesG} unite="g" min={0} max={1000} onChange={(v) => setO({ ...o, lipidesG: v })} />
        </div>
        <Nombre libelle="Eau" valeur={o.eauMl} unite="ml" min={0} max={20000} onChange={(v) => setO({ ...o, eauMl: v })} />
        {repartition && Number.isFinite(energieMacros) && (
          <p className="aide" role="status">
            Les macros donnent environ {entier(energieMacros)} kcal ({repartition.proteines} % protéines, {repartition.glucides} % glucides, {repartition.lipides} % lipides).
            {Math.abs(energieMacros - o.kcal) > o.kcal * 0.1 ? ' L’écart avec l’énergie dépasse 10 % : ajustez l’un ou l’autre.' : ''}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {erreur && <p role="alert">{erreur}</p>}
        <button type="submit" className="bouton bouton--principal">Enregistrer</button>
      </form>
    </div>
  )
}
