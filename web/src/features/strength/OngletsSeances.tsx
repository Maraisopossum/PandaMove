import { Link } from 'react-router'

export type VueSeances = 'types' | 'programmees' | 'terminees'

const ONGLETS: { id: VueSeances; libelle: string; vers: string }[] = [
  { id: 'types', libelle: 'Types', vers: '/strength' },
  { id: 'programmees', libelle: 'Programmées', vers: '/strength/planned' },
  { id: 'terminees', libelle: 'Terminées', vers: '/strength/done' },
]

interface Props {
  actif: VueSeances
  /** Effectifs affichés à côté des libellés quand l'écran les connaît. */
  comptes?: Partial<Record<VueSeances, number>>
}

// Navigation entre les trois vues du renforcement (séances types, programmées, terminées) : de simples liens vers les
// écrans existants ; la vue courante porte aria-current. Aucune logique de données ici.
export function OngletsSeances({ actif, comptes }: Props) {
  return (
    <nav className="onglets-seances" aria-label="Vues des séances">
      {ONGLETS.map((o) => (
        <Link key={o.id} to={o.vers} className="onglets-seances__onglet" aria-current={o.id === actif ? 'page' : undefined}>
          {o.libelle}
          {comptes?.[o.id] !== undefined && <span className="onglets-seances__compte">{comptes[o.id]}</span>}
        </Link>
      ))}
    </nav>
  )
}
