import { useId } from 'react'
import { assemblerDuree, decouperDuree } from './resume'

// Durée cible en minutes + secondes ; la valeur stockée (repsCibles) est le total de secondes.
export function DureeMinSec({ libelle, repsCibles, onChange }: { libelle: string; repsCibles: string; onChange: (repsCibles: string) => void }) {
  const idMin = useId()
  const idSec = useId()
  const { min, sec } = decouperDuree(repsCibles)
  return (
    <fieldset className="duree">
      <legend>{libelle}</legend>
      <div className="duree__champs">
        <div className="formulaire__champ">
          <label htmlFor={idMin}>Minutes</label>
          <input id={idMin} type="text" inputMode="numeric" placeholder="0" value={min} onChange={(e) => onChange(assemblerDuree(e.target.value, sec))} />
        </div>
        <div className="formulaire__champ">
          <label htmlFor={idSec}>Secondes</label>
          <input id={idSec} type="text" inputMode="numeric" placeholder="0" value={sec} onChange={(e) => onChange(assemblerDuree(min, e.target.value))} />
        </div>
      </div>
    </fieldset>
  )
}
