import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAppuiLong } from './useAppuiLong'

interface Props {
  /** Lien ouvert au clic hors mode sélection (détail, exécution ou bilan) */
  lien: string
  /** « Pull », « Pull du lun. 26 oct. » : désigne la carte dans le nom accessible de la case */
  designation: string
  /** Mode sélection ouvert sur la liste */
  mode: boolean
  choisie: boolean
  onBasculer: () => void
  /** Appui long : ouvre le mode sélection avec cette carte choisie */
  onAppuiLong: () => void
  /** Variante visuelle (ex. « seance__carte--archivee ») */
  classe?: string
  /** Textes de la carte (nom, détails, notes) */
  children: ReactNode
  /** Boutons de la carte (lancer, dates, menu) : masqués en mode sélection, comme l'Android */
  actions?: ReactNode
}

// Carte d'une liste de séances, avec le comportement de sélection de l'Android : appui long = sélectionner, ensuite
// un appui (ou la case) bascule. Hors mode sélection la carte est un lien ; en mode sélection c'est une case à cocher
// (jamais la couleur seule : coche visible et état annoncé).
export function CarteSelectionnable({ lien, designation, mode, choisie, onBasculer, onAppuiLong, classe = '', children, actions }: Props) {
  const appui = useAppuiLong(onAppuiLong)
  return (
    <li className={`seance__carte ${classe} ${choisie ? 'seance__carte--choisie' : ''}`.trim()} {...appui}>
      {mode ? (
        <label className="seance__texte seance__selection">
          <input type="checkbox" checked={choisie} onChange={onBasculer} aria-label={`Sélectionner ${designation}`} />
          <span className="seance__selection-texte">{children}</span>
        </label>
      ) : (
        <>
          <Link to={lien} className="seance__texte seance__ouvrir">
            {children}
          </Link>
          {actions && <div className="seance__actions">{actions}</div>}
        </>
      )}
    </li>
  )
}
