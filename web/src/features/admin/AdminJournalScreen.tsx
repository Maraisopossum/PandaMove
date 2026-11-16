import { useJournal } from './useAdmin'

const dateHeure = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

// Journal d'audit des actions administrateur : insertion seulement côté serveur, lecture réservée à l'administrateur.
export default function AdminJournalScreen() {
  const journal = useJournal()
  return (
    <div className="plans admin">
      <h1 className="titre-ecran">Journal d’audit</h1>
      {journal.etat === 'chargement' && <p>Chargement…</p>}
      {journal.etat === 'erreur' && <p role="alert">{journal.message}</p>}
      {journal.etat === 'pret' &&
        (journal.donnees.length === 0 ? (
          <p>Aucune action administrateur enregistrée pour le moment.</p>
        ) : (
          <ul className="plans__phases" aria-label="Actions">
            {journal.donnees.map((e) => (
              <li key={e.id}>
                <span className="plans__phase-texte">
                  <strong>{e.action}</strong>
                  <span className="plans__phase-detail">{dateHeure(e.at)}{e.cibleUserId ? ` · compte ${e.cibleUserId}` : ''}{e.detail ? ` · ${e.detail}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
