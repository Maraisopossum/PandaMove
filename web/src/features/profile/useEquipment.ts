import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb } from '../../core/db/client'
import type { Db } from '../../core/db/Db'
import { getSettings, saveSettingsTx } from '../../core/db/repos/settings'
import { EQUIPMENT_CATEGORIES, lireEquipementStocke, type EquipmentStocke } from '../../core/import/equipment'
import type { DisquesConfig, EquipmentInventaire, HalteresConfig, PlageConfig } from '../../core/progression/types'
import { apercuCharges } from './equipementForm'

export interface DepsMateriel {
  /** Base à utiliser (défaut : base de l'application, résolue à l'usage). */
  db?: Db
  userId?: string
}

/** Charges atteignables formatées pour l'affichage (null : matériel non renseigné). */
export interface ApercuMateriel {
  halteres: string[]
  barre: string[] | null
  kettlebell: string[] | null
  cable: string[] | null
}

export function calculerApercu(inv: EquipmentInventaire): ApercuMateriel {
  return {
    halteres: apercuCharges(inv.halteres),
    barre: inv.barre ? apercuCharges(inv.barre) : null,
    kettlebell: inv.kettlebell ? apercuCharges(inv.kettlebell) : null,
    cable: inv.cable ? apercuCharges(inv.cable) : null,
  }
}

// « Mon matériel » : lit et écrit exactement la forme stockée dans user_settings.equipment_json
// (inventaire + selectedCategories + pasParCategorie). Chaque écriture relit la valeur courante dans
// la même transaction, puis ne modifie que sa partie : les autres rubriques sont préservées.
export function useEquipment({ db, userId }: DepsMateriel = {}) {
  const [stocke, setStocke] = useState<EquipmentStocke>(() => lireEquipementStocke(null))
  const [charge, setCharge] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let annule = false
    getSettings(db ?? getDb(), userId)
      .then((s) => {
        if (annule) return
        setStocke(lireEquipementStocke(s.equipmentJson))
        setCharge(true)
      })
      .catch((e: unknown) => console.error('Chargement du matériel impossible', e))
    return () => {
      annule = true
    }
  }, [db, userId])

  const modifier = useCallback(
    async (transformer: (courant: EquipmentStocke) => EquipmentStocke) => {
      if (!userId) throw new Error('Utilisateur non connecté.')
      const suivant = await (db ?? getDb()).writeTransaction(async (tx) => {
        const courant = lireEquipementStocke((await getSettings(tx, userId)).equipmentJson)
        const nouveau = transformer(courant)
        await saveSettingsTx(tx, userId, { equipmentJson: JSON.stringify(nouveau) })
        return nouveau
      })
      setStocke(suivant)
    },
    [db, userId],
  )

  const setHalteres = useCallback((halteres: HalteresConfig) => modifier((s) => ({ ...s, halteres })), [modifier])
  const setBarre = useCallback((barre: DisquesConfig) => modifier((s) => ({ ...s, barre })), [modifier])
  const setKettlebell = useCallback((kettlebell: PlageConfig) => modifier((s) => ({ ...s, kettlebell })), [modifier])
  const setCable = useCallback((cable: PlageConfig) => modifier((s) => ({ ...s, cable })), [modifier])

  const setPas = useCallback(
    async (categorie: string, pasKg: number) => {
      if (!EQUIPMENT_CATEGORIES.includes(categorie)) throw new Error(`Catégorie inconnue : ${categorie}`)
      if (!Number.isFinite(pasKg) || pasKg <= 0) throw new Error('Le pas doit être un nombre de kg strictement positif.')
      await modifier((s) => ({ ...s, pasParCategorie: { ...s.pasParCategorie, [categorie]: pasKg } }))
    },
    [modifier],
  )

  const setCategories = useCallback(
    (categories: string[]) =>
      modifier((s) => ({ ...s, selectedCategories: categories.filter((c) => EQUIPMENT_CATEGORIES.includes(c)) })),
    [modifier],
  )

  // Case à cocher d'une catégorie : l'échec est exposé dans `erreur` (pas de rejet non géré côté écran).
  const basculerCategorie = useCallback(
    async (categorie: string, coche: boolean) => {
      setErreur(null)
      try {
        await modifier((s) => {
          const sans = s.selectedCategories.filter((c) => c !== categorie)
          return { ...s, selectedCategories: coche ? [...sans, categorie] : sans }
        })
      } catch (e) {
        console.error('Enregistrement des catégories impossible', e)
        setErreur("L'enregistrement a échoué.")
      }
    },
    [modifier],
  )

  const inventaire: EquipmentInventaire = useMemo(
    () => ({ halteres: stocke.halteres, barre: stocke.barre, kettlebell: stocke.kettlebell, cable: stocke.cable }),
    [stocke],
  )
  const apercu = useMemo(() => calculerApercu(inventaire), [inventaire])

  return {
    charge,
    inventaire,
    categories: stocke.selectedCategories,
    pasParCategorie: stocke.pasParCategorie,
    apercu,
    setHalteres,
    setBarre,
    setKettlebell,
    setCable,
    setPas,
    setCategories,
    basculerCategorie,
    erreur,
  }
}
