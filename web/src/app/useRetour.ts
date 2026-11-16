import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { parentDe } from './parents'

export interface Retour {
  libelle: string
  aller: () => void
}

// Bouton Retour de la barre du haut : monte d'un niveau (voir parents.ts). Si l'écran parent est celui d'où l'on vient juste d'arriver
// (lien suivi depuis lui), on revient en arrière dans l'historique : le défilement et l'état du parent sont retrouvés, et l'historique ne
// s'allonge pas d'allers-retours. Sinon (adresse ouverte directement, rappel, raccourci), on REMPLACE l'écran courant par son parent : le
// bouton Retour du système ramène alors à l'écran d'avant, pas à celui qu'on vient de quitter.
export function useRetour(): Retour | null {
  const { pathname, search } = useLocation()
  const type = useNavigationType()
  const navigate = useNavigate()
  const courant = useRef(pathname)
  const precedent = useRef<string | null>(null)

  useEffect(() => {
    if (courant.current !== pathname) {
      precedent.current = courant.current
      courant.current = pathname
    }
  }, [pathname])

  const parent = parentDe(pathname, search)
  const vers = parent?.vers ?? null
  const aller = useCallback(() => {
    if (vers === null) return
    if (type === 'PUSH' && precedent.current === vers.split('?')[0]) void navigate(-1)
    else void navigate(vers, { replace: true })
  }, [navigate, type, vers])

  return parent ? { libelle: parent.libelle, aller } : null
}
