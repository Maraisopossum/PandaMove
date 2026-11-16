import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { getDb } from '../../core/db/client'
import { creerAliment, lireAliment, modifierAliment } from '../../core/db/repos/nutrition'
import { ecartEnergie, kcalDesMacros } from '../../core/nutrition/calculs'
import { entier } from './outils'

interface Champs {
  nom: string
  marque: string
  codeBarres: string
  kcal: string
  p: string
  g: string
  l: string
  fibres: string
  portionG: string
  portionLabel: string
}

const VIDE: Champs = { nom: '', marque: '', codeBarres: '', kcal: '', p: '', g: '', l: '', fibres: '', portionG: '100', portionLabel: '' }
const n = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')))

function Formulaire({ id, initial }: { id: string | null; initial: Champs }) {
  const navigate = useNavigate()
  const [v, setV] = useState(initial)
  const [erreur, setErreur] = useState('')
  const champ = (cle: keyof Champs) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [cle]: e.target.value }))
  const ecart = ecartEnergie(n(v.kcal), n(v.p), n(v.g), n(v.l))

  async function valider(ev: FormEvent) {
    ev.preventDefault()
    setErreur('')
    const saisie = {
      nom: v.nom, marque: v.marque, codeBarres: v.codeBarres, portionG: n(v.portionG), portionLabel: v.portionLabel,
      kcal100: n(v.kcal), proteines100: n(v.p), glucides100: n(v.g), lipides100: n(v.l), fibres100: v.fibres.trim() === '' ? null : n(v.fibres),
    }
    try {
      if (id) await modifierAliment(getDb(), id, saisie)
      else await creerAliment(getDb(), saisie)
      navigate('/nutrition/aliments', { replace: true })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’enregistrement a échoué.')
    }
  }

  return (
    <form className="plans__carte" onSubmit={(e) => void valider(e)} aria-labelledby="af-titre">
      <h2 id="af-titre" className="plans__titre">{id ? 'Modifier l’aliment' : 'Nouvel aliment'}</h2>
      <label className="formulaire__champ">Nom<input value={v.nom} onChange={champ('nom')} maxLength={200} required /></label>
      <label className="formulaire__champ">Marque (facultatif)<input value={v.marque} onChange={champ('marque')} maxLength={200} /></label>
      <p className="aide">Valeurs pour 100 g (ou 100 ml), comme sur l’étiquette.</p>
      <label className="formulaire__champ">Énergie (kcal)<input type="number" inputMode="decimal" min={0} max={1000} step="any" value={v.kcal} onChange={champ('kcal')} required /></label>
      <div className="nutri__trois">
        <label className="formulaire__champ">Protéines (g)<input type="number" inputMode="decimal" min={0} max={100} step="any" value={v.p} onChange={champ('p')} /></label>
        <label className="formulaire__champ">Glucides (g)<input type="number" inputMode="decimal" min={0} max={100} step="any" value={v.g} onChange={champ('g')} /></label>
        <label className="formulaire__champ">Lipides (g)<input type="number" inputMode="decimal" min={0} max={100} step="any" value={v.l} onChange={champ('l')} /></label>
      </div>
      <label className="formulaire__champ">Fibres (g, facultatif)<input type="number" inputMode="decimal" min={0} max={100} step="any" value={v.fibres} onChange={champ('fibres')} /></label>
      {ecart !== null && ecart > 0.35 && <p className="aide" role="status">L’énergie s’écarte des macros (environ {entier(kcalDesMacros(n(v.p), n(v.g), n(v.l)))} kcal attendues) : vérifiez l’étiquette, sans obligation.</p>}
      <div className="nutri__trois">
        <label className="formulaire__champ">Portion habituelle (g)<input type="number" inputMode="decimal" min={1} max={5000} step="any" value={v.portionG} onChange={champ('portionG')} /></label>
        <label className="formulaire__champ">Libellé de la portion<input value={v.portionLabel} onChange={champ('portionLabel')} maxLength={100} placeholder="1 pot, 1 tranche…" /></label>
      </div>
      <label className="formulaire__champ">Code-barres (facultatif)<input inputMode="numeric" value={v.codeBarres} onChange={champ('codeBarres')} maxLength={14} placeholder="8 à 14 chiffres" /></label>
      {erreur && <p role="alert">{erreur}</p>}
      <div className="nutri__raccourcis">
        <button type="submit" className="bouton bouton--principal">Enregistrer</button>
        <Link className="bouton" to="/nutrition/aliments" replace>Annuler</Link>
      </div>
    </form>
  )
}

// Création et modification d'un aliment personnel (/nutrition/aliments/new et /nutrition/aliments/:id).
export default function AlimentFormScreen() {
  const { id } = useParams()
  const edition = id && id !== 'new' ? id : null
  const [etat, setEtat] = useState<{ pret: boolean; initial: Champs | null }>({ pret: !edition, initial: edition ? null : VIDE })

  useEffect(() => {
    if (!edition) return
    let annule = false
    lireAliment(getDb(), edition)
      .then((a) => {
        if (annule) return
        setEtat({
          pret: true,
          initial: a && {
            nom: a.nom, marque: a.marque ?? '', codeBarres: a.codeBarres ?? '', kcal: String(a.kcal100), p: String(a.proteines100), g: String(a.glucides100), l: String(a.lipides100),
            fibres: a.fibres100 === null ? '' : String(a.fibres100), portionG: String(a.portionG), portionLabel: a.portionLabel ?? '',
          },
        })
      })
      .catch(() => !annule && setEtat({ pret: true, initial: null }))
    return () => {
      annule = true
    }
  }, [edition])

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">{edition ? 'Modifier l’aliment' : 'Créer un aliment'}</h1>
      {!etat.pret ? <p>Chargement…</p> : etat.initial ? <Formulaire id={edition} initial={etat.initial} /> : (
        <p role="alert">Cet aliment n’existe plus. <Link className="plans__lien" to="/nutrition/aliments">Retour à Mes aliments</Link></p>
      )}
    </div>
  )
}
