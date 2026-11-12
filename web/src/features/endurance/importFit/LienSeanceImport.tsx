import { useState } from 'react'
import { formaterDateCourte } from '../presentation'
import type { ResultatImport } from './useImportFit'

// Après l'import d'une sortie : choix de la séance du calendrier qu'elle réalise. La séance du jour (ou la plus proche) est
// proposée en premier ; « Ne pas lier » reste le choix de départ. Lier valide la séance (logique dans useImportFit).
export function LienSeanceImport({ resultat, onLier }: { resultat: ResultatImport; onLier: (sortieId: string, seanceId: string) => Promise<void> }) {
  const [choix, setChoix] = useState('')
  if (!resultat.sortieId) return null
  if (resultat.liee) return <p className="sorties__import-lien">Liée à « {resultat.liee.titre} » du {formaterDateCourte(resultat.liee.date)} : séance validée.</p>
  const candidats = resultat.candidats ?? []
  if (candidats.length === 0) return <p className="sorties__import-lien outils__chiffre-detail">Aucune séance programmée proche à lier.</p>
  // Le choix mémorisé peut avoir disparu (séance liée à une autre sortie) : retour à « Ne pas lier »
  const valeur = candidats.some((s) => s.id === choix) ? choix : ''
  return (
    <div className="sorties__import-lien">
      <label className="formulaire__champ">
        Lier à une séance du calendrier
        <select value={valeur} onChange={(e) => setChoix(e.target.value)}>
          <option value="">Ne pas lier</option>
          {candidats.map((s) => (
            <option key={s.id} value={s.id}>
              {formaterDateCourte(s.date)} · {s.titre}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="bouton" disabled={valeur === ''} onClick={() => void onLier(resultat.sortieId as string, valeur)}>
        Lier cette séance
      </button>
    </div>
  )
}
