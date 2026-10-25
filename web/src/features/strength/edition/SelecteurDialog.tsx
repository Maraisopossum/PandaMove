import { useId, useRef, type CSSProperties } from 'react'
import { COULEURS_GROUPE } from '../../../core/catalogue/couleursGroupes'
import { LIBELLES_GROUPE } from '../../../core/catalogue/muscleToGroup'
import { MUSCLE_GROUPS } from '../../../core/db/types'
import { ChampTexte } from '../champs'
import { libelleMuscle } from '../catalog/libelles'
import { usePiegeFocus } from '../usePiegeFocus'
import type { useSelecteurExercices } from './useSelecteurExercices'

type Selecteur = ReturnType<typeof useSelecteurExercices>

// Sélecteur d'exercices (Android ExercicePickerSheet) : recherche, « Mon matériel », groupes musculaires, cases à
// cocher. Les exercices sont ajoutés dans l'ordre des coches ; le rang de chaque coche est affiché.
export function SelecteurDialog({ selecteur: s, titreCible }: { selecteur: Selecteur; titreCible: string }) {
  const racine = useRef<HTMLDivElement>(null)
  const idTitre = useId()
  usePiegeFocus(racine, s.fermer)
  const n = s.selection.length

  return (
    <div className="dialogue__voile dialogue__voile--bas">
      <div ref={racine} className="dialogue dialogue--selecteur" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <h2 id={idTitre}>Ajouter des exercices</h2>
        <p className="aide">{titreCible}</p>

        <ChampTexte libelle="Rechercher un exercice" valeur={s.filtre.query} onChange={s.setQuery} />

        <div className="puces" role="group" aria-label="Filtres">
          <button type="button" className="puce" aria-pressed={s.filtre.seulementDisponible} onClick={s.basculerDisponible}>
            Mon matériel
          </button>
          <button type="button" className="puce" aria-pressed={s.filtre.groupe === null} onClick={() => s.setGroupe(null)}>
            Tous
          </button>
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              className="puce puce--groupe"
              style={{ '--groupe': COULEURS_GROUPE[g] } as CSSProperties}
              aria-pressed={s.filtre.groupe === g}
              onClick={() => s.setGroupe(s.filtre.groupe === g ? null : g)}
            >
              {LIBELLES_GROUPE[g]}
            </button>
          ))}
        </div>

        {s.resultats.length === 0 ? (
          <p>Aucun exercice trouvé.</p>
        ) : (
          <ul className="selecteur__liste selecteur__liste--cases">
            {s.resultats.map((x) => {
              const rang = s.selection.indexOf(x.id)
              return (
                <li key={x.id}>
                  <label className={`selecteur__ligne${rang >= 0 ? ' selecteur__ligne--choisi' : ''}`}>
                    <input type="checkbox" checked={rang >= 0} onChange={() => s.basculer(x.id)} />
                    <span className="selecteur__nom">
                      {x.name}
                      {x.musclePrimary.trim() !== '' && <span className="aide"> {libelleMuscle(x.musclePrimary)}</span>}
                    </span>
                    {rang >= 0 && (
                      <span className="selecteur__rang" aria-label={`numéro ${rang + 1}`}>
                        {rang + 1}
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        )}

        <div className="formulaire__ligne dialogue__pied">
          <button type="button" className="bouton" onClick={s.fermer}>
            Fermer
          </button>
          <button type="button" className="bouton bouton--principal" disabled={n === 0} onClick={s.confirmer}>
            {n === 0 ? 'Ajouter' : `Ajouter (${n})`}
          </button>
        </div>
      </div>
    </div>
  )
}
