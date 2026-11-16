import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { getDb, getSupabase } from '../../core/db/client'
import type { ClientSupabase } from '../../core/db/clientSupabase'
import { ajouterEntrees } from '../../core/db/repos/nutrition'
import { estRepas, LIBELLE_REPAS, REPAS, sommer } from '../../core/nutrition/calculs'
import { analyserAssiette, apportEstime, enregistrerFournisseurChoisi, fournisseurInitial, lireFournisseurChoisi, listerFournisseursIa, reduireImage, type AlimentEstime, type AnalysePhoto, type FournisseursIa } from '../../core/nutrition/photo'
import { ajusterQuantite, decimal, entier, jourDemande, libelleJour, repasDemande } from './outils'

type Etape = { nom: 'choix' } | { nom: 'analyse' } | { nom: 'revue'; analyse: AnalysePhoto }

const PAS = [-50, -10, 10, 50] as const

function Ligne({ a, changer, retirer }: { a: AlimentEstime; changer: (a: AlimentEstime) => void; retirer: () => void }) {
  const apport = apportEstime(a)
  return (
    <li className="nutri__estime">
      <div className="nutri__estime-tete">
        <input aria-label="Nom de l’aliment" value={a.nom} maxLength={200} onChange={(e) => changer({ ...a, nom: e.target.value })} />
        {a.confiance === 'faible' && <span className="nutri__verifier">À vérifier</span>}
        <button type="button" className="bouton" aria-label={`Retirer ${a.nom}`} onClick={retirer}>×</button>
      </div>
      <div className="nutri__stepper nutri__stepper--4" role="group" aria-label={`Quantité de ${a.nom}`}>
        {PAS.filter((p) => p < 0).map((p) => <button key={p} type="button" className="bouton nutri__pas" aria-label={`Retirer ${-p} grammes de ${a.nom}`} onClick={() => changer({ ...a, quantiteG: ajusterQuantite(a.quantiteG, p) })}>{p}</button>)}
        <label className="nutri__saisie">
          <span className="nutri__saisie-libelle">Quantité (g)</span>
          <input type="number" inputMode="decimal" min={0} step="any" value={a.quantiteG} onChange={(e) => changer({ ...a, quantiteG: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        {PAS.filter((p) => p > 0).map((p) => <button key={p} type="button" className="bouton nutri__pas" aria-label={`Ajouter ${p} grammes de ${a.nom}`} onClick={() => changer({ ...a, quantiteG: ajusterQuantite(a.quantiteG, p) })}>+{p}</button>)}
      </div>
      <p className="plans__phase-detail">{entier(apport.kcal)} kcal · P {decimal(apport.proteines)} · G {decimal(apport.glucides)} · L {decimal(apport.lipides)}</p>
    </li>
  )
}

function Revue({ analyse, repasInitial, date, aujourdhui, recommencer }: { analyse: AnalysePhoto; repasInitial: (typeof REPAS)[number]; date: string; aujourdhui: string; recommencer: () => void }) {
  const navigate = useNavigate()
  const [aliments, setAliments] = useState(analyse.aliments)
  const [repas, setRepas] = useState(repasInitial)
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const total = sommer(aliments.map(apportEstime))
  const valides = aliments.filter((a) => a.nom.trim() && a.quantiteG > 0)

  async function ajouter() {
    setOccupe(true)
    setErreur('')
    try {
      await ajouterEntrees(getDb(), valides.map((a) => ({ date, repas, nom: a.nom.trim(), quantiteG: a.quantiteG, apport: apportEstime(a), source: 'ia' as const })))
      navigate(date === aujourdhui ? '/nutrition' : `/nutrition?date=${date}`)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’ajout a échoué.')
      setOccupe(false)
    }
  }

  if (!analyse.estUnRepas) {
    return (
      <section className="plans__carte" aria-labelledby="ph-vide">
        <h2 id="ph-vide" className="plans__titre">Rien d’identifiable</h2>
        <p>{analyse.remarque ?? 'Je ne reconnais pas de nourriture sur cette photo.'}</p>
        <div className="nutri__raccourcis">
          <button type="button" className="bouton bouton--principal" onClick={recommencer}>Reprendre une photo</button>
          <Link className="bouton" to={`/nutrition/ajouter?date=${date}&repas=${repas}`}>Saisir à la main</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="plans__carte" aria-labelledby="ph-revue">
      <h2 id="ph-revue" className="plans__titre">Ce que j’ai reconnu <span className="plans__sous">{entier(total.kcal)} kcal</span></h2>
      <p className="aide" role="note">Estimation à vérifier : corrigez les quantités avant d’ajouter. Les sauces et les matières grasses se voient mal sur une photo.</p>
      {analyse.remarque && <p className="aide">{analyse.remarque}</p>}
      {aliments.length === 0 && <p>Plus aucune ligne : reprenez une photo ou saisissez le repas à la main.</p>}
      <ul className="nutri__estimes">
        {aliments.map((a, i) => (
          <Ligne key={i} a={a} changer={(n) => setAliments((l) => l.map((x, j) => (j === i ? n : x)))} retirer={() => setAliments((l) => l.filter((_, j) => j !== i))} />
        ))}
      </ul>
      <dl className="nutri__apports" aria-live="polite">
        <div><dt>Énergie</dt><dd>{entier(total.kcal)} kcal</dd></div>
        <div><dt>Protéines</dt><dd>{decimal(total.proteines)} g</dd></div>
        <div><dt>Glucides</dt><dd>{decimal(total.glucides)} g</dd></div>
        <div><dt>Lipides</dt><dd>{decimal(total.lipides)} g</dd></div>
      </dl>
      <label className="formulaire__champ">
        Repas
        <select value={repas} onChange={(e) => estRepas(e.target.value) && setRepas(e.target.value)}>
          {REPAS.map((r) => <option key={r} value={r}>{LIBELLE_REPAS[r]}</option>)}
        </select>
      </label>
      {erreur && <p role="alert">{erreur}</p>}
      <div className="nutri__raccourcis">
        <button type="button" className="bouton bouton--principal" disabled={occupe || valides.length === 0} onClick={() => void ajouter()}>Ajouter au {LIBELLE_REPAS[repas].toLowerCase()}</button>
        <button type="button" className="bouton" disabled={occupe} onClick={recommencer}>Reprendre une photo</button>
      </div>
    </section>
  )
}

// Photo de l'assiette : la photo est réduite sur l'appareil, analysée par un modèle de vision (fonction analyser-assiette), puis les aliments
// reconnus sont montrés, corrigeables, avant d'être ajoutés au journal. La photo n'est jamais conservée.
export default function PhotoAssietteScreen({ aujourdhui = dateIsoLocale(new Date()), client }: { aujourdhui?: string; client?: ClientSupabase }) {
  const [params] = useSearchParams()
  const date = jourDemande(params.get('date'), aujourdhui)
  const repas = repasDemande(params.get('repas'))
  const [etape, setEtape] = useState<Etape>({ nom: 'choix' })
  const [apercu, setApercu] = useState<string | null>(null)
  const [indication, setIndication] = useState('')
  const [erreur, setErreur] = useState('')
  const [services, setServices] = useState<FournisseursIa>({ defaut: null, fournisseurs: [] })
  const [service, setService] = useState<string | null>(null)

  // Services d'IA configurés côté serveur : le choix n'apparaît que s'il y en a plusieurs ; le dernier choix de l'appareil est repris.
  useEffect(() => {
    let actif = true
    void listerFournisseursIa(client ?? getSupabase()).then((liste) => {
      if (!actif) return
      setServices(liste)
      setService(fournisseurInitial(liste, lireFournisseurChoisi()))
    })
    return () => { actif = false }
  }, [client])

  useEffect(() => () => { if (apercu) URL.revokeObjectURL(apercu) }, [apercu])

  async function analyser(fichier: File | undefined) {
    if (!fichier) return
    setErreur('')
    setApercu(URL.createObjectURL(fichier))
    setEtape({ nom: 'analyse' })
    try {
      const image = await reduireImage(fichier)
      setEtape({ nom: 'revue', analyse: await analyserAssiette(client ?? getSupabase(), image, indication, service) })
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’analyse a échoué.')
      setEtape({ nom: 'choix' })
    }
  }

  const recommencer = () => {
    setApercu(null)
    setErreur('')
    setEtape({ nom: 'choix' })
  }

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Photo de l’assiette</h1>
      <p className="aide">{LIBELLE_REPAS[repas]} · {libelleJour(date, aujourdhui)}</p>

      {etape.nom === 'revue' ? (
        <>
          {apercu && <img className="nutri__apercu" src={apercu} alt="Photo de l’assiette analysée" />}
          <Revue analyse={etape.analyse} repasInitial={repas} date={date} aujourdhui={aujourdhui} recommencer={recommencer} />
        </>
      ) : (
        <section className="plans__carte" aria-labelledby="ph-choix">
          <h2 id="ph-choix" className="plans__titre">{etape.nom === 'analyse' ? 'Analyse en cours…' : 'Prenez votre repas en photo'}</h2>
          {apercu && <img className="nutri__apercu" src={apercu} alt="Photo choisie" />}
          {etape.nom === 'analyse' ? (
            <p role="status">Je regarde l’assiette, cela prend quelques secondes.</p>
          ) : (
            <>
              <p className="aide">Vue de dessus, bien éclairée, avec tout le repas dans le cadre. La photo est envoyée au service d’IA pour l’analyse, puis supprimée : PandaMove ne la conserve pas.</p>
              {services.fournisseurs.length > 1 && (
                <label className="formulaire__champ">
                  Analyser avec
                  <select value={service ?? ''} onChange={(e) => { setService(e.target.value); enregistrerFournisseurChoisi(e.target.value) }}>
                    {services.fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}
                  </select>
                </label>
              )}
              {services.fournisseurs.length === 1 && <p className="aide">Service d’analyse : {services.fournisseurs[0].libelle}.</p>}
              <label className="formulaire__champ">
                Précision (facultatif)
                <input value={indication} maxLength={200} onChange={(e) => setIndication(e.target.value)} placeholder="2 œufs au plat, sans sauce…" />
              </label>
              {erreur && <p role="alert">{erreur}</p>}
              <div className="nutri__raccourcis">
                <label className="bouton bouton--principal nutri__fichier">
                  Prendre une photo
                  <input type="file" accept="image/*" capture="environment" onChange={(e) => void analyser(e.target.files?.[0])} />
                </label>
                <label className="bouton nutri__fichier">
                  Choisir dans la galerie
                  <input type="file" accept="image/*" onChange={(e) => void analyser(e.target.files?.[0])} />
                </label>
              </div>
              <Link className="plans__lien" to={`/nutrition/ajouter?date=${date}&repas=${repas}`}>Saisir à la main</Link>
            </>
          )}
        </section>
      )}
    </div>
  )
}
