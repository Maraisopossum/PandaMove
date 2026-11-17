import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { LIBELLE_REPAS, REPAS, type Repas } from '../../core/nutrition/calculs'
import type { PandaImageName } from '../../core/images/pandaImage'
import { PandaIllustration } from '../../core/images/PandaIllustration'
import { AnneauKcal, BarreMacro } from './composants'
import { Chevron } from './icones'
import { bilanDuJour, decalerJour, decimal, entier, jourDemande, libelleJour, messageEau, salutDuJour } from './outils'
import { usePandaNutrition } from './usePandaNutrition'
import { apportDuJour, apportDuRepas, entreesDuRepas, eauDuJour, useJournalNutrition } from './useJournalNutrition'

const PAS_EAU = [250, 500] as const
/** Durée d'affichage de « supprimé · Annuler » avant que la ligne ne soit définitivement retirée de l'écran. */
const DELAI_ANNULATION_MS = 8000

/** Le panda de chaque moment de la journée (dessins faits avec Gemini, voir scripts/build-images.mjs). */
const PANDA_REPAS: Record<Repas, PandaImageName> = {
  petit_dejeuner: 'nutri_petitdej',
  dejeuner: 'nutri_dejeuner',
  collation: 'nutri_collation',
  diner: 'nutri_diner',
}
const MESSAGE_VIDE: Record<Repas, string> = {
  petit_dejeuner: 'Le petit-déjeuner n’est pas encore noté.',
  dejeuner: 'Le déjeuner n’est pas encore noté.',
  collation: 'Rien pour l’instant. Une pomme, des amandes ?',
  diner: 'Le dîner n’est pas encore noté.',
}

