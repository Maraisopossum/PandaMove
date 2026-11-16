import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Aliment } from '../../core/db/repos/nutrition'
import { decimal, entier } from './outils'
import { useAccesNutrition } from './useAccesNutrition'

// Mes aliments : catalogue personnel (créés à la main, produits scannés, aliments issus d'une photo). Favoris en premier.
export default function MesAlimentsScreen() {
  const acces = useAccesNutrition()
  const [aliments, setAliments] = useState<Aliment[] | null>(null)
  const [version, setVersion] = useState(0)
  const [erreur, setErreur] = useState('')
  const [aSupprimer, setASupprimer] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    acces.listerAliments()
      .then((a) => !annule && setAliments(a))
      .catch(() => {
        if (annule) return
        setAliments([])
        setErreur('Vos aliments n’ont pas pu être lus.')
      })
    return () => {
      annule = true
    }
  }, [version, acces])

  async function agir(action: () => Promise<void>, echec: string) {
    setErreur('')
    try {
      await action()
      setASupprimer(null)
      setVersion((v) => v + 1)
    } catch {
      setErreur(echec)
    }
  }

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Mes aliments</h1>
      {erreur && <p role="alert">{erreur}</p>}
      <Link className="bouton bouton--principal" to="/nutrition/aliments/new">Créer un aliment</Link>
      {aliments === null ? <p>Chargement…</p> : aliments.length === 0 ? (
        <p className="aide">Aucun aliment personnel pour le moment. Les produits scannés ou créés à la main s’affichent ici et se retrouvent hors ligne.</p>
      ) : (
        <ul className="plans__phases nutri__mes">
          {aliments.map((a) => (
            <li key={a.id} className="nutri__mon-aliment">
              <Link className="plans__phase-texte" to={`/nutrition/aliments/${a.id}`}>
                <strong>{a.nom}{a.marque ? ` · ${a.marque}` : ''}</strong>
                <span className="plans__phase-detail">{entier(a.kcal100)} kcal · P {decimal(a.proteines100)} · G {decimal(a.glucides100)} · L {decimal(a.lipides100)} pour 100 g</span>
              </Link>
              <button type="button" className="bouton nutri__etoile" aria-pressed={a.favori} aria-label={a.favori ? `Retirer ${a.nom} des favoris` : `Mettre ${a.nom} en favori`} onClick={() => void agir(() => acces.basculerFavori(a.id), 'Le favori n’a pas pu être changé.')}>{a.favori ? '★' : '☆'}</button>
              {aSupprimer === a.id ? (
                <button type="button" className="bouton bouton--alerte" onClick={() => void agir(() => acces.supprimerAliment(a.id), 'La suppression a échoué.')}>Confirmer</button>
              ) : (
                <button type="button" className="bouton" aria-label={`Supprimer ${a.nom}`} onClick={() => setASupprimer(a.id)}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="aide">Supprimer un aliment ne modifie pas votre journal : les lignes déjà saisies gardent leurs valeurs.</p>
    </div>
  )
}
