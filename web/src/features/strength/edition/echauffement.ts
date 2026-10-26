import type { DbLecture } from '../../../core/db/Db'
import { mapSeance, type Ligne } from '../../../core/db/repos/mappers'
import { getSeanceTree } from '../../../core/db/repos/seances'
import type { Exercise, Seance } from '../../../core/db/types'
import { nouveauBloc, nouvelExercice, type BlocDraft } from '../draft'
import { lireListeEquipement } from '../progression/cible'
import { musclesExercice } from '../seanceStore'

// Modèles d'échauffement (Android WarmupPickerSheet) : séances d'une autre catégorie que le renforcement,
// non archivées. Leurs exercices sont recopiés dans un bloc « Échauffement » (réglages de base seulement).

export type ModeleEchauffement = Pick<Seance, 'id' | 'nom' | 'notes'>

export async function listerEchauffements(db: DbLecture): Promise<ModeleEchauffement[]> {
  const lignes = await db.getAll<Ligne>(
    "SELECT * FROM seances WHERE seance_category != 'STRENGTH' AND is_archived = 0 AND deleted_at IS NULL ORDER BY updated_at DESC",
  )
  return lignes.map(mapSeance).map(({ id, nom, notes }) => ({ id, nom, notes }))
}

/** Bloc Échauffement prêt à insérer, ou null si le modèle n'existe plus. Un exercice absent du catalogue est ignoré. */
export async function construireBlocEchauffement(
  db: DbLecture,
  modeleId: string,
  catalogue: Exercise[],
  genererId: () => string,
): Promise<BlocDraft | null> {
  const ligne = await db.getOptional<Ligne>('SELECT * FROM seances WHERE id = ? AND deleted_at IS NULL', [modeleId])
  if (!ligne) return null
  const modele = mapSeance(ligne)
  const { exercices } = await getSeanceTree(db, modeleId, null)
  const parId = new Map(catalogue.map((e) => [e.id, e]))
  const copies = [...exercices]
    .sort((a, b) => a.position - b.position)
    .flatMap((e) => {
      const exo = parId.get(e.exerciseId)
      if (!exo) return []
      const copie = nouvelExercice(
        genererId(),
        { id: exo.id, name: exo.name, muscles: musclesExercice(exo), equipment: lireListeEquipement(exo.equipment), isBodyweight: exo.isBodyweight },
        'ECHAUFFEMENT',
      )
      return [{
        ...copie,
        nombreSeriesPrevues: e.nombreSeriesPrevues,
        repsCibles: e.repsCibles,
        repsType: e.repsType,
        chargeCible: e.chargeCible,
        tempsReposSec: e.tempsReposSec,
      }]
    })
  return { ...nouveauBloc(genererId(), 'ECHAUFFEMENT'), nom: modele.nom, exercices: copies }
}
