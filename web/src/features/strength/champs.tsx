import { useId, type ReactNode } from 'react'
import { useChampNombre } from './useChampNombre'

// Champs de formulaire étiquetés, sans logique métier : la conversion texte -> valeur vit dans saisie.ts.

export function ChampTexte({ libelle, valeur, onChange }: { libelle: string; valeur: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div className="formulaire__champ">
      <label htmlFor={id}>{libelle}</label>
      <input id={id} type="text" value={valeur} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function ChampNombre({ libelle, valeur, onChange }: { libelle: string; valeur: number; onChange: (v: number) => void }) {
  const id = useId()
  // Champ obligatoire : la saisie vide donne NaN, que la validation refuse.
  const { texte, changer } = useChampNombre(valeur, false, (v) => onChange(v ?? Number.NaN))
  return (
    <div className="formulaire__champ">
      <label htmlFor={id}>{libelle}</label>
      <input id={id} type="text" inputMode="decimal" value={texte} onChange={(e) => changer(e.target.value)} />
    </div>
  )
}

export function ChampNombreFacultatif({ libelle, valeur, onChange }: { libelle: string; valeur: number | null; onChange: (v: number | null) => void }) {
  const id = useId()
  const { texte, changer } = useChampNombre(valeur, true, onChange)
  return (
    <div className="formulaire__champ">
      <label htmlFor={id}>{libelle}</label>
      <input id={id} type="text" inputMode="decimal" value={texte} onChange={(e) => changer(e.target.value)} />
    </div>
  )
}

export function ChampCase({ libelle, valeur, onChange }: { libelle: string; valeur: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="formulaire__case">
      <input type="checkbox" checked={valeur} onChange={(e) => onChange(e.target.checked)} />
      {libelle}
    </label>
  )
}

export function ChampChoix({
  libelle, valeur, options, onChange,
}: {
  libelle: string
  valeur: string
  options: { valeur: string; libelle: string }[]
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <div className="formulaire__champ">
      <label htmlFor={id}>{libelle}</label>
      <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </div>
  )
}

export function Grille({ children }: { children: ReactNode }) {
  return <div className="formulaire__grille">{children}</div>
}
