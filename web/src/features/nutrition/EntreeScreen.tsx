import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import type { EntreeJournal } from '../../core/db/repos/nutrition'
import { apportPourQuantite, estRepas, LIBELLE_REPAS, mettreALEchelle, REPAS, type Repas } from '../../core/nutrition/calculs'
import { PanneauQuantite } from './composants'
import { decimal, entier } from './outils'
import { useAccesNutrition } from './useAccesNutrition'

const retourJournal = (e: EntreeJournal) => `/nutrition?date=${e.date}`

function Edition({ entree }: { entree: EntreeJournal }) {
  const acces = useAccesNutrition()
  const navigate = useNavigate()
  const [quantite, setQuantite] = useState(entree.quantiteG)
  const [repas, setRepas] = useState<Repas>(entree.repas === 'eau' ? 'collation' : entree.repas)
  const [erreur, setErreur] = useState('')
  const [confirme, setConfirme] = useState(false)
  const [occupe, setOccupe] = useState(false)
  const peutRecalculer = entree.quantiteG > 0

  // Valeurs pour 100 g déduites de la ligne : la modification garde les proportions de l'aliment d'origine
  const par100 = peutRecalculer
    ? (() => {
        const a = mettreALEchelle(entree.apport, entree.quantiteG, 100)
        return { kcal: entree.apport.kcal * (100 / entree.quantiteG), proteines: a.proteines, glucides: a.glucides, lipides: a.lipides, fibres: a.fibres }
      })()
    : null

  async function enregistrer() {
    setOccupe(true)
    setErreur('')
    try {
      await acces.modifierEntree(entree.id, { repas, quantiteG: quantite, apport: par100 ? apportPourQuantite(par100, quantite) : entree.apport })
      navigate(retourJournal(entree), { replace: true })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’enregistrement a échoué.')
      setOccupe(false)
    }
  }

  async function supprimer() {
    setOccupe(true)
    try {
      await acces.supprimerEntree(entree.id)
      navigate(retourJournal(entree), { replace: true })
    } catch {
      setErreur('La suppression a échoué.')
      setOccupe(false)
    }
  }

  return (
    <section className="plans__carte" aria-labelledby="en-titre">
      <h2 id="en-titre" className="plans__titre">{entree.nom}</h2>
      {par100 ? (
        <PanneauQuantite valeurs={par100} quantiteG={quantite} onChange={setQuantite} />
      ) : (
        <p className="aide">{entier(entree.apport.kcal)} kcal · P {decimal(entree.apport.proteines)} · G {decimal(entree.apport.glucides)} · L {decimal(entree.apport.lipides)} (saisie sans quantité : les valeurs ne se recalculent pas).</p>
      )}
      <label className="formulaire__champ">
        Repas
        <select value={repas} onChange={(e) => estRepas(e.target.value) && setRepas(e.target.value)}>
          {REPAS.map((r) => <option key={r} value={r}>{LIBELLE_REPAS[r]}</option>)}
        </select>
      </label>
      {erreur && <p role="alert">{erreur}</p>}
      <div className="nutri__raccourcis">
        <button type="button" className="bouton bouton--principal" disabled={occupe || (peutRecalculer && quantite <= 0)} onClick={() => void enregistrer()}>Enregistrer</button>
        <Link className="bouton" to={retourJournal(entree)} replace>Annuler</Link>
      </div>
      {!confirme ? (
        <button type="button" className="bouton bouton--alerte" onClick={() => setConfirme(true)}>Supprimer cette ligne</button>
      ) : (
        <div className="admin__suppression">
          <p>Supprimer « {entree.nom} » du journal ?</p>
          <button type="button" className="bouton bouton--alerte" disabled={occupe} onClick={() => void supprimer()}>Supprimer définitivement</button>
          <button type="button" className="bouton" onClick={() => setConfirme(false)}>Garder</button>
        </div>
      )}
    </section>
  )
}

// Correction d'une ligne du journal : quantité (apports recalculés), repas, suppression.
export default function EntreeScreen() {
  const acces = useAccesNutrition()
  const { id = '' } = useParams()
  const [etat, setEtat] = useState<{ pret: boolean; entree: EntreeJournal | null }>({ pret: false, entree: null })

  useEffect(() => {
    let annule = false
    acces.lireEntree(id)
      .then((entree) => !annule && setEtat({ pret: true, entree }))
      .catch(() => !annule && setEtat({ pret: true, entree: null }))
    return () => {
      annule = true
    }
  }, [id, acces])

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Modifier la ligne</h1>
      {!etat.pret ? <p>Chargement…</p> : etat.entree ? <Edition entree={etat.entree} /> : (
        <p role="alert">Cette ligne n’existe plus. <Link className="plans__lien" to="/nutrition">Retour au journal</Link></p>
      )}
    </div>
  )
}
