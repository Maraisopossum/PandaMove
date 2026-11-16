import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { LIBELLE_REPAS, REPAS } from '../../core/nutrition/calculs'
import { AnneauKcal, BarreMacro } from './composants'
import { decalerJour, decimal, entier, jourDemande, libelleJour } from './outils'
import { apportDuJour, apportDuRepas, entreesDuRepas, eauDuJour, useJournalNutrition } from './useJournalNutrition'

const PAS_EAU = [250, 500] as const

// Journal du jour : anneau d'énergie, macros, hydratation et quatre repas. Le jour se change avec ‹ › ou le sélecteur de date.
export default function NutritionScreen({ aujourdhui = dateIsoLocale(new Date()) }: { aujourdhui?: string }) {
  const [params, setParams] = useSearchParams()
  const date = jourDemande(params.get('date'), aujourdhui)
  const j = useJournalNutrition(date)
  const total = apportDuJour(j.entrees)
  const eau = eauDuJour(j.entrees)
  const o = j.objectifs
  const versJour = (d: string) => setParams(d === aujourdhui ? {} : { date: d }, { replace: true })
  // Raccourci « Ajouter 250 ml d'eau » (appui long sur l'icône, boutons du widget) : `?action=eau` ajoute l'eau UNE fois puis retire le
  // paramètre de l'adresse (un rechargement ne réajoute rien) ; l'annulation reste à un toucher.
  const [eauAjoutee, setEauAjoutee] = useState<string | null>(null)
  const actionTraitee = useRef(false)
  const demandeEau = params.get('action') === 'eau'
  useEffect(() => {
    if (!demandeEau || actionTraitee.current) return
    actionTraitee.current = true
    void j.ajouterEauAnnulable(PAS_EAU[0]).then(setEauAjoutee)
    setParams({}, { replace: true })
    // Une seule fois par arrivée sur l'écran
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandeEau])
  const lien = (chemin: string, repas?: string) => `${chemin}?date=${date}${repas ? `&repas=${repas}` : ''}`

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Nutrition</h1>
      {j.erreur && <p role="alert">{j.erreur}</p>}
      {eauAjoutee !== null && (
        <p role="status" className="nutri__eau-ajoutee">
          {PAS_EAU[0]} ml ajoutés ·{' '}
          <button type="button" className="plans__lien nutri__lien-bouton" onClick={() => void j.supprimer(eauAjoutee).then(() => setEauAjoutee(null))}>
            Annuler
          </button>
        </p>
      )}

      <nav className="nutri__jour" aria-label="Choisir le jour">
        <button type="button" className="bouton nutri__fleche" aria-label="Jour précédent" onClick={() => versJour(decalerJour(date, -1))}>‹</button>
        <label className="nutri__jour-champ">
          <span className="nutri__jour-libelle">{libelleJour(date, aujourdhui)}</span>
          <input type="date" aria-label="Date du journal" value={date} max={decalerJour(aujourdhui, 365)} onChange={(e) => e.target.value && versJour(e.target.value)} />
        </label>
        <button type="button" className="bouton nutri__fleche" aria-label="Jour suivant" onClick={() => versJour(decalerJour(date, 1))}>›</button>
      </nav>

      <section className="plans__carte nutri__resume" aria-label="Bilan du jour">
        <AnneauKcal consomme={total.kcal} objectif={o?.kcal ?? null} />
        <div className="nutri__macros">
          <BarreMacro libelle="Protéines" valeur={total.proteines} objectif={o?.proteinesG ?? null} classe="proteines" />
          <BarreMacro libelle="Glucides" valeur={total.glucides} objectif={o?.glucidesG ?? null} classe="glucides" />
          <BarreMacro libelle="Lipides" valeur={total.lipides} objectif={o?.lipidesG ?? null} classe="lipides" />
        </div>
        {!o && j.pret && <p className="aide">Aucun objectif défini : <Link className="plans__lien" to="/nutrition/objectifs">calculer mes objectifs</Link>.</p>}
      </section>

      <div className="nutri__raccourcis">
        <Link className="bouton bouton--principal" to={lien('/nutrition/photo')}>Photographier mon assiette</Link>
        <Link className="bouton" to={lien('/nutrition/ajouter')}>Ajouter un aliment</Link>
      </div>

      <section className="plans__carte" aria-labelledby="nu-eau">
        <h2 id="nu-eau" className="plans__titre">Hydratation <span className="plans__sous">{entier(eau)}{o ? ` / ${entier(o.eauMl)}` : ''} ml</span></h2>
        {o && o.eauMl > 0 && (
          <div className="nutri__barre" role="progressbar" aria-label="Eau" aria-valuemin={0} aria-valuemax={o.eauMl} aria-valuenow={Math.min(eau, o.eauMl)} aria-valuetext={`${entier(eau)} ml sur ${entier(o.eauMl)} ml`}>
            <span className="nutri__barre-rempli nutri__barre-rempli--eau" style={{ width: `${Math.min(100, Math.round((eau / o.eauMl) * 100))}%` }} />
          </div>
        )}
        <div className="nutri__eau-actions">
          {PAS_EAU.map((ml) => (
            <button key={ml} type="button" className="bouton" onClick={() => void j.ajouterEau(ml)}>+ {ml} ml</button>
          ))}
          <button type="button" className="bouton" disabled={eau === 0} onClick={() => void j.annulerDerniereEau()}>Annuler le dernier</button>
        </div>
      </section>

      {REPAS.map((repas) => {
        const lignes = entreesDuRepas(j.entrees, repas)
        const a = apportDuRepas(j.entrees, repas)
        const titre = `nu-${repas}`
        return (
          <section key={repas} className="plans__carte" aria-labelledby={titre}>
            <h2 id={titre} className="plans__titre">{LIBELLE_REPAS[repas]} <span className="plans__sous">{lignes.length > 0 ? `${entier(a.kcal)} kcal` : ''}</span></h2>
            {lignes.length > 0 && (
              <ul className="plans__phases nutri__lignes">
                {lignes.map((e) => (
                  <li key={e.id}>
                    <Link className="plans__phase-texte" to={`/nutrition/entree/${e.id}`}>
                      <strong>{e.nom}</strong>
                      <span className="plans__phase-detail">{e.quantiteG > 0 ? `${decimal(e.quantiteG)} g · ` : ''}{entier(e.apport.kcal)} kcal · P {decimal(e.apport.proteines)} · G {decimal(e.apport.glucides)} · L {decimal(e.apport.lipides)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="hyrox__liens">
              <Link className="plans__lien" to={lien('/nutrition/ajouter', repas)}>+ Ajouter</Link>
              <Link className="plans__lien" to={lien('/nutrition/photo', repas)}>Photo</Link>
              {lignes.length === 0 && j.repasHier.includes(repas) && (
                <button type="button" className="plans__lien nutri__lien-bouton" onClick={() => void j.copierDepuisHier(repas)}>Copier celui d’hier</button>
              )}
            </div>
          </section>
        )
      })}

      <section className="plans__carte" aria-label="Aller plus loin">
        <div className="hyrox__liens">
          <Link className="plans__lien" to="/nutrition/bilan">Bilan de la semaine</Link>
          <Link className="plans__lien" to="/nutrition/aliments">Mes aliments</Link>
          <Link className="plans__lien" to="/nutrition/objectifs">Objectifs</Link>
        </div>
      </section>
    </div>
  )
}
