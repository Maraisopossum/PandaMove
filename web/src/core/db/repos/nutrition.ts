import { dateIsoValide } from '../../common/dates'
import { estRepas, sommer, type Apport, type Repas } from '../../nutrition/calculs'
import type { Db, DbLecture } from '../Db'
import { newId } from '../ids'
import type { Ligne } from './mappers'

// Module Nutrition (migration 0020) : aliments personnels, journal alimentaire (dont l'eau) et objectifs.
// Les entrées du journal sont des instantanés : les valeurs sont celles de la quantité mangée au moment de la saisie.

export const TABLE_ALIMENTS = 'aliments'
export const TABLE_REPAS_ENTREES = 'repas_entrees'
export const TABLE_OBJECTIFS_NUTRITION = 'objectifs_nutrition'

export type SourceAliment = 'manuel' | 'off' | 'ia'
export type SourceEntree = 'base' | 'off' | 'manuel' | 'ia' | 'copie' | 'eau'
export type RepasEntree = Repas | 'eau'

// Mêmes bornes que les contraintes SQL de la migration 0020.
export const LIMITES_NUTRITION = {
  nom: 200, marque: 200, codeBarres: 32, portionLabel: 100, profil: 2000,
  portionG: 5000, quantiteG: 20_000, kcal100: 1000, macro100: 100, kcalEntree: 20_000, macroEntree: 2000, eauMl: 20_000,
} as const

export interface Aliment {
  id: string
  nom: string
  marque: string | null
  codeBarres: string | null
  portionG: number
  portionLabel: string | null
  kcal100: number
  proteines100: number
  glucides100: number
  lipides100: number
  fibres100: number | null
  favori: boolean
  source: SourceAliment
  createdAt: string
}

export interface SaisieAliment {
  nom: string
  marque?: string | null
  codeBarres?: string | null
  portionG?: number
  portionLabel?: string | null
  kcal100: number
  proteines100: number
  glucides100: number
  lipides100: number
  fibres100?: number | null
  favori?: boolean
  source?: SourceAliment
}

export interface EntreeJournal {
  id: string
  date: string
  repas: RepasEntree
  nom: string
  quantiteG: number
  apport: Apport
  alimentId: string | null
  source: SourceEntree
  createdAt: string
}

export interface SaisieEntree {
  date: string
  repas: Repas
  nom: string
  quantiteG: number
  apport: Apport
  alimentId?: string | null
  source?: SourceEntree
}

export interface ObjectifNutrition {
  id: string
  kcal: number
  proteinesG: number
  glucidesG: number
  lipidesG: number
  eauMl: number
  profilJson: string | null
}

export interface SaisieObjectif {
  kcal: number
  proteinesG: number
  glucidesG: number
  lipidesG: number
  eauMl: number
  profilJson?: string | null
}

export class ErreurNutrition extends Error {
  readonly code: 'introuvable' | 'invalide'
  constructor(code: 'introuvable' | 'invalide', message: string) {
    super(message)
    this.name = 'ErreurNutrition'
    this.code = code
  }
}

const invalide = (message: string): never => {
  throw new ErreurNutrition('invalide', message)
}
const longueur = (texte: string) => Array.from(texte).length
const nettoyer = (v: string | null | undefined) => (v?.trim() ? v.trim() : null)
const num = (v: unknown): number | null => (v == null ? null : Number(v))
const txt = (v: unknown): string | null => (v == null ? null : String(v))

function nombreEntre(libelle: string, v: number | null | undefined, min: number, max: number): number {
  if (v == null || !Number.isFinite(v) || v < min || v > max) return invalide(`${libelle} doit être un nombre entre ${min} et ${max}.`)
  return v
}

function nomValide(nom: string | null | undefined): string {
  const n = nettoyer(nom)
  if (n === null) return invalide('Donnez un nom.')
  if (longueur(n) > LIMITES_NUTRITION.nom) return invalide(`Le nom est trop long (${LIMITES_NUTRITION.nom} caractères au plus).`)
  return n
}

// ── Aliments personnels ──────────────────────────────────────────────────────────────────────────────────────────────