// Journal du jour : le panda accueille, l'anneau d'énergie dit où l'on en est, puis l'hydratation et les quatre repas.
// Le jour se change avec les flèches ou le sélecteur de date.
export default function NutritionScreen({ aujourdhui = dateIsoLocale(new Date()) }: { aujourdhui?: string }) {
  const [params, setParams] = useSearchParams()
  const date = jourDemande(params.get('date'), aujourdhui)
  const j = useJournalNutrition(date)
  const image = usePandaNutrition()
  const total = apportDuJour(j.entrees)
  const eau = eauDuJour(j.entrees)
  const o = j.objectifs
  const bilan = bilanDuJour(total.kcal, o?.kcal ?? null, date === aujourdhui)
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

  // Suppression d'une ligne : immédiate, avec un « Annuler » à un toucher (pas de fenêtre bloquante).
  const [supprimee, setSupprimee] = useState<{ id: string; nom: string } | null>(null)
  useEffect(() => {
    if (!supprimee) return
    const minuterie = setTimeout(() => setSupprimee(null), DELAI_ANNULATION_MS)
    return () => clearTimeout(minuterie)
  }, [supprimee])
  async function retirer(id: string, nom: string) {
    if (await j.supprimer(id)) setSupprimee({ id, nom })
  }
  async function retablir() {
    if (!supprimee) return
    const { id } = supprimee
    setSupprimee(null)
    await j.restaurer(id)
  }

  const lien = (chemin: string, repas?: string) => `${chemin}?date=${date}${repas ? `&repas=${repas}` : ''}`
  const part = (v: number, objectif: number) => Math.min(100, Math.round((v / objectif) * 100))
  const aideEau = o && o.eauMl > 0 ? messageEau(eau, o.eauMl) : ''

  return (
    <div className="plans nutri">
      <h1 className="titre-ecran">Nutrition</h1>
      {j.erreur && <p role="alert">{j.erreur}</p>}

      <nav className="nutri__jour" aria-label="Choisir le jour">
        <button type="button" className="bouton nutri__fleche" aria-label="Jour précédent" onClick={() => versJour(decalerJour(date, -1))}><Chevron sens="precedent" /></button>
        <label className="nutri__jour-champ">
          <span className="nutri__jour-libelle">{libelleJour(date, aujourdhui)}</span>
          <input type="date" aria-label="Date du journal" value={date} max={decalerJour(aujourdhui, 365)} onChange={(e) => e.target.value && versJour(e.target.value)} />
        </label>
        <button type="button" className="bouton nutri__fleche" aria-label="Jour suivant" onClick={() => versJour(decalerJour(date, 1))}><Chevron sens="suivant" /></button>
      </nav>

      <section className="plans__carte nutri__hero" aria-label="Bilan du jour">
        <div className="nutri__hero-tete">
          <div className="nutri__hero-texte">
            <p className="nutri__salut">{bilan.atteint ? bilan.titre : salutDuJour(date, aujourdhui, new Date().getHours())}</p>
            <p className="nutri__phrase">{bilan.texte}</p>
          </div>
          <PandaIllustration image={image(bilan.atteint ? 'nutri_objectif' : 'nutri_dejeuner', 'lg')} sizes="132px" decoratif className="nutri__hero-panda" />
        </div>
        <div className="nutri__hero-corps">
          <AnneauKcal consomme={total.kcal} objectif={o?.kcal ?? null} />
          <div className="nutri__macros">
            <BarreMacro libelle="Protéines" valeur={total.proteines} objectif={o?.proteinesG ?? null} classe="proteines" />
            <BarreMacro libelle="Glucides" valeur={total.glucides} objectif={o?.glucidesG ?? null} classe="glucides" />
            <BarreMacro libelle="Lipides" valeur={total.lipides} objectif={o?.lipidesG ?? null} classe="lipides" />
          </div>
        </div>
        {!o && j.pret && <p className="aide">Aucun objectif défini : <Link className="plans__lien" to="/nutrition/objectifs">calculer mes objectifs</Link>.</p>}
      </section>

      <div className="nutri__raccourcis">
        <Link className="bouton bouton--principal" to={lien('/nutrition/photo')}>Photographier mon assiette</Link>
        <Link className="bouton" to={lien('/nutrition/ajouter')}>Ajouter un aliment</Link>
      </div>

      <section className="plans__carte nutri__eau" aria-labelledby="nu-eau">
        <div className="nutri__eau-tete">
          <PandaIllustration image={image('nutri_eau', 'sm')} sizes="88px" decoratif className="nutri__eau-panda" />
          <div className="nutri__eau-texte">
            <h2 id="nu-eau" className="plans__titre">Hydratation <span className="plans__sous">{entier(eau)}{o ? ` / ${entier(o.eauMl)}` : ''} ml</span></h2>
            {o && o.eauMl > 0 && (
              <div className="nutri__barre nutri__barre--eau" role="progressbar" aria-label="Eau" aria-valuemin={0} aria-valuemax={o.eauMl} aria-valuenow={Math.min(eau, o.eauMl)} aria-valuetext={`${entier(eau)} ml sur ${entier(o.eauMl)} ml`}>
                <span className="nutri__barre-rempli nutri__barre-rempli--eau" style={{ width: `${part(eau, o.eauMl)}%` }} />
              </div>
            )}
            {aideEau && <p className="nutri__eau-aide">{aideEau}</p>}
          </div>
        </div>
        <div className="nutri__eau-actions">
          {PAS_EAU.map((ml) => (
            <button key={ml} type="button" className="bouton" onClick={() => void j.ajouterEau(ml)}>+ {ml} ml</button>
          ))}
          <button type="button" className="bouton nutri__discret" disabled={eau === 0} onClick={() => void j.annulerDerniereEau()}>Annuler le dernier</button>
        </div>
      </section>

      {REPAS.map((repas) => {
        const lignes = entreesDuRepas(j.entrees, repas)
        const a = apportDuRepas(j.entrees, repas)
        const titre = `nu-${repas}`
        return (
          <section key={repas} className="plans__carte nutri__repas" aria-labelledby={titre}>
            <div className="nutri__repas-tete">
              <PandaIllustration image={image(PANDA_REPAS[repas], 'sm')} sizes="72px" decoratif className="nutri__repas-panda" />
              <h2 id={titre} className="nutri__repas-nom">{LIBELLE_REPAS[repas]}</h2>
              {lignes.length > 0 && <span className="plans__sous">{entier(a.kcal)} kcal</span>}
            </div>
            {lignes.length > 0 ? (
              <ul className="plans__phases nutri__lignes">
                {lignes.map((e) => (
                  <li key={e.id}>
                    <Link className="plans__phase-texte" to={`/nutrition/entree/${e.id}`}>
                      <strong>{e.nom}</strong>
                      <span className="plans__phase-detail">{e.quantiteG > 0 ? `${decimal(e.quantiteG)} g · ` : ''}{entier(e.apport.kcal)} kcal · P {decimal(e.apport.proteines)} · G {decimal(e.apport.glucides)} · L {decimal(e.apport.lipides)}</span>
                    </Link>
                    <button type="button" className="nutri__suppr" aria-label={`Supprimer ${e.nom}`} onClick={() => void retirer(e.id, e.nom)}>Supprimer</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nutri__vide">{MESSAGE_VIDE[repas]}</p>
            )}
            <div className="nutri__puces">
              <Link className="nutri__puce" to={lien('/nutrition/ajouter', repas)}>+ Ajouter</Link>
              <Link className="nutri__puce" to={lien('/nutrition/photo', repas)}>Photo</Link>
              {lignes.length === 0 && j.repasHier.includes(repas) && (
                <button type="button" className="nutri__puce" onClick={() => void j.copierDepuisHier(repas)}>Copier celui d’hier</button>
              )}
            </div>
          </section>
        )
      })}

      <section className="nutri__puces nutri__puces--pied" aria-label="Aller plus loin">
        <Link className="nutri__puce" to="/nutrition/bilan">Bilan de la semaine</Link>
        <Link className="nutri__puce" to="/nutrition/aliments">Mes aliments</Link>
        <Link className="nutri__puce" to="/nutrition/objectifs">Objectifs</Link>
      </section>

      {(eauAjoutee !== null || supprimee) && (
        <div className="nutri__toasts">
          {eauAjoutee !== null && (
            <p role="status" className="nutri__toast nutri__eau-ajoutee">
              <span>{PAS_EAU[0]} ml ajoutés</span>
              <button type="button" className="nutri__toast-bouton" onClick={() => void j.supprimer(eauAjoutee).then(() => setEauAjoutee(null))}>Annuler</button>
            </p>
          )}
          {supprimee && (
            <p role="status" className="nutri__toast">
              <span>« {supprimee.nom} » supprimé</span>
              <button type="button" className="nutri__toast-bouton" onClick={() => void retablir()}>Annuler</button>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
