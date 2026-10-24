import { useCallback, useEffect, useState } from 'react'

export const CLE_THEME = 'pandamove.theme'

// Choix mémorisé > préférence du système. Une valeur inconnue est ignorée.
export function resoudreSombre(memorise: string | null, prefereSombre: boolean): boolean {
  if (memorise === 'dark') return true
  if (memorise === 'light') return false
  return prefereSombre
}

function lireMemorise(): string | null {
  try {
    return localStorage.getItem(CLE_THEME)
  } catch {
    return null
  }
}

function ecrireMemorise(dark: boolean) {
  try {
    localStorage.setItem(CLE_THEME, dark ? 'dark' : 'light')
  } catch {
    /* stockage indisponible : le choix vaut pour la session seulement */
  }
}

function prefereSombre(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function appliquer(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

// Appelé avant le premier rendu pour éviter un flash de thème clair (y compris sur l'écran de connexion).
export function initialiserTheme() {
  appliquer(resoudreSombre(lireMemorise(), prefereSombre()))
}

// Mode sombre. Tâche 11 : le persister dans `user_settings` (le dépôt des réglages n'existe
// pas encore) ; en attendant, localStorage + préférence du système.
export function useDarkMode() {
  const [dark, setDarkEtat] = useState(() => resoudreSombre(lireMemorise(), prefereSombre()))

  useEffect(() => appliquer(dark), [dark])

  const setDark = useCallback((valeur: boolean) => {
    setDarkEtat(valeur)
    ecrireMemorise(valeur)
  }, [])

  return { dark, setDark }
}