function validerAliment(s: SaisieAliment) {
  const marque = nettoyer(s.marque)
  if (marque !== null && longueur(marque) > LIMITES_NUTRITION.marque) return invalide('La marque est trop longue.')
  const codeBarres = nettoyer(s.codeBarres)
  if (codeBarres !== null && !/^\d{8,14}$/.test(codeBarres)) return invalide('Code-barres invalide : 8 à 14 chiffres.')
  const portionLabel = nettoyer(s.portionLabel)
  if (portionLabel !== null && longueur(portionLabel) > LIMITES_NUTRITION.portionLabel) return invalide('Le libellé de la portion est trop long.')
  const macro = (libelle: string, v: number) => nombreEntre(libelle, v, 0, LIMITES_NUTRITION.macro100)
  return {
    nom: nomValide(s.nom), marque, codeBarres, portionLabel,
    portionG: nombreEntre('La portion', s.portionG ?? 100, 1, LIMITES_NUTRITION.portionG),
    kcal100: nombreEntre('L’énergie', s.kcal100, 0, LIMITES_NUTRITION.kcal100),
    proteines100: macro('Les protéines', s.proteines100), glucides100: macro('Les glucides', s.glucides100), lipides100: macro('Les lipides', s.lipides100),
    fibres100: s.fibres100 == null ? null : macro('Les fibres', s.fibres100),
    favori: s.favori ? 1 : 0,
    source: s.source ?? 'manuel',
  }
}

const mapAliment = (l: Ligne): Aliment => ({
  id: String(l.id),
  nom: String(l.nom ?? ''),
  marque: txt(l.marque),
  codeBarres: txt(l.code_barres),
  portionG: Number(l.portion_g ?? 100),
  portionLabel: txt(l.portion_label),
  kcal100: Number(l.kcal_100 ?? 0),
  proteines100: Number(l.proteines_100 ?? 0),
  glucides100: Number(l.glucides_100 ?? 0),
  lipides100: Number(l.lipides_100 ?? 0),
  fibres100: num(l.fibres_100),
  favori: Number(l.favori) === 1,
  source: l.source === 'off' || l.source === 'ia' ? l.source : 'manuel',
  createdAt: String(l.created_at ?? ''),
})

const COLONNES_ALIMENT = ['nom', 'marque', 'code_barres', 'portion_g', 'portion_label', 'kcal_100', 'proteines_100', 'glucides_100', 'lipides_100', 'fibres_100', 'favori', 'source'] as const
const valeursAliment = (v: ReturnType<typeof validerAliment>) => [v.nom, v.marque, v.codeBarres, v.portionG, v.portionLabel, v.kcal100, v.proteines100, v.glucides100, v.lipides100, v.fibres100, v.favori, v.source]

/** Aliments personnels : favoris d'abord, puis par nom. */
export async function listerAliments(db: DbLecture): Promise<Aliment[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM aliments WHERE deleted_at IS NULL ORDER BY favori DESC, nom COLLATE NOCASE, id')
  return lignes.map(mapAliment)
}

export async function lireAliment(db: DbLecture, id: string): Promise<Aliment | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM aliments WHERE id = ? AND deleted_at IS NULL', [id])
  return l ? mapAliment(l) : null
}

/** Aliment déjà enregistré pour ce code-barres (évite les doublons à chaque scan). */
export async function lireAlimentParCodeBarres(db: DbLecture, code: string): Promise<Aliment | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM aliments WHERE code_barres = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1', [code])
  return l ? mapAliment(l) : null
}

// `user_id` n'est pas écrit : le serveur le remplit avec auth.uid(), comme pour les autres tables.
export async function creerAliment(db: Db, saisie: SaisieAliment): Promise<string> {
  const v = validerAliment(saisie)
  const id = newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    `INSERT INTO aliments (id, ${COLONNES_ALIMENT.join(', ')}, created_at, updated_at) VALUES (?, ${COLONNES_ALIMENT.map(() => '?').join(', ')}, ?, ?)`,
    [id, ...valeursAliment(v), maintenant, maintenant],
  )
  return id
}

