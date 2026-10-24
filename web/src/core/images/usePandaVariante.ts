import { useEffect, useState } from 'react'
import { getDb } from '../db/client'
import type { Db } from '../db/Db'
import { getSettings } from '../db/repos/settings'
import type { PandaVariant } from '../db/types'
import { PANDA_MANIFEST } from './manifest.generated'
import { pandaImage, type ImagePanda, type PandaImageName } from './pandaImage'
import type { TailleImage } from './types'

export interface DepsVariante {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  userId?: string
}

const DEFAUT: PandaVariant = 'male'

// Variante du panda choisie dans le profil (user_settings, lecture seule ; l'écriture reste dans
// useProfile). null tant que la lecture n'est pas terminée ; sans utilisateur ou en cas d'échec : male.
export function usePandaVariante({ db, userId }: DepsVariante = {}): PandaVariant | null {
  const [lue, setLue] = useState<{ userId: string; variante: PandaVariant } | null>(null)

  useEffect(() => {
    if (!userId) return
    let annule = false
    getSettings(db ?? getDb(), userId)
      .then((s) => {
        if (!annule) setLue({ userId, variante: s.pandaVariant })
      })
      .catch((e: unknown) => {
        console.error('Lecture de la variante du panda impossible', e)
        if (!annule) setLue({ userId, variante: DEFAUT })
      })
    return () => {
      annule = true
    }
  }, [db, userId])

  if (!userId) return DEFAUT
  return lue?.userId === userId ? lue.variante : null
}

const estCommune = (nom: PandaImageName) => 'commun' in PANDA_MANIFEST[nom].variantes

// Image du panda pour la variante de l'utilisateur. null tant que la variante n'est pas connue (évite
// d'afficher un instant le panda de l'autre variante) ; une image commune est disponible tout de suite.
export function useImagePanda(nom: PandaImageName, { taille, ...deps }: DepsVariante & { taille?: TailleImage } = {}): ImagePanda | null {
  const variante = usePandaVariante(deps)
  if (variante === null && !estCommune(nom)) return null
  return pandaImage(nom, variante ?? DEFAUT, taille)
}
