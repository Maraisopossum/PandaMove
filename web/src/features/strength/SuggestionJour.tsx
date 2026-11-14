import { urlIcone } from '../../app/modules'
import type { AlerteCharge, GroupeVolume, SuggestionSeance } from './suggestionsRenfo'
import { JOURS_EQUILIBRE } from './useSuggestionsRenfo'

// Cartes d'aide au choix, en tête des séances types : séance suggérée d'après l'équilibre musculaire des 14 derniers jours, et
// alerte de charge. Indicatif : ces cartes ne remplacent ni un programme ni les sensations. Aucune logique : tout vient de
// useSuggestionsRenfo.

/** Barres de l'équilibre : les groupes les plus travaillés puis ceux en retard que la séance travaille, du plus au moins travaillé. */
function lignesEquilibre(s: SuggestionSeance): GroupeVolume[] {
  const tous = [...s.plusTravailles, ...s.enRetard.slice(0, 2)]
  return tous.filter((g, i) => tous.findIndex((x) => x.groupe === g.groupe) === i).sort((a, b) => b.series - a.series)
}

export function SuggestionJour({
  suggestion, nom, detail, nombre, onLancer, onAutreIdee, enCours,
}: { suggestion: SuggestionSeance; nom: string; detail: string; nombre: number; onLancer: () => void; onAutreIdee: () => void; enCours: boolean }) {
  const lignes = lignesEquilibre(suggestion)
  const max = Math.max(1, ...lignes.map((g) => g.series))
  const enRetard = new Set(suggestion.enRetard.map((g) => g.groupe))
  return (
    <section className="renfo-suggestion" aria-labelledby="renfo-suggestion-titre">
      <div className="renfo-suggestion__tete">
        <h2 id="renfo-suggestion-titre">Séance suggérée aujourd’hui</h2>
        <span className="aide">d’après vos {JOURS_EQUILIBRE} derniers jours</span>
      </div>
      <div className="renfo-suggestion__corps">
        <img className="renfo-suggestion__icone" src={urlIcone('halteres')} alt="" width={52} height={52} decoding="async" />
        <div>
          <p className="renfo-suggestion__nom">{nom}</p>
          {detail && <p className="aide">{detail}</p>}
          <p className="renfo-suggestion__explication">{suggestion.explication}</p>
        </div>
      </div>
      <ul className="renfo-suggestion__barres" aria-label={`Séries par groupe musculaire sur ${JOURS_EQUILIBRE} jours`}>
        {lignes.map((g) => (
          <li key={g.groupe}>
            <span>{g.libelle}</span>
            <span className="renfo-suggestion__piste" aria-hidden="true">
              <span className={enRetard.has(g.groupe) ? 'renfo-suggestion__barre renfo-suggestion__barre--retard' : 'renfo-suggestion__barre'} style={{ width: `${Math.max(4, Math.round((g.series / max) * 100))}%` }} />
            </span>
            <span className="renfo-suggestion__valeur">{g.series}</span>
          </li>
        ))}
      </ul>
      <div className="renfo-suggestion__actions">
        <button type="button" className="bouton bouton--principal" disabled={enCours} aria-label={`Commencer ${nom}`} onClick={onLancer}>
          Commencer
        </button>
        {nombre > 1 && (
          <button type="button" className="bouton" onClick={onAutreIdee}>
            Autre idée
          </button>
        )}
      </div>
    </section>
  )
}

export function AlerteChargeCarte({ alerte }: { alerte: AlerteCharge }) {
  return (
    <section className="renfo-alerte" aria-labelledby="renfo-alerte-titre">
      <h2 id="renfo-alerte-titre">Charge de la semaine en hausse</h2>
      <p>
        Votre tonnage des 7 derniers jours est {alerte.pourcentage} % au-dessus de votre moyenne des 4 semaines précédentes. Une semaine plus légère, avec moins
        de séries, aide à récupérer avant de reprendre la progression.
      </p>
      <p className="aide">Indicateur indicatif : il ne remplace pas vos sensations.</p>
    </section>
  )
}