export async function modifierAliment(db: Db, id: string, saisie: SaisieAliment): Promise<void> {
  const v = validerAliment(saisie)
  await db.writeTransaction(async (tx) => {
    if (!(await lireAliment(tx, id))) throw new ErreurNutrition('introuvable', 'Aliment introuvable.')
    await tx.execute(`UPDATE aliments SET ${COLONNES_ALIMENT.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [...valeursAliment(v), new Date().toISOString(), id])
  })
}

export async function basculerFavori(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const a = await lireAliment(tx, id)
    if (!a) throw new ErreurNutrition('introuvable', 'Aliment introuvable.')
    await tx.execute('UPDATE aliments SET favori = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [a.favori ? 0 : 1, new Date().toISOString(), id])
  })
}

export async function supprimerAliment(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireAliment(tx, id))) throw new ErreurNutrition('introuvable', 'Aliment introuvable.')
    const maintenant = new Date().toISOString()
    await tx.execute('UPDATE aliments SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [maintenant, maintenant, id])
  })
}

// ── Journal ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const mapEntree = (l: Ligne): EntreeJournal => ({
  id: String(l.id),
  date: String(l.date),
  repas: l.repas === 'eau' ? 'eau' : estRepas(l.repas) ? l.repas : 'collation',
  nom: String(l.nom ?? ''),
  quantiteG: Number(l.quantite_g ?? 0),
  apport: { kcal: Number(l.kcal ?? 0), proteines: Number(l.proteines ?? 0), glucides: Number(l.glucides ?? 0), lipides: Number(l.lipides ?? 0), fibres: Number(l.fibres ?? 0) },
  alimentId: txt(l.aliment_id),
  source: (['base', 'off', 'manuel', 'ia', 'copie', 'eau'] as const).find((s) => s === l.source) ?? 'manuel',
  createdAt: String(l.created_at ?? ''),
})

function validerEntree(s: SaisieEntree) {
  if (!dateIsoValide(s.date)) return invalide('Date invalide.')
  if (!estRepas(s.repas)) return invalide('Repas inconnu.')
  const a = s.apport
  return {
    nom: nomValide(s.nom),
    quantiteG: nombreEntre('La quantité', s.quantiteG, 0, LIMITES_NUTRITION.quantiteG),
    kcal: nombreEntre('L’énergie', a.kcal, 0, LIMITES_NUTRITION.kcalEntree),
    proteines: nombreEntre('Les protéines', a.proteines, 0, LIMITES_NUTRITION.macroEntree),
    glucides: nombreEntre('Les glucides', a.glucides, 0, LIMITES_NUTRITION.macroEntree),
    lipides: nombreEntre('Les lipides', a.lipides, 0, LIMITES_NUTRITION.macroEntree),
    fibres: nombreEntre('Les fibres', a.fibres, 0, LIMITES_NUTRITION.macroEntree),
  }
}

/** Toutes les lignes d'un jour (repas et eau), dans l'ordre de saisie. */
export async function lireJour(db: DbLecture, date: string): Promise<EntreeJournal[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM repas_entrees WHERE date = ? AND deleted_at IS NULL ORDER BY created_at, id', [date])
  return lignes.map(mapEntree)
}

export async function lireEntree(db: DbLecture, id: string): Promise<EntreeJournal | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM repas_entrees WHERE id = ? AND deleted_at IS NULL', [id])
  return l ? mapEntree(l) : null
}

export async function ajouterEntree(db: Db, saisie: SaisieEntree): Promise<string> {
  const v = validerEntree(saisie)
  const id = newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    'INSERT INTO repas_entrees (id, date, repas, nom, quantite_g, kcal, proteines, glucides, lipides, fibres, aliment_id, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, saisie.date, saisie.repas, v.nom, v.quantiteG, v.kcal, v.proteines, v.glucides, v.lipides, v.fibres, saisie.alimentId ?? null, saisie.source ?? 'manuel', maintenant, maintenant],
  )
  return id
}

/** Ajoute plusieurs entrées d'un coup (photo de l'assiette, copie d'un repas) : tout ou rien. */
export async function ajouterEntrees(db: Db, saisies: readonly SaisieEntree[]): Promise<string[]> {
  const validees = saisies.map((s) => ({ s, v: validerEntree(s) }))
  const ids: string[] = []
  await db.writeTransaction(async (tx) => {
    const maintenant = new Date().toISOString()
    const debut = Date.now()
    for (const [i, { s, v }] of validees.entries()) {
      const id = newId()
      ids.push(id)
      // created_at croissant d'une milliseconde par ligne : le journal garde l'ordre de saisie (lecture triée sur created_at)
      const cree = new Date(debut + i).toISOString()
      await tx.execute(
        'INSERT INTO repas_entrees (id, date, repas, nom, quantite_g, kcal, proteines, glucides, lipides, fibres, aliment_id, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, s.date, s.repas, v.nom, v.quantiteG, v.kcal, v.proteines, v.glucides, v.lipides, v.fibres, s.alimentId ?? null, s.source ?? 'manuel', cree, maintenant],
      )
    }
  })
  return ids
}

/** Eau : ajoute `ml` millilitres au jour (une ligne par ajout, pour pouvoir annuler le dernier). */
export async function ajouterEau(db: Db, date: string, ml: number): Promise<string> {
  if (!dateIsoValide(date)) return invalide('Date invalide.')
  const quantite = nombreEntre('La quantité d’eau', ml, 1, LIMITES_NUTRITION.eauMl)
  const id = newId()
  const maintenant = new Date().toISOString()
  await db.execute(
    "INSERT INTO repas_entrees (id, date, repas, nom, quantite_g, kcal, proteines, glucides, lipides, fibres, aliment_id, source, created_at, updated_at) VALUES (?, ?, 'eau', 'Eau', ?, 0, 0, 0, 0, NULL, NULL, 'eau', ?, ?)",
    [id, date, quantite, maintenant, maintenant],
  )
  return id
}

/** Modifie la quantité (apport recalculé par l'appelant) et le repas d'une entrée. */
export async function modifierEntree(db: Db, id: string, saisie: Pick<SaisieEntree, 'repas' | 'quantiteG' | 'apport'> & { nom?: string }): Promise<void> {
  await db.writeTransaction(async (tx) => {
    const actuelle = await lireEntree(tx, id)
    if (!actuelle) throw new ErreurNutrition('introuvable', 'Entrée introuvable.')
    const v = validerEntree({ date: actuelle.date, repas: saisie.repas, nom: saisie.nom ?? actuelle.nom, quantiteG: saisie.quantiteG, apport: saisie.apport })
    await tx.execute(
      'UPDATE repas_entrees SET repas = ?, nom = ?, quantite_g = ?, kcal = ?, proteines = ?, glucides = ?, lipides = ?, fibres = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [saisie.repas, v.nom, v.quantiteG, v.kcal, v.proteines, v.glucides, v.lipides, v.fibres, new Date().toISOString(), id],
    )
  })
}

export async function supprimerEntree(db: Db, id: string): Promise<void> {
  await db.writeTransaction(async (tx) => {
    if (!(await lireEntree(tx, id))) throw new ErreurNutrition('introuvable', 'Entrée introuvable.')
    const maintenant = new Date().toISOString()
    await tx.execute('UPDATE repas_entrees SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [maintenant, maintenant, id])
  })
}

/** Copie un repas d'un jour vers un autre (« comme hier »). Renvoie le nombre d'entrées copiées. */
export async function copierRepas(db: Db, depuis: string, repas: Repas, vers: string): Promise<number> {
  const source = (await lireJour(db, depuis)).filter((e) => e.repas === repas)
  if (source.length === 0) return 0
  await ajouterEntrees(db, source.map((e) => ({ date: vers, repas, nom: e.nom, quantiteG: e.quantiteG, apport: e.apport, alimentId: e.alimentId, source: 'copie' as const })))
  return source.length
}

export interface AlimentRecent {
  nom: string
  quantiteG: number
  apport: Apport
  alimentId: string | null
  source: SourceEntree
  /** Nombre de fois mangé sur la période. */
  fois: number
}

/** Aliments les plus souvent notés depuis `depuis` (yyyy-MM-dd), avec leur dernière quantité : la liste « Fréquents ». */
export async function alimentsFrequents(db: DbLecture, depuis: string, limite = 12): Promise<AlimentRecent[]> {
  const lignes = await db.getAll<Ligne>(
    "SELECT * FROM repas_entrees WHERE deleted_at IS NULL AND repas <> 'eau' AND date >= ? ORDER BY date DESC, created_at DESC",
    [depuis],
  )
  const parNom = new Map<string, AlimentRecent>()
  for (const l of lignes) {
    const e = mapEntree(l)
    const cle = e.nom.toLowerCase()
    const deja = parNom.get(cle)
    if (deja) deja.fois++
    else parNom.set(cle, { nom: e.nom, quantiteG: e.quantiteG, apport: e.apport, alimentId: e.alimentId, source: e.source, fois: 1 })
  }
  return [...parNom.values()].sort((a, b) => b.fois - a.fois).slice(0, limite)
}

export interface TotauxJour {
  date: string
  apport: Apport
  eauMl: number
}

/** Totaux par jour entre deux dates incluses (jours sans saisie absents). */
export async function lireTotauxParJour(db: DbLecture, debut: string, fin: string): Promise<TotauxJour[]> {
  const lignes = await db.getAll<Ligne>('SELECT * FROM repas_entrees WHERE deleted_at IS NULL AND date >= ? AND date <= ? ORDER BY date, created_at', [debut, fin])
  const jours = new Map<string, EntreeJournal[]>()
  for (const l of lignes) {
    const e = mapEntree(l)
    jours.set(e.date, [...(jours.get(e.date) ?? []), e])
  }
  return [...jours.entries()].map(([date, entrees]) => ({
    date,
    apport: sommer(entrees.filter((e) => e.repas !== 'eau').map((e) => e.apport)),
    eauMl: entrees.filter((e) => e.repas === 'eau').reduce((t, e) => t + e.quantiteG, 0),
  }))
}

// ── Objectifs ────────────────────────────────────────────────────────────────────────────────────────────────────────

const mapObjectif = (l: Ligne): ObjectifNutrition => ({
  id: String(l.id),
  kcal: Number(l.kcal),
  proteinesG: Number(l.proteines_g),
  glucidesG: Number(l.glucides_g),
  lipidesG: Number(l.lipides_g),
  eauMl: Number(l.eau_ml ?? 2000),
  profilJson: txt(l.profil_json),
})

/** Objectifs en vigueur : le plus récent. */
export async function lireObjectifsNutrition(db: DbLecture): Promise<ObjectifNutrition | null> {
  const l = await db.getOptional<Ligne>('SELECT * FROM objectifs_nutrition WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1')
  return l ? mapObjectif(l) : null
}

/** Enregistre les objectifs : met à jour la ligne existante, sinon en crée une (une seule ligne vivante par compte). */
export async function enregistrerObjectifsNutrition(db: Db, saisie: SaisieObjectif): Promise<void> {
  const kcal = nombreEntre('L’énergie', saisie.kcal, 500, 10_000)
  const proteines = nombreEntre('Les protéines', saisie.proteinesG, 0, 1000)
  const glucides = nombreEntre('Les glucides', saisie.glucidesG, 0, 2000)
  const lipides = nombreEntre('Les lipides', saisie.lipidesG, 0, 1000)
  const eau = nombreEntre('L’eau', saisie.eauMl, 0, LIMITES_NUTRITION.eauMl)
  const profil = nettoyer(saisie.profilJson)
  if (profil !== null && longueur(profil) > LIMITES_NUTRITION.profil) return invalide('Le profil est trop long.')
  const entiers = [kcal, proteines, glucides, lipides, eau].map(Math.round)
  await db.writeTransaction(async (tx) => {
    const maintenant = new Date().toISOString()
    const actuel = await lireObjectifsNutrition(tx)
    if (actuel) {
      await tx.execute('UPDATE objectifs_nutrition SET kcal = ?, proteines_g = ?, glucides_g = ?, lipides_g = ?, eau_ml = ?, profil_json = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL', [...entiers, profil, maintenant, actuel.id])
    } else {
      await tx.execute('INSERT INTO objectifs_nutrition (id, kcal, proteines_g, glucides_g, lipides_g, eau_ml, profil_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId(), ...entiers, profil, maintenant, maintenant])
    }
  })
}
