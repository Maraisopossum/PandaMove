import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { getDb } from '../../core/db/client'
import { creerCourseHyrox, ErreurHyrox, modifierCourseHyrox, supprimerCourseHyrox } from '../../core/db/repos/hyrox'
import { formaterTemps } from '../plans/echeances'
import {
  ciblesCourseComplete, ecartObjectifPct, ecrireRepartition, formaterChrono, lireTempsHyrox, PART_COURSES_MAX, PART_COURSES_MIN, SEUIL_ECART_OBJECTIF_PCT,
} from './simulation'
import { CATEGORIES_HYROX, GENRES_HYROX, LIBELLE_CATEGORIE, LIBELLE_GENRE, STATIONS, type CategorieHyrox, type GenreHyrox } from './stations'
import { useHyrox } from './useHyrox'

// Objectif Hyrox : nom, catégorie, genre, temps visé et répartition entre courses et stations. La date et le lieu sont facultatifs :
// on peut se préparer sans course prévue.
export default function ObjectifHyroxScreen() {
  const h = useHyrox()
  // Le formulaire démarre avec les valeurs de l'objectif existant : on attend la lecture avant de l'afficher.
  if (!h.pret) return <div className="plans hyrox"><h1 className="titre-ecran">Objectif Hyrox</h1></div>
  return <FormulaireObjectif key={h.objectif?.id ?? 'nouveau'} h={h} />
}

function FormulaireObjectif({ h }: { h: ReturnType<typeof useHyrox> }) {
  const navigate = useNavigate()
  const objectif = h.objectif
  const [nom, setNom] = useState(objectif?.nom ?? 'Préparation Hyrox')
  const [lieu, setLieu] = useState(objectif?.lieu ?? '')
  const [date, setDate] = useState(objectif?.date ?? '')
  const [categorie, setCategorie] = useState<CategorieHyrox>(objectif?.categorie ?? 'open')
  const [genre, setGenre] = useState<GenreHyrox>(objectif?.genre ?? 'homme')
  const [cible, setCible] = useState(objectif?.objectifS ? formaterTemps(objectif.objectifS) : '')
  const [resultat, setResultat] = useState(objectif?.resultatS ? formaterTemps(objectif.resultatS) : '')
  const [part, setPart] = useState(h.repartition.partCoursesPct)
  const [erreur, setErreur] = useState('')
  const charge = true

  const cibleS = cible.trim() === '' ? null : lireTempsHyrox(cible)
  const cibles = cibleS ? ciblesCourseComplete(cibleS, part) : null
  const ecart = cibleS && h.estimation ? ecartObjectifPct(cibleS, h.estimation.totalS) : null

  async function enregistrer(e: FormEvent) {
    e.preventDefault()
    setErreur('')
    const resultatS = resultat.trim() === '' ? null : lireTempsHyrox(resultat)
    if ((cible.trim() !== '' && cibleS === null) || (resultat.trim() !== '' && resultatS === null)) {
      setErreur('Les temps doivent ressembler à 1:10:00 ou 48:30.')
      return
    }
    try {
      const saisie = { nom, lieu, date: date || null, categorie, genre, objectifS: cibleS, resultatS, repartitionJson: ecrireRepartition({ partCoursesPct: part }) }
      if (objectif) await modifierCourseHyrox(getDb(), objectif.id, saisie)
      else await creerCourseHyrox(getDb(), saisie)
      navigate('/hyrox')
    } catch (err) {
      setErreur(err instanceof ErreurHyrox ? err.message : 'L’enregistrement a échoué.')
    }
  }

  async function supprimer() {
    if (!objectif) return
    try {
      await supprimerCourseHyrox(getDb(), objectif.id)
      navigate('/hyrox')
    } catch {
      setErreur('La suppression a échoué.')
    }
  }

  return (
    <div className="plans hyrox">
      <h1 className="titre-ecran">{objectif ? 'Modifier l’objectif' : 'Objectif Hyrox'}</h1>
      {charge && (
        <form className="plans__formulaire" onSubmit={(e) => void enregistrer(e)}>
          <label className="formulaire__champ">
            Nom
            <input value={nom} onChange={(e) => setNom(e.target.value)} maxLength={200} required />
          </label>
          <label className="formulaire__champ">
            Catégorie
            <select value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieHyrox)}>
              {CATEGORIES_HYROX.map((c) => <option key={c} value={c}>{LIBELLE_CATEGORIE[c]}</option>)}
            </select>
          </label>
          <label className="formulaire__champ">
            Genre
            <select value={genre} onChange={(e) => setGenre(e.target.value as GenreHyrox)}>
              {GENRES_HYROX.map((g) => <option key={g} value={g}>{LIBELLE_GENRE[g]}</option>)}
            </select>
          </label>
          <label className="formulaire__champ">
            Date de la course (facultative)
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="formulaire__champ">
            Lieu (facultatif)
            <input value={lieu} onChange={(e) => setLieu(e.target.value)} maxLength={200} />
          </label>
          <label className="formulaire__champ">
            Temps visé (facultatif)
            <input value={cible} onChange={(e) => setCible(e.target.value)} placeholder="1:10:00" inputMode="numeric" />
          </label>
          <label className="formulaire__champ">
            Part du temps pour les 8 km : {part} %
            <input type="range" min={PART_COURSES_MIN} max={PART_COURSES_MAX} value={part} onChange={(e) => setPart(Number(e.target.value))} />
            <span className="aide">Les stations se partagent les {100 - part} % restants. 55 % convient à la plupart des profils.</span>
          </label>

          {cibles && (
            <section className="plans__carte" aria-labelledby="ho-rep">
              <h2 id="ho-rep" className="plans__titre">Répartition</h2>
              <ul className="plans__phases">
                <li><span className="plans__phase-texte"><strong>8 × 1 km</strong><span className="plans__phase-detail">{formaterChrono(cibles[0])} chacun</span></span></li>
                {STATIONS.map((s, i) => (
                  <li key={s.cle}><span className="plans__phase-texte"><strong>{s.nom}</strong><span className="plans__phase-detail">{formaterChrono(cibles[2 * i + 1])}</span></span></li>
                ))}
              </ul>
            </section>
          )}

          {ecart !== null && Math.abs(ecart) > SEUIL_ECART_OBJECTIF_PCT && (
            <p className="plans__niveau" data-niveau={ecart > 0 ? 'bas' : 'bon'} role="status">
              {ecart > 0 ? `Cet objectif est ${Math.round(ecart)} % plus rapide que votre dernière simulation.` : `Cet objectif est ${Math.round(-ecart)} % plus lent que votre dernière simulation.`} L’enregistrement reste possible.
            </p>
          )}

          {objectif && (
            <label className="formulaire__champ">
              Temps officiel (après la course)
              <input value={resultat} onChange={(e) => setResultat(e.target.value)} placeholder="1:12:30" inputMode="numeric" />
            </label>
          )}

          {erreur && <p role="alert">{erreur}</p>}
          <button type="submit" className="bouton bouton--principal">Enregistrer</button>
          <Link className="plans__lien" to="/hyrox">Annuler</Link>
          {objectif && <button type="button" className="bouton bouton--alerte" onClick={() => void supprimer()}>Supprimer l’objectif</button>}
        </form>
      )}
    </div>
  )
}
