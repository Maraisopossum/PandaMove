import { useId, useRef } from 'react'
import type { FormulaireAffectation, ModeAffectation, UniteRecurrence } from './planification'
import { usePiegeFocus } from './usePiegeFocus'

interface Props {
  nomSeance: string
  form: FormulaireAffectation
  erreur: string | null
  apercu: string | null
  enCours: boolean
  onMode: (mode: ModeAffectation) => void
  onChamp: (patch: Partial<FormulaireAffectation>) => void
  onAjouterDate: () => void
  onRetirerDate: (date: string) => void
  onConfirmer: () => void
  onFermer: () => void
}

const MODES: { valeur: ModeAffectation; libelle: string }[] = [
  { valeur: 'une', libelle: 'Une date' },
  { valeur: 'plusieurs', libelle: 'Plusieurs dates' },
  { valeur: 'repeter', libelle: 'Répéter' },
]

const UNITES: { valeur: UniteRecurrence; libelle: string }[] = [
  { valeur: 'jour', libelle: 'jours' },
  { valeur: 'semaine', libelle: 'semaines' },
  { valeur: 'mois', libelle: 'mois (30 jours)' },
]

const FINS: { valeur: FormulaireAffectation['fin']; libelle: string }[] = [
  { valeur: 'occurrences', libelle: 'Après un nombre de séances' },
  { valeur: 'date', libelle: 'À une date' },
  { valeur: 'jamais', libelle: "Sans fin (un an au plus)" },
]

const jmaa = (iso: string) => iso.split('-').reverse().join('/')

// Dialogue modal d'affectation au calendrier (coins arrondis 28 px, comme AssignSessionDialogs Android) : une date,
// plusieurs dates ou une répétition. Focus piégé, Échap ferme, le focus revient au bouton d'origine.
export function AssignDialog({
  nomSeance, form, erreur, apercu, enCours, onMode, onChamp, onAjouterDate, onRetirerDate, onConfirmer, onFermer,
}: Props) {
  const racine = useRef<HTMLDivElement>(null)
  const idTitre = useId()
  const idGroupe = useId()
  const idDate = useId()
  const idPas = useId()
  const idUnite = useId()
  const idFin = useId()
  const idNb = useId()
  const idDateFin = useId()
  usePiegeFocus(racine, onFermer)

  return (
    <div className="dialogue__voile">
      <div ref={racine} className="dialogue" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onConfirmer()
          }}
        >
          <h2 id={idTitre}>Affecter « {nomSeance} »</h2>

          <fieldset className="dialogue__groupe" aria-labelledby={idGroupe}>
            <legend id={idGroupe}>Quand ?</legend>
            <div className="dialogue__modes">
              {MODES.map((m) => (
                <label key={m.valeur} className="dialogue__mode">
                  <input type="radio" name={idGroupe} checked={form.mode === m.valeur} onChange={() => onMode(m.valeur)} />
                  {m.libelle}
                </label>
              ))}
            </div>
          </fieldset>

          {form.mode === 'une' && (
            <div className="formulaire__champ">
              <label htmlFor={idDate}>Date de la séance</label>
              <input id={idDate} type="date" value={form.date} onChange={(e) => onChamp({ date: e.target.value })} required />
            </div>
          )}

          {form.mode === 'plusieurs' && (
            <>
              <div className="formulaire__champ">
                <label htmlFor={idDate}>Date à ajouter</label>
                <div className="formulaire__ligne">
                  <input id={idDate} type="date" value={form.date} onChange={(e) => onChamp({ date: e.target.value })} />
                  <button type="button" className="bouton" onClick={onAjouterDate}>
                    Ajouter cette date
                  </button>
                </div>
              </div>
              {form.dates.length === 0 ? (
                <p className="dialogue__aide">Aucune date choisie. Ajoutez-en autant que nécessaire.</p>
              ) : (
                <ul className="dialogue__dates" aria-label="Dates choisies">
                  {form.dates.map((d) => (
                    <li key={d}>
                      <span>{jmaa(d)}</span>
                      <button type="button" className="bouton" aria-label={`Retirer le ${jmaa(d)}`} onClick={() => onRetirerDate(d)}>
                        <span aria-hidden="true">✕</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {form.mode === 'repeter' && (
            <>
              <div className="formulaire__champ">
                <label htmlFor={idDate}>Première séance</label>
                <input id={idDate} type="date" value={form.date} onChange={(e) => onChamp({ date: e.target.value })} required />
              </div>
              <div className="formulaire__grille">
                <div className="formulaire__champ">
                  <label htmlFor={idPas}>Tous les</label>
                  <input id={idPas} type="number" inputMode="numeric" min={1} max={365} value={form.pas} onChange={(e) => onChamp({ pas: e.target.value })} />
                </div>
                <div className="formulaire__champ">
                  <label htmlFor={idUnite}>Unité</label>
                  <select id={idUnite} value={form.unite} onChange={(e) => onChamp({ unite: e.target.value as UniteRecurrence })}>
                    {UNITES.map((u) => (
                      <option key={u.valeur} value={u.valeur}>
                        {u.libelle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="formulaire__champ">
                <label htmlFor={idFin}>Fin de la répétition</label>
                <select id={idFin} value={form.fin} onChange={(e) => onChamp({ fin: e.target.value as FormulaireAffectation['fin'] })}>
                  {FINS.map((f) => (
                    <option key={f.valeur} value={f.valeur}>
                      {f.libelle}
                    </option>
                  ))}
                </select>
              </div>
              {form.fin === 'occurrences' && (
                <div className="formulaire__champ">
                  <label htmlFor={idNb}>Nombre de séances</label>
                  <input id={idNb} type="number" inputMode="numeric" min={1} max={365} value={form.occurrences} onChange={(e) => onChamp({ occurrences: e.target.value })} />
                </div>
              )}
              {form.fin === 'date' && (
                <div className="formulaire__champ">
                  <label htmlFor={idDateFin}>Jusqu'au</label>
                  <input id={idDateFin} type="date" value={form.dateFin} onChange={(e) => onChamp({ dateFin: e.target.value })} />
                </div>
              )}
            </>
          )}

          {apercu && (
            <p className="dialogue__aide" role="status">
              {apercu}
            </p>
          )}
          {erreur && (
            <p role="alert" className="import__erreur">
              {erreur}
            </p>
          )}
          <div className="formulaire__ligne">
            <button type="submit" className="bouton" disabled={enCours}>
              Confirmer
            </button>
            <button type="button" className="bouton" onClick={onFermer}>
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
