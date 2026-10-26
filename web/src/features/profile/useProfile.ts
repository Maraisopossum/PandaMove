import { useCallback, useEffect, useState } from 'react'
import { useDarkMode } from '../../app/theme'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { getSettings, saveSettings } from '../../core/db/repos/settings'
import type { PandaVariant } from '../../core/db/types'

export interface DepsProfil {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  userId?: string
}

// Réglages du profil : variante du panda et mode sombre, persistés dans user_settings.
export function useProfile({ db, userId }: DepsProfil = {}) {
  const [pandaVariant, setVariante] = useState<PandaVariant>('male')
  const [charge, setCharge] = useState(false)
  const { dark, enregistrerDark } = useDarkMode({ db, userId })

  useEffect(() => {
    if (!userId) return
    let annule = false
    getSettings(db ?? getDb(), userId)
      .then((s) => {
        if (annule) return
        setVariante(s.pandaVariant)
        setCharge(true)
      })
      .catch((e: unknown) => console.error('Chargement du profil impossible', e))
    return () => {
      annule = true
    }
  }, [db, userId])

  const setPandaVariant = useCallback(
    async (variante: PandaVariant) => {
      if (!userId) throw new Error('Utilisateur non connecté.')
      await saveSettings(db ?? getDb(), userId, { pandaVariant: variante })
      setVariante(variante)
    },
    [db, userId],
  )

  // Variantes pour l'écran : l'échec est exposé dans `erreur` au lieu d'un rejet non géré.
  const [erreur, setErreur] = useState<string | null>(null)
  const proteger = useCallback(async (action: () => Promise<void>) => {
    setErreur(null)
    try {
      await action()
    } catch (e) {
      console.error('Enregistrement du profil impossible', e)
      setErreur("L'enregistrement a échoué.")
    }
  }, [])
  const changerVariante = useCallback((v: PandaVariant) => proteger(() => setPandaVariant(v)), [proteger, setPandaVariant])
  const changerDark = useCallback((valeur: boolean) => proteger(() => enregistrerDark(valeur)), [proteger, enregistrerDark])

  return { charge, pandaVariant, setPandaVariant, dark, setDark: enregistrerDark, erreur, changerVariante, changerDark }
}
