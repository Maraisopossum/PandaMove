import { useId } from 'react'

interface Option<T extends string> {
  valeur: T
  libelle: string
}

// Choix exclusif présenté en boutons côte à côte (FilterChip Android) : un groupe radio accessible.
export function ChoixSegmente<T extends string>({
  libelle, options, valeur, verrouilleSur, onChoisir,
}: {
  libelle: string
  options: readonly Option<T>[]
  valeur: T | null
  /** Seule option utilisable (les autres sont grisées) */
  verrouilleSur?: T
  onChoisir: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="segment" role="radiogroup" aria-labelledby={id}>
      <span id={id} className="segment__libelle">
        {libelle}
      </span>
      <div className="segment__options">
        {options.map((o) => (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={valeur === o.valeur}
            className="segment__option"
            disabled={verrouilleSur !== undefined && o.valeur !== verrouilleSur}
            onClick={() => onChoisir(o.valeur)}
          >
            {o.libelle}
          </button>
        ))}
      </div>
    </div>
  )
}
