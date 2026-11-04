import { useEffect, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { lireMethode } from '../../core/db/repos/respiration'
import { depuisMethodePerso, trouverIntegree, type Methode } from './methodes'

// Méthode d'une séance d'après l'identifiant de l'URL : intégrée (immédiat) ou personnalisée (lue en base).
// `methode` est null si l'identifiant est inconnu ou si la lecture échoue.
export function useMethodeSession(id: string, db?: Db): { methode: Methode | null; chargement: boolean } {
  const integree = trouverIntegree(id)
  const [lue, setLue] = useState<{ id: string; methode: Methode | null } | null>(null)

  useEffect(() => {
    if (integree) return
    let annule = false
    lireMethode(db ?? getDb(), id)
      .then((m) => !annule && setLue({ id, methode: m ? depuisMethodePerso(m) : null }))
      .catch((e: unknown) => {
        console.error('Chargement de la méthode impossible', e)
        if (!annule) setLue({ id, methode: null })
      })
    return () => {
      annule = true
    }
  }, [id, integree, db])

  if (integree) return { methode: integree, chargement: false }
  if (lue?.id !== id) return { methode: null, chargement: true }
  return { methode: lue.methode, chargement: false }
}
