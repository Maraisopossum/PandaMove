import { Link } from 'react-router'
import { useSante } from './useAdmin'

/** Au-delà de ce nombre de jours sans synchro, un compte est signalé comme « hors ligne depuis longtemps ». */
export const SEUIL_JOURS_SANS_SYNCHRO = 7

const dateHeure = (iso: string) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

// Santé de la synchro : comptes sans synchro depuis longtemps et envois rejetés définitivement par le serveur (par table et par code d'erreur).
// Aucune donnée d'entraînement : jamais le contenu d'une ligne rejetée.
export default function AdminSanteScreen() {
  const sante = useSante()
  const comptes = sante.etat === 'pret' ? sante.donnees : []
  const anciens = comptes.filter((c) => c.joursSansSynchro === null || c.joursSansSynchro >= SEUIL_JOURS_SANS_SYNCHRO)
  const avecRejets = comptes.filter((c) => c.rejetsTotal > 0)
  const parCode = new Map<string, number>()
  for (const c of comptes) for (const r of c.rejets) parCode.set(`${r.table} · ${r.code}`, (parCode.get(`${r.table} · ${r.code}`) ?? 0) + r.nb)

  return (
    <div className="plans admin">
      <h1 className="titre-ecran">Santé de la synchro</h1>
      <p className="aide">Comptes sans synchro récente et envois refusés par le serveur. Aucune donnée d’entraînement n’est rapportée, seulement la table et le code d’erreur.</p>
      {sante.etat === 'chargement' && <p>Chargement…</p>}
      {sante.etat === 'erreur' && <p role="alert">{sante.message}</p>}
      {sante.etat === 'pret' && (
        <>
          <section className="plans__carte" aria-labelledby="as-rejets">
            <h2 id="as-rejets" className="plans__titre">Envois rejetés <span className="plans__sous">{comptes.reduce((t, c) => t + c.rejetsTotal, 0)} au total</span></h2>
            {parCode.size === 0 ? (
              <p>Aucun envoi rejeté signalé.</p>
            ) : (
              <ul className="plans__phases">
                {[...parCode.entries()].sort((a, b) => b[1] - a[1]).map(([cle, n]) => (
                  <li key={cle}><span className="plans__phase-texte"><strong>{cle}</strong><span className="plans__phase-detail">{n} fois</span></span></li>
                ))}
              </ul>
            )}
            {avecRejets.length > 0 && (
              <ul className="plans__phases" aria-label="Comptes concernés">
                {avecRejets.map((c) => (
                  <li key={c.userId}>
                    <span className="plans__phase-texte">
                      <strong>{c.email ?? c.userId}</strong>
                      <span className="plans__phase-detail">{c.rejets.map((r) => `${r.table} ${r.code} ×${r.nb} (dernier : ${dateHeure(r.dernierAt)})`).join(' · ')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="plans__carte" aria-labelledby="as-anciens">
            <h2 id="as-anciens" className="plans__titre">Sans synchro depuis {SEUIL_JOURS_SANS_SYNCHRO} jours ou plus <span className="plans__sous">{anciens.length}</span></h2>
            {anciens.length === 0 ? (
              <p>Tous les comptes ont synchronisé récemment.</p>
            ) : (
              <ul className="plans__phases" aria-label="Comptes hors ligne depuis longtemps">
                {anciens.map((c) => (
                  <li key={c.userId}>
                    <span className="plans__phase-texte">
                      <strong>{c.email ?? c.userId}</strong>
                      <span className="plans__phase-detail">{c.joursSansSynchro === null ? 'jamais synchronisé' : `${c.joursSansSynchro} jours sans synchro`} · version {c.versionApp ?? 'inconnue'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <Link className="plans__lien" to="/admin">Retour à l’administration</Link>
    </div>
  )
}
