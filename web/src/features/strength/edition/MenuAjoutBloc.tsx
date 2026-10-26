import { useId, useState, type CSSProperties } from 'react'
import { LIBELLES_BLOC, TYPES_BLOC, type TypeBloc } from '../draft'
import { couleursBloc } from '../execute/navExercices'
import { DESCRIPTIONS_BLOC, ICONES_BLOC } from './regles'

// Menu des 5 types de bloc (Android AddBlocRow) : un bouton qui déplie la liste ; Échap la referme.
export function MenuAjoutBloc({ onAjouter }: { onAjouter: (type: TypeBloc) => void }) {
  const [ouvert, setOuvert] = useState(false)
  const idListe = useId()
  return (
    <div
      className="menu-bloc"
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOuvert(false)
      }}
    >
      <button type="button" className="bouton" aria-expanded={ouvert} aria-controls={ouvert ? idListe : undefined} onClick={() => setOuvert(!ouvert)}>
        <span aria-hidden="true">+</span> Ajouter un bloc
      </button>
      {ouvert && (
        <ul id={idListe} className="menu-bloc__liste">
          {TYPES_BLOC.map((type) => {
            const c = couleursBloc(type)
            return (
              <li key={type}>
                <button
                  type="button"
                  className="bouton menu-bloc__choix"
                  style={{ '--bloc-clair': c.clair, '--bloc-sombre': c.sombre } as CSSProperties}
                  onClick={() => {
                    onAjouter(type)
                    setOuvert(false)
                  }}
                >
                  <span aria-hidden="true">{ICONES_BLOC[type]}</span>
                  <span className="menu-bloc__texte">
                    <span className="menu-bloc__nom">{LIBELLES_BLOC[type]}</span>
                    <span className="aide">{DESCRIPTIONS_BLOC[type]}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
