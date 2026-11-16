import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import type { Aliment, AlimentRecent, SourceEntree } from '../../core/db/repos/nutrition'
import { chercherDansBase, normaliserTexte, type AlimentBase } from '../../core/nutrition/baseAliments'
import { apportPourQuantite, ecartEnergie, LIBELLE_REPAS, REPAS, estRepas, type Valeurs100 } from '../../core/nutrition/calculs'
import { codeBarresValide, produitParCodeBarres, rechercherProduits, type ProduitOff } from '../../core/nutrition/openFoodFacts'
import { PanneauQuantite } from './composants'
import { decalerJour, decimal, entier, jourDemande, libelleJour, repasDemande, scanPossible } from './outils'
import { useAccesNutrition } from './useAccesNutrition'
import { ScanCodeBarres } from './ScanCodeBarres'

interface Choix {
  nom: string
  marque: string | null
  valeurs: Valeurs100
  portionG: number | null
  portionLabel: string | null
  source: SourceEntree
  alimentId: string | null
  codeBarres: string | null
  quantiteInitiale: number
  /** Proposer de garder l'aliment dans « Mes aliments » (produits en ligne : le prochain scan marche hors ligne). */
  gardable: boolean
}

const depuisAliment = (a: Aliment): Choix => ({
  nom: a.nom, marque: a.marque, valeurs: { kcal: a.kcal100, proteines: a.proteines100, glucides: a.glucides100, lipides: a.lipides100, fibres: a.fibres100 },
  portionG: a.portionG, portionLabel: a.portionLabel, source: a.source === 'off' ? 'off' : a.source === 'ia' ? 'ia' : 'manuel', alimentId: a.id, codeBarres: a.codeBarres, quantiteInitiale: a.portionG, gardable: false,
})
const depuisBase = (a: AlimentBase): Choix => ({
  nom: a.nom, marque: null, valeurs: { kcal: a.kcal, proteines: a.proteines, glucides: a.glucides, lipides: a.lipides, fibres: a.fibres },
  portionG: a.portionG, portionLabel: a.portionLabel, source: 'base', alimentId: null, codeBarres: null, quantiteInitiale: a.portionG, gardable: false,
})
const depuisProduit = (p: ProduitOff): Choix => ({
  nom: p.nom, marque: p.marque, valeurs: { kcal: p.kcal, proteines: p.proteines, glucides: p.glucides, lipides: p.lipides, fibres: p.fibres },
  portionG: p.portionG, portionLabel: p.portionLabel, source: 'off', alimentId: null, codeBarres: p.code, quantiteInitiale: p.portionG ?? 100, gardable: true,
})
const depuisFrequent = (f: AlimentRecent): Choix => {
  const base = f.quantiteG > 0 ? 100 / f.quantiteG : 0
  return {
    nom: f.nom, marque: null, valeurs: { kcal: f.apport.kcal * base, proteines: f.apport.proteines * base, glucides: f.apport.glucides * base, lipides: f.apport.lipides * base, fibres: f.apport.fibres * base },
    portionG: null, portionLabel: null, source: f.source === 'eau' || f.source === 'copie' ? 'manuel' : f.source, alimentId: f.alimentId, codeBarres: null, quantiteInitiale: f.quantiteG || 100, gardable: false,
  }
}

const resume = (v: Valeurs100) => `${entier(v.kcal)} kcal · P ${decimal(v.proteines)} · G ${decimal(v.glucides)} · L ${decimal(v.lipides)} pour 100 g`

