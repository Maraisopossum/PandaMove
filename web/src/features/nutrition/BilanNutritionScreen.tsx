import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb } from '../../core/db/client'
import { lireObjectifsNutrition, lireTotauxParJour, type ObjectifNutrition, type TotauxJour } from '../../core/db/repos/nutrition'
import { resumerBilan } from '../../core/nutrition/calculs'
import { decalerJour, decimal, entier, libelleCourt } from './outils'

type Periode = 7 | 30

// Bilan sur 7 ou 30 jours : énergie par jour face à l'objectif, moyennes sur les jours saisis, régularité.
export default function BilanNutritionScreen({ aujourdhui = dateIsoLocale(new Date()) }: { aujourdhui?: string }) {
  const [periode, setPeriode] = useState<Periode>(7)
  const [donnees, setDonnees] = useState<{ pret: boolean; totaux: TotauxJour[]; objectifs: ObjectifNutrition | null; erreur: string }>({ pret: false, totaux: [], objectifs: null, erreur: '' })

  useEffect(() => {
    let annule = false
    const db = getDb()
    Promise.all([lireTotauxParJour(db, decalerJour(aujourdhui, -(periode - 1)), aujourdhui), lireObjectifsNutrition(db)])
      .then(([totaux, objectifs]) => !annule && setDonnees({ pret: true, totaux, objectifs, erreur: '' }))
      .catch(() => !annule && setDonnees({ pret: true, totaux: [], objectifs: null, erreur: 'Le bilan n’a pas pu être lu.' }))
    return () => {
      annule = true
    }
  }, [aujourdhui, periode])

  const jours = Array.from({ length: periode }, (_, i) => decalerJour(aujourdhui, -(periode - 1 - i)))
  const parJour = new Map(donnees.totaux.map((t) => [t.date, t]))
  const objectif = donnees.objectifs?.kcal ?? null
  const resume = resumerBilan(jours.map((date) => ({ date, apport: parJour.get(date)?.apport ?? { kcal: 0, proteines: 0, glucides: 0, lipides: 0, fibres: 0 } })), objectif)
  const maximum = Math.max(objectif ?? 0, ...donnees.totaux.map((t) => t.apport.kcal), 1)
  const joursEau = donnees.totaux.filter((t) => t.eauMl > 0)
  const eauMoyenne = joursEau.length ? Math.round(joursEau.reduce((s, t) => s + t.eauMl, 0) / joursEau.length) : 0

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Bilan nutrition</h1>
      {donnees.erreur && <p role="alert">{donnees.erreur}</p>}
      <div className="outils__periodes" role="group" aria-label="Période">
        {([7, 30] as Periode[]).map((p) => <button key={p} type="button" className="outils__periode" aria-pressed={periode === p} onClick={() => setPeriode(p)}>{p} jours</button>)}
      </div>

      <section className="plans__carte" aria-labelledby="bi-moy">
        <h2 id="bi-moy" className="plans__titre">Moyenne par jour saisi <span className="plans__sous">{resume.joursSaisis} jour{resume.joursSaisis > 1 ? 's' : ''} sur {periode}</span></h2>
        {resume.joursSaisis === 0 ? (
          <p className="aide">Rien n’est encore noté sur cette période. <Link className="plans__lien" to="/nutrition">Ouvrir le journal</Link></p>
        ) : (
          <>
            <div className="outils__chiffres">
              <div className="outils__chiffre"><span className="outils__chiffre-libelle">Énergie</span><strong>{entier(resume.moyenne.kcal)} kcal</strong>{objectif && <span className="outils__chiffre-detail">objectif {entier(objectif)}</span>}</div>
              <div className="outils__chiffre"><span className="outils__chiffre-libelle">Protéines</span><strong>{decimal(resume.moyenne.proteines)} g</strong>{donnees.objectifs && <span className="outils__chiffre-detail">objectif {donnees.objectifs.proteinesG}</span>}</div>
              <div className="outils__chiffre"><span className="outils__chiffre-libelle">Glucides</span><strong>{decimal(resume.moyenne.glucides)} g</strong>{donnees.objectifs && <span className="outils__chiffre-detail">objectif {donnees.objectifs.glucidesG}</span>}</div>
              <div className="outils__chiffre"><span className="outils__chiffre-libelle">Lipides</span><strong>{decimal(resume.moyenne.lipides)} g</strong>{donnees.objectifs && <span className="outils__chiffre-detail">objectif {donnees.objectifs.lipidesG}</span>}</div>
            </div>
            {objectif && <p className="aide">{resume.joursDansLaCible} jour{resume.joursDansLaCible > 1 ? 's' : ''} à ±10 % de l’objectif d’énergie.</p>}
            {eauMoyenne > 0 && <p className="aide">Eau notée : {entier(eauMoyenne)} ml en moyenne les jours où elle l’est.</p>}
          </>
        )}
        {!donnees.objectifs && donnees.pret && <p className="aide"><Link className="plans__lien" to="/nutrition/objectifs">Définir mes objectifs</Link> pour comparer.</p>}
      </section>

      <section className="plans__carte" aria-labelledby="bi-jours">
        <h2 id="bi-jours" className="plans__titre">Énergie jour par jour</h2>
        <ul className="nutri__jours">
          {[...jours].reverse().map((date) => {
            const kcal = parJour.get(date)?.apport.kcal ?? 0
            const hors = objectif !== null && kcal > 0 && kcal > objectif * 1.1
            return (
              <li key={date}>
                <Link className="nutri__jour-ligne" to={date === aujourdhui ? '/nutrition' : `/nutrition?date=${date}`}>
                  <span className="nutri__jour-nom">{libelleCourt(date)}</span>
                  <span className="nutri__barre" aria-hidden="true"><span className={`nutri__barre-rempli ${hors ? 'nutri__barre-rempli--depasse' : 'nutri__barre-rempli--glucides'}`} style={{ width: `${Math.round((kcal / maximum) * 100)}%` }} /></span>
                  <span className="nutri__jour-valeur">{kcal > 0 ? `${entier(kcal)} kcal` : '—'}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
