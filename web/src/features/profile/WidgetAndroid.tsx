import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { getSupabase } from '../../core/db/client'
import type { ClientSupabase } from '../../core/db/clientSupabase'
import { adresseFonctionWidget, creerJeton, ilYaDepuis, listerJetons, reglerEauJeton, revoquerJeton, type JetonWidget } from '../../core/widget/jetons'

const MAINTENANT = () => new Date()
const dateCourte = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(iso))

// Section « Widget Android » du profil : relier un widget (jeton montré une seule fois), voir les widgets reliés et la date de leur dernière
// lecture, les révoquer, accorder ou retirer le droit d'ajouter de l'eau. Le jeton ne donne accès qu'à des totaux du jour (jamais un nom
// d'aliment, jamais le mot de passe). Logique d'accès dans core/widget/jetons.ts.
export function WidgetAndroid({ client, maintenant = MAINTENANT, adresse = adresseFonctionWidget() }: { client?: ClientSupabase; maintenant?: () => Date; adresse?: string | null } = {}) {
  const supabase = () => client ?? getSupabase()
  const [jetons, setJetons] = useState<JetonWidget[] | null>(null)
  const [illisible, setIllisible] = useState(false)
  const [version, setVersion] = useState(0)
  const [ouvert, setOuvert] = useState(false)
  const [nom, setNom] = useState('')
  const [eau, setEau] = useState(false)
  const [nouveau, setNouveau] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [aRevoquer, setARevoquer] = useState<string | null>(null)
  const relire = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let annule = false
    Promise.resolve()
      .then(() => listerJetons(supabase()))
      .then((l) => {
        if (annule) return
        setJetons(l ?? [])
        setIllisible(l === null)
      })
      .catch(() => !annule && (setJetons([]), setIllisible(true)))
    return () => {
      annule = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  async function agir(action: () => Promise<void>, ok?: string) {
    setErreur('')
    setMessage('')
    setOccupe(true)
    try {
      await action()
      if (ok) setMessage(ok)
      relire()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’action a échoué.')
    } finally {
      setOccupe(false)
    }
  }

  async function relier(ev: FormEvent) {
    ev.preventDefault()
    if (!nom.trim()) return
    setErreur('')
    setOccupe(true)
    try {
      setNouveau(await creerJeton(supabase(), nom, eau))
      setOuvert(false)
      setNom('')
      setEau(false)
      relire()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'La liaison a échoué.')
    } finally {
      setOccupe(false)
    }
  }

  async function copier(texte: string, libelle: string) {
    try {
      await navigator.clipboard.writeText(texte)
      setMessage(`${libelle} copié.`)
    } catch {
      setMessage('Copie impossible : recopiez-le à la main.')
    }
  }

  const now = maintenant()
  return (
    <section className="profil__carte" aria-labelledby="profil-widget">
      <h2 id="profil-widget">Widget Android</h2>
      <p>
        Affiche l’énergie restante, les macros et l’eau du jour sur l’écran d’accueil. Il lit des totaux avec un jeton qui ne sert qu’à cela : jamais votre mot de
        passe, jamais un nom d’aliment. Vous pouvez le révoquer à tout moment.
      </p>
      {illisible && <p role="status">La liste des widgets n’a pas pu être lue (migration 0021 à appliquer, ou hors ligne).</p>}
      {erreur && <p role="alert">{erreur}</p>}
      {message && <p role="status" className="profil__retour">{message}</p>}

      {nouveau && (
        <div className="profil__widget-jeton" role="group" aria-label="Jeton du nouveau widget">
          <p><strong>Copiez-le maintenant : il ne sera plus affiché.</strong> Dans l’application du widget, choisissez « Relier » puis collez l’adresse et le jeton.</p>
          {adresse && (
            <>
              <p className="aide">Adresse du serveur</p>
              <code className="profil__widget-code">{adresse}</code>
              <button type="button" className="bouton" onClick={() => void copier(adresse, 'Adresse')}>Copier l’adresse</button>
            </>
          )}
          <p className="aide">Jeton</p>
          <code className="profil__widget-code">{nouveau}</code>
          <div className="formulaire__ligne">
            <button type="button" className="bouton bouton--principal" onClick={() => void copier(nouveau, 'Jeton')}>Copier le jeton</button>
            <button type="button" className="bouton" onClick={() => { setNouveau(null); setMessage('') }}>J’ai fini</button>
          </div>
        </div>
      )}

      {jetons && jetons.length > 0 && (
        <ul className="profil__widgets" aria-label="Widgets reliés">
          {jetons.map((j) => {
            const lecture = ilYaDepuis(j.derniereLectureLe, now)
            return (
              <li key={j.id} className="profil__widget">
                <div className="profil__widget-texte">
                  <strong>{j.nom}</strong>
                  <span className="aide">Créé le {dateCourte(j.creeLe)} · {lecture ? `lu ${lecture}` : 'jamais lu'}</span>
                  <label className="profil__widget-eau">
                    <input type="checkbox" checked={j.ecritureEau} disabled={occupe} onChange={(e) => void agir(() => reglerEauJeton(supabase(), j.id, e.target.checked))} aria-label={`Ajouter de l’eau depuis ${j.nom}`} />
                    <span>Peut ajouter de l’eau</span>
                  </label>
                </div>
                {aRevoquer === j.id ? (
                  <div className="profil__widget-actions">
                    <button type="button" className="bouton bouton--alerte" disabled={occupe} onClick={() => void agir(() => revoquerJeton(supabase(), j.id).then(() => setARevoquer(null)), `« ${j.nom} » révoqué.`)}>
                      Confirmer la révocation
                    </button>
                    <button type="button" className="bouton" onClick={() => setARevoquer(null)}>Annuler</button>
                  </div>
                ) : (
                  <button type="button" className="bouton bouton--alerte" onClick={() => setARevoquer(j.id)} aria-label={`Révoquer ${j.nom}`}>Révoquer</button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {jetons && jetons.length === 0 && !illisible && !nouveau && <p className="aide">Aucun widget relié pour l’instant.</p>}

      {!ouvert && (
        <button type="button" className="bouton" onClick={() => { setOuvert(true); setNouveau(null); setMessage('') }}>Relier un widget</button>
      )}
      {ouvert && (
        <form className="profil__objectifs-form" onSubmit={(e) => void relier(e)}>
          <div className="formulaire__champ">
            <label htmlFor="widget-nom">Nom du widget</label>
            <input id="widget-nom" value={nom} maxLength={60} autoFocus placeholder="Mon téléphone" onChange={(e) => setNom(e.target.value)} />
          </div>
          <label className="profil__widget-eau">
            <input type="checkbox" checked={eau} onChange={(e) => setEau(e.target.checked)} />
            <span>Ajouter de l’eau depuis le widget (le bouton « + 250 ml » écrit directement, sans ouvrir PandaMove)</span>
          </label>
          <div className="formulaire__ligne">
            <button type="button" className="bouton" onClick={() => setOuvert(false)}>Annuler</button>
            <button type="submit" className="bouton bouton--principal" disabled={occupe || !nom.trim()}>Créer le jeton</button>
          </div>
        </form>
      )}
    </section>
  )
}