function Panneau({ choix, repas, date, retour, annuler }: { choix: Choix; repas: (typeof REPAS)[number]; date: string; retour: () => void; annuler: () => void }) {
  const acces = useAccesNutrition()
  const [quantite, setQuantite] = useState(choix.quantiteInitiale)
  const [repasChoisi, setRepasChoisi] = useState(repas)
  const [garder, setGarder] = useState(choix.gardable)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)

  async function ajouter() {
    setOccupe(true)
    setErreur('')
    try {
      let alimentId = choix.alimentId
      if (garder && !alimentId) {
        const existant = choix.codeBarres ? await acces.lireAlimentParCodeBarres(choix.codeBarres) : null
        alimentId = existant?.id ?? (await acces.creerAliment({
          nom: choix.nom, marque: choix.marque, codeBarres: choix.codeBarres, portionG: choix.portionG ?? 100, portionLabel: choix.portionLabel,
          kcal100: choix.valeurs.kcal, proteines100: choix.valeurs.proteines, glucides100: choix.valeurs.glucides, lipides100: choix.valeurs.lipides, fibres100: choix.valeurs.fibres, source: 'off',
        }))
      }
      await acces.ajouterEntree({ date, repas: repasChoisi, nom: choix.nom, quantiteG: quantite, apport: apportPourQuantite(choix.valeurs, quantite), alimentId, source: choix.source })
      retour()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’ajout a échoué.')
      setOccupe(false)
    }
  }

  return (
    <section className="plans__carte" aria-labelledby="aj-choix">
      <h2 id="aj-choix" className="plans__titre">{choix.nom}</h2>
      <p className="aide">{choix.marque ? `${choix.marque} · ` : ''}{resume(choix.valeurs)}</p>
      <PanneauQuantite valeurs={choix.valeurs} quantiteG={quantite} onChange={setQuantite} portionG={choix.portionG} portionLabel={choix.portionLabel} />
      <label className="formulaire__champ">
        Repas
        <select value={repasChoisi} onChange={(e) => estRepas(e.target.value) && setRepasChoisi(e.target.value)}>
          {REPAS.map((r) => <option key={r} value={r}>{LIBELLE_REPAS[r]}</option>)}
        </select>
      </label>
      {choix.gardable && (
        <label className="outils__interrupteur plans__interrupteur">
          <input type="checkbox" checked={garder} onChange={(e) => setGarder(e.target.checked)} />
          <span>Garder dans Mes aliments<span className="plans__phase-detail">Disponible hors ligne, et en un geste la prochaine fois.</span></span>
        </label>
      )}
      {erreur && <p role="alert">{erreur}</p>}
      <div className="nutri__raccourcis">
        <button type="button" className="bouton bouton--principal" disabled={occupe || quantite <= 0} onClick={() => void ajouter()}>Ajouter au {LIBELLE_REPAS[repasChoisi].toLowerCase()}</button>
        <button type="button" className="bouton" disabled={occupe} onClick={annuler}>Changer d’aliment</button>
      </div>
    </section>
  )
}

function SaisieRapide({ repas, date, retour }: { repas: (typeof REPAS)[number]; date: string; retour: () => void }) {
  const acces = useAccesNutrition()
  const [v, setV] = useState({ nom: '', kcal: '', p: '', g: '', l: '', q: '' })
  const [erreur, setErreur] = useState('')
  const champ = (cle: keyof typeof v) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [cle]: e.target.value }))
  const n = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')))
  const ecart = ecartEnergie(n(v.kcal), n(v.p), n(v.g), n(v.l))

  async function valider(ev: FormEvent) {
    ev.preventDefault()
    setErreur('')
    try {
      await acces.ajouterEntree({
        date, repas, nom: v.nom, quantiteG: n(v.q), source: 'manuel',
        apport: { kcal: n(v.kcal), proteines: n(v.p), glucides: n(v.g), lipides: n(v.l), fibres: 0 },
      })
      retour()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’ajout a échoué.')
    }
  }

  return (
    <form className="plans__carte" onSubmit={(e) => void valider(e)} aria-labelledby="aj-rapide">
      <h2 id="aj-rapide" className="plans__titre">Saisie rapide</h2>
      <p className="aide">Pour ce que vous avez mangé, en valeurs totales (pas pour 100 g) : un plat de restaurant, une étiquette.</p>
      <label className="formulaire__champ">Nom<input value={v.nom} onChange={champ('nom')} maxLength={200} required /></label>
      <label className="formulaire__champ">Énergie (kcal)<input type="number" inputMode="decimal" min={0} step="any" value={v.kcal} onChange={champ('kcal')} required /></label>
      <div className="nutri__trois">
        <label className="formulaire__champ">Protéines (g)<input type="number" inputMode="decimal" min={0} step="any" value={v.p} onChange={champ('p')} /></label>
        <label className="formulaire__champ">Glucides (g)<input type="number" inputMode="decimal" min={0} step="any" value={v.g} onChange={champ('g')} /></label>
        <label className="formulaire__champ">Lipides (g)<input type="number" inputMode="decimal" min={0} step="any" value={v.l} onChange={champ('l')} /></label>
      </div>
      <label className="formulaire__champ">Quantité (g, facultatif)<input type="number" inputMode="decimal" min={0} step="any" value={v.q} onChange={champ('q')} /></label>
      {ecart !== null && ecart > 0.35 && <p className="aide" role="status">L’énergie saisie s’écarte des macros (environ {entier(n(v.p) * 4 + n(v.g) * 4 + n(v.l) * 9)} kcal attendues) : vérifiez, sans obligation.</p>}
      {erreur && <p role="alert">{erreur}</p>}
      <button type="submit" className="bouton bouton--principal">Ajouter au {LIBELLE_REPAS[repas].toLowerCase()}</button>
    </form>
  )
}

