import { useEffect, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db } from '../../../core/db/Db'
import { getSettings } from '../../../core/db/repos/settings'
import { lireEquipementStocke, type EquipmentStocke } from '../../../core/import/equipment'

// « Mon matériel » de l'utilisateur (inventaire, catégories, pas), lu une fois à l'ouverture de l'écran.
// Sans utilisateur ou sans réglage : inventaire vide (disques standard, pas par défaut).
export function useMateriel(userId: string | undefined, db?: Db): EquipmentStocke {
  const [materiel, setMateriel] = useState<EquipmentStocke>(() => lireEquipementStocke(null))
  useEffect(() => {
    if (!userId) return
    let annule = false
    getSettings(db ?? getDb(), userId)
      .then((s) => {
        if (!annule) setMateriel(lireEquipementStocke(s.equipmentJson))
      })
      .catch((e: unknown) => console.error('Lecture de « Mon matériel » impossible', e))
    return () => {
      annule = true
    }
  }, [db, userId])
  return materiel
}
