import { Link } from 'react-router'
import type { Sport } from '../../core/db/repos/sorties'
import { formaterDateCourte } from './presentation'
import { recordsEnAvant } from './presentationRecords'
import type { RecordsSport } from './recordsSorties'

// Bandeau « Records » de la liste : trois records et un lien vers la page complète. Rien sans record.
export function BandeauRecords({ sport, records, chemin }: { sport: Sport; records: RecordsSport; chemin: string }) {
  const lignes = recordsEnAvant(sport, records)
  if (lignes.length === 0) return null
  return (
    <section className="sorties__records" aria-labelledby={`records-${sport}`}>
      <div className="sorties__semaine-tete">
        <h2 id={`records-${sport}`}>Records</h2>
        <Link to={`${chemin}/records`} className="sorties__semaine-lien">
          Tout voir
        </Link>
      </div>
      <ul className="sorties__records-liste">
        {lignes.map((l) => (
          <li key={l.id} className="sorties__record">
            <span className="sorties__record-libelle">{l.libelle}</span>
            <span className="sorties__record-valeur">{l.valeur}</span>
            <span className="sorties__record-date">{formaterDateCourte(l.date)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
