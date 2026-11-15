import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { executerAction, type DemandeAdmin } from '../../core/admin/admin'
import { useAuth } from '../../core/auth/AuthProvider'
import { getSupabase } from '../../core/db/client'
import { useComptes } from './useAdmin'

const dateHeure = (iso: string | null) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : 'jamais')

// Liste des comptes et actions d'administration technique (inviter, suspendre, rétablir, réinitialiser le mot de passe, supprimer). Les actions
// passent par la fonction serveur `admin-comptes` ; l'administrateur ne voit jamais le contenu d'un compte. Chaque action est inscrite au journal.
export default function AdminComptesScreen() {
  const { session } = useAuth()
  const comptes = useComptes()
  const [recherche, setRecherche] = useState('')
  const [invite, setInvite] = useState('')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)
  // Compte dont la suppression est en cours de confirmation, et adresse retapée
  const [aSupprimer, setASupprimer] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const filtres = comptes.etat === 'pret' ? comptes.donnees.filter((c) => (c.email ?? '').toLowerCase().includes(recherche.trim().toLowerCase())) : []

  async function agir(demande: DemandeAdmin) {
    setMessage('')
    setErreur('')
    setEnCours(true)
    try {
      setMessage(await executerAction(getSupabase(), demande))
      setASupprimer(null)
      setConfirmation('')
      comptes.recharger()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'L’action a échoué.')
    } finally {
      setEnCours(false)
    }
  }

  async function inviter(ev: FormEvent) {
    ev.preventDefault()
    await agir({ action: 'inviter', email: invite })
    setInvite('')
  }

  return (
    <div className="plans admin">
      <h1 className="titre-ecran">Comptes</h1>
      {message && <p role="status" className="plans__niveau" data-niveau="bon">{message}</p>}
      {erreur && <p role="alert">{erreur}</p>}

      <section className="plans__carte" aria-labelledby="ac-inviter">
        <h2 id="ac-inviter" className="plans__titre">Inviter</h2>
        <form className="plans__formulaire" onSubmit={(e) => void inviter(e)}>
          <label className="formulaire__champ">
            Adresse e-mail à inviter
            <input type="email" value={invite} onChange={(e) => setInvite(e.target.value)} required />
          </label>
          <button type="submit" className="bouton bouton--principal" disabled={enCours}>Envoyer l’invitation</button>
        </form>
      </section>

      {comptes.etat === 'chargement' && <p>Chargement…</p>}
      {comptes.etat === 'erreur' && <p role="alert">{comptes.message}</p>}
      {comptes.etat === 'pret' && (
        <>
          <label className="formulaire__champ">
            Rechercher un e-mail
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
          <p className="aide">{filtres.length} compte{filtres.length > 1 ? 's' : ''} sur {comptes.donnees.length}.</p>
          <ul className="admin__comptes" aria-label="Comptes">
            {filtres.map((c) => {
              const moi = c.userId === session?.user.id
              return (
                <li key={c.userId} className="plans__carte">
                  <strong>{c.email ?? c.userId}{moi ? ' (vous)' : ''}{c.statut === 'suspendu' ? ' · suspendu' : ''}</strong>
                  <span className="plans__phase-detail">
                    Inscrit le {dateHeure(c.inscritAt)} · connexion : {dateHeure(c.derniereConnexionAt)} · synchro : {dateHeure(c.derniereSynchroAt)} · version {c.versionApp ?? 'inconnue'}
                  </span>
                  {!moi && aSupprimer !== c.userId && (
                    <div className="hyrox__liens">
                      {c.statut === 'suspendu'
                        ? <button type="button" className="bouton" disabled={enCours} onClick={() => void agir({ action: 'retablir', userId: c.userId })}>Rétablir</button>
                        : <button type="button" className="bouton" disabled={enCours} onClick={() => void agir({ action: 'suspendre', userId: c.userId })}>Suspendre</button>}
                      <button type="button" className="bouton" disabled={enCours || !c.email} onClick={() => void agir({ action: 'reinitialiser', userId: c.userId })}>Lien de réinitialisation</button>
                      <button type="button" className="bouton" disabled={enCours} onClick={() => void agir({ action: 'deconnecter', userId: c.userId })}>Déconnecter</button>
                      <button type="button" className="bouton bouton--alerte" disabled={enCours} onClick={() => { setASupprimer(c.userId); setConfirmation('') }}>Supprimer…</button>
                    </div>
                  )}
                  {aSupprimer === c.userId && (
                    <div className="admin__suppression" role="group" aria-label={`Supprimer ${c.email ?? c.userId}`}>
                      <p>Suppression définitive du compte et de toutes ses données (séances, poids, sorties…). La personne doit avoir exporté ses données avant. Retapez son adresse pour confirmer.</p>
                      <label className="formulaire__champ">
                        Adresse e-mail du compte
                        <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
                      </label>
                      <div className="hyrox__liens">
                        <button type="button" className="bouton bouton--alerte" disabled={enCours || confirmation.trim().toLowerCase() !== (c.email ?? '').toLowerCase()} onClick={() => void agir({ action: 'supprimer', userId: c.userId, confirmation })}>Supprimer définitivement</button>
                        <button type="button" className="bouton" onClick={() => setASupprimer(null)}>Annuler</button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <Link className="plans__lien" to="/admin">Retour à l’administration</Link>
    </div>
  )
}
