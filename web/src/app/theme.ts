import { useCallback, useEffect, useState } from 'react'
import { getDb } from '../core/db/client'
import type { Db } from '../core/db/Db'
import { getSettingsExistants, saveSettings } from '../core/db/repos/settings'

export const CLE_THEME = 'pandamove.theme'

// Thème clair par défaut : la préférence du système n'est volontairement pas suivie (l'écran de connexion
// et les illustrations sont dessinés pour le clair). Seul un choix explicite « dark » active le sombre.
export function resoudreSombre(memorise: string | null): boolean {
  return memorise === 'dark'
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

function appliquer(dark: boolean) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

// Appelé avant le premier rendu pour éviter un flash de thème au démarrage (y compris sur l'écran de connexion).
export function initialiserTheme() {
  appliquer(resoudreSombre(lireMemorise()))
}

// Plusieurs composants (coque, écran de profil) montent chacun le hook : un petit bus les garde
// synchronisés quand l'un d'eux change le thème.
const ecouteurs = new Set<(dark: boolean) => void>()
// Incrémenté à chaque choix explicite : une lecture de la base démarrée avant un choix est périmée.
let versionChoix = 0

export interface DepsTheme {
  /** Base des réglages (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  /** Utilisateur connecté ; sans lui, le choix reste local (localStorage). */
  userId?: string
}

// Mode sombre. Premier rendu : choix mémorisé en localStorage (évite le flash de thème), sinon clair. Avec un utilisateur, la valeur de `user_settings.dark_mode` l'emporte dès
// qu'elle est chargée (seulement si une ligne de réglages existe déjà) et chaque changement y est écrit.
export function useDarkMode({ db, userId }: DepsTheme = {}) {
  const [dark, setDarkEtat] = useState(() => resoudreSombre(lireMemorise()))

  useEffect(() => appliquer(dark), [dark])

  useEffect(() => {
    ecouteurs.add(setDarkEtat)
    return () => {
      ecouteurs.delete(setDarkEtat)
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let annule = false
    const version = versionChoix
    getSettingsExistants(db ?? getDb(), userId)
      .then((reglages) => {
        // null = aucun choix explicite : on garde le cache local (clair par défaut)
        if (annule || !reglages || reglages.darkMode === null || version !== versionChoix) return
        ecrireMemorise(reglages.darkMode)
        setDarkEtat(reglages.darkMode)
      })
      .catch((e: unknown) => console.error('Lecture du mode sombre impossible', e))
    return () => {
      annule = true
    }
  }, [db, userId])

  // Version asynchrone : la promesse se résout quand le choix est enregistré en base.
  const enregistrerDark = useCallback(
    async (valeur: boolean) => {
      versionChoix++
      setDarkEtat(valeur)
      ecrireMemorise(valeur)
      for (const ecouteur of ecouteurs) ecouteur(valeur)
      if (userId) await saveSettings(db ?? getDb(), userId, { darkMode: valeur })
    },
    [db, userId],
  )

  const setDark = useCallback(
    (valeur: boolean) => {
      enregistrerDark(valeur).catch((e: unknown) => console.error('Enregistrement du mode sombre impossible', e))
    },
    [enregistrerDark],
  )

  return { dark, setDark, enregistrerDark }
}