// Ajout d'un aliment au journal : fréquents, mes aliments, base intégrée (hors ligne), Open Food Facts (texte ou code-barres) et saisie rapide.
export default function AjouterAlimentScreen({ aujourdhui = dateIsoLocale(new Date()) }: { aujourdhui?: string }) {
  const acces = useAccesNutrition()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const date = jourDemande(params.get('date'), aujourdhui)
  const repas = repasDemande(params.get('repas'))
  const retour = () => navigate(date === aujourdhui ? '/nutrition' : `/nutrition?date=${date}`, { replace: true })

  const [texte, setTexte] = useState('')
  const [mes, setMes] = useState<Aliment[]>([])
  const [frequents, setFrequents] = useState<AlimentRecent[]>([])
  const [enLigne, setEnLigne] = useState<ProduitOff[] | null>(null)
  const [chargement, setChargement] = useState(false)
  const [message, setMessage] = useState('')
  const [choix, setChoix] = useState<Choix | null>(null)
  const [rapide, setRapide] = useState(false)
  const [scan, setScan] = useState(false)

  useEffect(() => {
    let annule = false
    Promise.all([acces.listerAliments(), acces.alimentsFrequents(decalerJour(aujourdhui, -60))])
      .then(([a, f]) => {
        if (annule) return
        setMes(a)
        setFrequents(f)
      })
      .catch(() => !annule && setMessage('La liste de vos aliments n’a pas pu être lue.'))
    return () => {
      annule = true
    }
  }, [aujourdhui, acces])

  const recherche = normaliserTexte(texte)
  const mesTrouves = useMemo(() => (recherche ? mes.filter((a) => normaliserTexte(`${a.nom} ${a.marque ?? ''}`).includes(recherche)) : mes.filter((a) => a.favori)), [mes, recherche])
  const baseTrouvee = useMemo(() => chercherDansBase(texte, 20), [texte])
  const estCode = codeBarresValide(texte)

  async function chercherEnLigne() {
    setChargement(true)
    setMessage('')
    setEnLigne(null)
    try {
      setEnLigne(await rechercherProduits(texte))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'La recherche a échoué.')
    } finally {
      setChargement(false)
    }
  }

  async function chercherCode(code: string) {
    setScan(false)
    setTexte(code)
    setChargement(true)
    setMessage('')
    try {
      const local = await acces.lireAlimentParCodeBarres(code.trim())
      setChoix(local ? depuisAliment(local) : depuisProduit(await produitParCodeBarres(code)))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Le produit n’a pas pu être lu.')
    } finally {
      setChargement(false)
    }
  }

  if (choix) return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Ajouter un aliment</h1>
      <Panneau choix={choix} repas={repas} date={date} retour={retour} annuler={() => setChoix(null)} />
    </div>
  )

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Ajouter un aliment</h1>
      <p className="aide">{LIBELLE_REPAS[repas]} · {libelleJour(date, aujourdhui)}</p>

      <div className="nutri__recherche">
        <label className="formulaire__champ">
          Rechercher un aliment ou un code-barres
          <input type="search" value={texte} onChange={(e) => { setTexte(e.target.value); setEnLigne(null); setMessage('') }} placeholder="Riz, yaourt, 3017620422003…" autoComplete="off" enterKeyHint="search" />
        </label>
        {scanPossible() && <button type="button" className="bouton" onClick={() => setScan(true)}>Scanner un code-barres</button>}
      </div>
      {scan && <ScanCodeBarres onCode={(c) => void chercherCode(c)} onFermer={() => setScan(false)} />}
      {message && <p role="alert">{message}</p>}

      {estCode && <button type="button" className="bouton bouton--principal" disabled={chargement} onClick={() => void chercherCode(texte)}>Chercher ce code-barres</button>}

      {!recherche && frequents.length > 0 && (
        <section className="plans__carte" aria-labelledby="aj-freq">
          <h2 id="aj-freq" className="plans__titre">Fréquents</h2>
          <ul className="plans__phases">
            {frequents.map((f) => (
              <li key={f.nom}>
                <button type="button" className="plans__phase-texte nutri__choix" onClick={() => setChoix(depuisFrequent(f))}>
                  <strong>{f.nom}</strong>
                  <span className="plans__phase-detail">{decimal(f.quantiteG)} g · {entier(f.apport.kcal)} kcal · {f.fois} fois</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mesTrouves.length > 0 && (
        <section className="plans__carte" aria-labelledby="aj-mes">
          <h2 id="aj-mes" className="plans__titre">{recherche ? 'Mes aliments' : 'Mes favoris'}</h2>
          <ul className="plans__phases">
            {mesTrouves.map((a) => (
              <li key={a.id}>
                <button type="button" className="plans__phase-texte nutri__choix" onClick={() => setChoix(depuisAliment(a))}>
                  <strong>{a.nom}{a.marque ? ` · ${a.marque}` : ''}</strong>
                  <span className="plans__phase-detail">{resume({ kcal: a.kcal100, proteines: a.proteines100, glucides: a.glucides100, lipides: a.lipides100, fibres: a.fibres100 })}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recherche && (
        <section className="plans__carte" aria-labelledby="aj-base">
          <h2 id="aj-base" className="plans__titre">Aliments courants</h2>
          {baseTrouvee.length === 0 ? <p className="aide">Aucun aliment courant ne correspond.</p> : (
            <ul className="plans__phases">
              {baseTrouvee.map((a) => (
                <li key={a.id}>
                  <button type="button" className="plans__phase-texte nutri__choix" onClick={() => setChoix(depuisBase(a))}>
                    <strong>{a.nom}</strong>
                    <span className="plans__phase-detail">{resume({ kcal: a.kcal, proteines: a.proteines, glucides: a.glucides, lipides: a.lipides, fibres: a.fibres })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {recherche.length >= 2 && !estCode && (
        <section className="plans__carte" aria-labelledby="aj-off">
          <h2 id="aj-off" className="plans__titre">Produits du commerce</h2>
          {enLigne === null ? (
            <>
              <p className="aide">Recherche dans Open Food Facts (base collaborative). Seul le texte « {texte.trim()} » est envoyé.</p>
              <button type="button" className="bouton" disabled={chargement} onClick={() => void chercherEnLigne()}>{chargement ? 'Recherche…' : 'Chercher en ligne'}</button>
            </>
          ) : enLigne.length === 0 ? <p className="aide">Aucun produit trouvé. Essayez un autre mot, scannez le code-barres ou créez l’aliment.</p> : (
            <ul className="plans__phases">
              {enLigne.map((p) => (
                <li key={p.code || p.nom}>
                  <button type="button" className="plans__phase-texte nutri__choix" onClick={() => setChoix(depuisProduit(p))}>
                    <strong>{p.nom}{p.marque ? ` · ${p.marque}` : ''}</strong>
                    <span className="plans__phase-detail">{resume({ kcal: p.kcal, proteines: p.proteines, glucides: p.glucides, lipides: p.lipides, fibres: p.fibres })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {rapide ? <SaisieRapide repas={repas} date={date} retour={retour} /> : (
        <section className="plans__carte" aria-label="Autres façons d’ajouter">
          <div className="nutri__raccourcis">
            <button type="button" className="bouton" onClick={() => setRapide(true)}>Saisie rapide (calories et macros)</button>
            <Link className="bouton" to="/nutrition/aliments/new">Créer un aliment</Link>
          </div>
        </section>
      )}
    </div>
  )
}
