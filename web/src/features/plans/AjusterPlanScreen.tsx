import { useState } from 'react'
import { Link } from 'react-router'
import { dateIsoLocale } from '../../core/common/dates'
import { apercuDecalage, proposerAjustements, type Deplacement } from './ajustements'
import { useAccesPlans } from './useAccesPlans'
import { usePlans } from './usePlans'

const jourCourt = (iso: string) => new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8), 12))

// Ajuster le plan : propositions avec leur raison (ignorables), décalage d'une semaine avec aperçu avant d'appliquer et annulation.
// Les dates des jalons et les séances validées ne bougent jamais.
export default function AjusterPlanScreen() {
  const aujourdhui = dateIsoLocale(new Date())
  const p = usePlans({ aujourdhui })
  const acces = useAccesPlans()
  const [depuis, setDepuis] = useState(aujourdhui)
  const [apercu, setApercu] = useState(false)
  const [ignorees, setIgnorees] = useState<string[]>([])
  const [fait, setFait] = useState<Deplacement[] | null>(null)
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)
  const { plan } = p
  const propositions = plan ? proposerAjustements(plan, aujourdhui, p.reglages).filter((x) => !ignorees.includes(x.id)) : []
  const prevu = plan && apercu ? apercuDecalage(plan, depuis) : null

  async function executer(liste: readonly Deplacement[], sens: 1 | -1) {
    setErreur('')
    setEnCours(true)
    try {
      await acces.appliquerDeplacements(liste, sens)
      setFait(sens === 1 ? [...liste] : null)
      setApercu(false)
      p.recharger()
    } catch (e) {
      console.error('Décalage du plan impossible', e)
      setErreur('Le décalage a échoué : certaines séances ont peut-être déjà bougé. Vérifiez le calendrier.')
      p.recharger()
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="plans">
      <h1 className="titre-ecran">Ajuster le plan</h1>
      {p.erreur && <p role="alert">{p.erreur}</p>}
      {p.pret && !plan && <p>Aucune séance de course ou de vélo n’est planifiée. <Link to="/plans">Retour aux plans</Link></p>}
      {plan && (
        <>
          {fait && (
            <section className="plans__carte" aria-labelledby="aj-fait" role="status">
              <h2 id="aj-fait" className="plans__titre">Plan décalé</h2>
              <p>{fait.length} séance{fait.length > 1 ? 's' : ''} décalée{fait.length > 1 ? 's' : ''} d’une semaine.</p>
              <button type="button" className="bouton" disabled={enCours} onClick={() => void executer(fait, -1)}>Annuler le décalage</button>
            </section>
          )}

          <section className="plans__carte" aria-labelledby="aj-prop">
            <h2 id="aj-prop" className="plans__titre">Propositions</h2>
            {propositions.length === 0 ? (
              <p>Aucune proposition pour le moment : la réalisation récente ne demande pas d’ajustement.</p>
            ) : (
              propositions.map((x) => (
                <div key={x.id} className="plans__proposition">
                  <strong>{x.titre}</strong>
                  <p>{x.raison}</p>
                  <div className="plans__actions">
                    <button type="button" className="bouton bouton--principal" onClick={() => { setDepuis(aujourdhui); setApercu(true) }}>Voir l’aperçu</button>
                    <button type="button" className="bouton" onClick={() => setIgnorees((l) => [...l, x.id])}>Ignorer</button>
                  </div>
                </div>
              ))
            )}
            <p className="aide">Chaque proposition affiche sa raison et reste ignorable. Rien n’est appliqué sans aperçu et sans votre validation.</p>
          </section>

          <section className="plans__carte" aria-labelledby="aj-moi">
            <h2 id="aj-moi" className="plans__titre">Décaler d’une semaine</h2>
            <label className="formulaire__champ">
              À partir du
              <input type="date" value={depuis} onChange={(e) => { setDepuis(e.target.value); setApercu(false) }} />
            </label>
            <button type="button" className="bouton" disabled={!depuis} onClick={() => setApercu(true)}>Voir l’aperçu</button>
          </section>

          {prevu && (
            <section className="plans__carte" aria-labelledby="aj-apercu">
              <h2 id="aj-apercu" className="plans__titre">Aperçu du décalage</h2>
              {prevu.deplacements.length === 0 ? (
                <p>Aucune séance à décaler à partir de cette date.</p>
              ) : (
                <>
                  <p><strong>{prevu.deplacements.length} séance{prevu.deplacements.length > 1 ? 's' : ''}</strong> glissent de 7 jours.</p>
                  <ul className="plans__phases">
                    {prevu.deplacements.slice(0, 6).map((d) => (
                      <li key={d.id}><span className="plans__phase-texte"><strong>{d.titre}</strong><span className="plans__phase-detail">{jourCourt(d.de)} → {jourCourt(d.vers)}</span></span></li>
                    ))}
                  </ul>
                  {prevu.deplacements.length > 6 && <p className="aide">… et {prevu.deplacements.length - 6} autres.</p>}
                </>
              )}
              <p className="plans__niveau" role="note">
                Les dates des courses ne bougent pas ({prevu.jalonsFixes} jalon{prevu.jalonsFixes > 1 ? 's' : ''}), ni les séances déjà faites ({prevu.validees}) : l’organisateur fixe les jalons, seul le plan s’étire.
              </p>
              {erreur && <p role="alert">{erreur}</p>}
              <div className="plans__actions">
                <button type="button" className="bouton bouton--principal" disabled={enCours || prevu.deplacements.length === 0} onClick={() => void executer(prevu.deplacements, 1)}>Appliquer</button>
                <button type="button" className="bouton" onClick={() => setApercu(false)}>Annuler</button>
              </div>
            </section>
          )}
          {!prevu && erreur && <p role="alert">{erreur}</p>}
        </>
      )}
    </div>
  )
}
