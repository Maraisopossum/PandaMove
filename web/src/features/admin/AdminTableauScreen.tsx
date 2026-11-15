import { Link } from 'react-router'
import { useComptes, useResume } from './useAdmin'

// Tableau de bord technique : inscrits, comptes actifs, répartition des versions. Métadonnées seulement, jamais de données d'entraînement.
export default function AdminTableauScreen() {
  const resume = useResume()
  const comptes = useComptes()
  const versions = new Map<string, number>()
  if (comptes.etat === 'pret') for (const c of comptes.donnees) versions.set(c.versionApp ?? 'inconnue', (versions.get(c.versionApp ?? 'inconnue') ?? 0) + 1)

  return (
    <div className="plans admin">
      <h1 className="titre-ecran">Administration</h1>
      <p className="aide">Vue technique des comptes : aucune séance, aucun poids ni aucune sortie n’est lisible ici.</p>
      {resume.etat === 'erreur' && <p role="alert">{resume.message}</p>}
      {resume.etat === 'pret' && (
        <section className="plans__carte" aria-labelledby="ad-resume">
          <h2 id="ad-resume" className="plans__titre">Comptes</h2>
          <div className="outils__chiffres">
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Inscrits</span><strong>{resume.donnees.inscrits}</strong></div>
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Actifs sur 7 jours</span><strong>{resume.donnees.actifs7j}</strong></div>
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Actifs sur 30 jours</span><strong>{resume.donnees.actifs30j}</strong></div>
            <div className="outils__chiffre"><span className="outils__chiffre-libelle">Suspendus</span><strong>{resume.donnees.suspendus}</strong></div>
          </div>
        </section>
      )}
      {comptes.etat === 'pret' && versions.size > 0 && (
        <section className="plans__carte" aria-labelledby="ad-versions">
          <h2 id="ad-versions" className="plans__titre">Versions de l’application</h2>
          <ul className="plans__phases">
            {[...versions.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => (
              <li key={v}><span className="plans__phase-texte"><strong>{v}</strong><span className="plans__phase-detail">{n} compte{n > 1 ? 's' : ''}</span></span></li>
            ))}
          </ul>
        </section>
      )}
      <div className="hyrox__liens">
        <Link className="plans__lien" to="/admin/comptes">Liste des comptes</Link>
        <Link className="plans__lien" to="/admin/journal">Journal d’audit</Link>
      </div>
    </div>
  )
}
