import type { Db, DbLecture, DbTx } from '../Db'
import { deterministicId } from '../ids'
import type { PandaVariant, UserSettings } from '../types'
import type { Ligne } from './mappers'

// Valeurs par défaut quand aucune ligne n'existe (equipmentJson '{}' = aucun matériel déclaré).
const DEFAUTS: UserSettings = { pandaVariant: 'male', darkMode: false, equipmentJson: '{}' }

// Une seule ligne par utilisateur : l'id est déterministe pour que deux appareils hors-ligne
// convergent vers la même ligne au lieu d'en créer deux.
const idReglages = (userId: string) => deterministicId(userId, 'user_settings')

// Réglages enregistrés, ou null si l'utilisateur n'en a encore jamais écrit (permet de distinguer
// « jamais configuré » d'un réglage explicitement à sa valeur par défaut).
export async function getSettingsExistants(db: DbLecture, userId: string): Promise<UserSettings | null> {
  const ligne = await db.getOptional<Ligne>(
    'SELECT * FROM user_settings WHERE id = ? AND deleted_at IS NULL',
    [idReglages(userId)],
  )
  if (!ligne) return null
  return {
    pandaVariant: ((ligne.panda_variant as string | null) ?? DEFAUTS.pandaVariant) as PandaVariant,
    darkMode: ligne.dark_mode === 1,
    equipmentJson: (ligne.equipment_json as string | null) ?? DEFAUTS.equipmentJson,
  }
}

export async function getSettings(db: DbLecture, userId: string): Promise<UserSettings> {
  return (await getSettingsExistants(db, userId)) ?? { ...DEFAUTS }
}

// Version transactionnelle (réutilisée par l'import, qui regroupe tout dans une seule transaction).
// Upsert : lecture puis UPDATE ou INSERT (les tables PowerSync sont des vues, on évite ON CONFLICT).
// Ressuscite une ligne supprimée (deleted_at remis à NULL).
export async function saveSettingsTx(tx: DbTx, userId: string, patch: Partial<UserSettings>): Promise<void> {
  const id = idReglages(userId)
  const existante = await tx.getOptional<Ligne>('SELECT * FROM user_settings WHERE id = ?', [id])
  const courant = existante && existante.deleted_at === null
    ? {
        pandaVariant: ((existante.panda_variant as string | null) ?? DEFAUTS.pandaVariant) as PandaVariant,
        darkMode: existante.dark_mode === 1,
        equipmentJson: (existante.equipment_json as string | null) ?? DEFAUTS.equipmentJson,
      }
    : DEFAUTS
  const fusion = { ...courant, ...patch }
  const valeurs = [fusion.equipmentJson, fusion.pandaVariant, fusion.darkMode ? 1 : 0, new Date().toISOString()]
  if (existante) {
    await tx.execute(
      'UPDATE user_settings SET equipment_json = ?, panda_variant = ?, dark_mode = ?, updated_at = ?, deleted_at = NULL WHERE id = ?',
      [...valeurs, id],
    )
  } else {
    await tx.execute(
      'INSERT INTO user_settings (equipment_json, panda_variant, dark_mode, updated_at, id, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [...valeurs, id, userId],
    )
  }
}

export async function saveSettings(db: Db, userId: string, patch: Partial<UserSettings>): Promise<void> {
  await db.writeTransaction((tx) => saveSettingsTx(tx, userId, patch))
}

