import { useState } from 'react'
import { Link } from 'react-router'
import { useComptes } from './useAdmin'

const dateHeure = (iso: string | null) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : 'jamais')

// Liste des comptes (lecture seule) : e-mail, inscription, dernière connexion et synchro, version, statut. Les actions (inviter, suspendre,
// supprimer) passent par une fonction serveur et viendront dans une prochaine étape.
export default function AdminComptesScreen() {
  const comptes = useComptes()
  const [recherche, setRecherche] = useState('')
  const filtres = comptes.etat === 'pret' ? comptes.donnees.filter((c) => (c.email ?? '').toLowerCase().includes(recherche.trim().toLowerCase())) : []

  return (
    <div className="plans admin">
      <h1 className="titre-ecran">Comptes</h1>
      {comptes.etat === 'chargement' && <p>Chargement…</p>}
      {comptes.etat === 'erreur' && <p role="alert">{comptes.message}</p>}
      {comptes.etat === 'pret' && (
        <>
          <label className="formulaire__champ">
            Rechercher un e-mail
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </label>
          <p className="aide">{filtres.length} compte{filtres.length > 1 ? 's' : ''} sur {comptes.donnees.length}.</p>
          <ul className="plans__phases" aria-label="Comptes">
            {filtres.map((c) => (
              <li key={c.userId}>
                <span className="plans__phase-texte">
                  <strong>{c.email ?? c.userId}{c.statut === 'suspendu' ? ' · suspendu' : ''}</strong>
                  <span className="plans__phase-detail">
                    Inscrit le {dateHeure(c.inscritAt)} · connexion : {dateHeure(c.derniereConnexionAt)} · synchro : {dateHeure(c.derniereSynchroAt)} · version {c.versionApp ?? 'inconnue'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link className="plans__lien" to="/admin">Retour à l’administration</Link>
    </div>
  )
}
