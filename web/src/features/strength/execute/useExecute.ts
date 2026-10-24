import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../../../core/db/client'
import type { Db, DbLecture } from '../../../core/db/Db'
import {
  copyTemplateToInstance, demarrerInstance, enregistrerPauses, ErreurInstance, getInstance, terminerInstance,
} from '../../../core/db/repos/instances'
import { getSeanceTree } from '../../../core/db/repos/seances'
import { addSerie, listSeries, updateSerie } from '../../../core/db/repos/series'
import type { InstanceSeance, RepsType } from '../../../core/db/types'
import { evaluerEtAppliquerSilencieux } from '../progression/evaluation'
import { clockFromRow, clockToRow, elapsedMs, estEnPause, type SessionClock } from './sessionClock'
import { useTicker } from './useTicker'
import { construireVue, reposRestant, verifierMesures, type BlocVue, type ExerciceVue, type Mesures } from './vue'

export interface DepsExecute {
  /** Base à utiliser (défaut : base de l'application). Référence stable. */
  db?: Db
  /** Horloge (epoch ms). Référence stable ; injectée par les tests. */
  nowFn?: () => number
  /** Période du rafraîchissement de l'affichage (ms). */
  tickMs?: number
  /** Utilisateur connecté : « Mon matériel » pour l'évaluation de progression à la fin. */
  userId?: string
}

// Erreur destinée à l'utilisateur (message français affiché tel quel).
class ErreurExecution extends Error {}

const TERMINEE = "Cette séance est terminée : elle n'est plus modifiable."

interface Donnees {
  instance: InstanceSeance | null
  nomSeance: string
  blocs: BlocVue[]
  exercices: ExerciceVue[]
}

const VIDE: Donnees = { instance: null, nomSeance: '', blocs: [], exercices: [] }
const SANS_HORLOGE: SessionClock = { startedAtMs: null, pauses: [] }

const horlogeDe = (i: InstanceSeance): SessionClock => clockFromRow({ started_at: i.startedAt, paused_json: i.pausedJson })

// Relit tout depuis la base : instance, lignes D'INSTANCE (jamais le modèle), séries vivantes, noms.
async function lire(db: Db, instanceId: string): Promise<Donnees> {
  const instance = await getInstance(db, instanceId)
  if (!instance) throw new ErreurExecution('Séance introuvable.')
  const seance = await db.getOptional<{ nom: string }>('SELECT nom FROM seances WHERE id = ? AND deleted_at IS NULL', [
    instance.seanceId,
  ])
  const arbre = await getSeanceTree(db, instance.seanceId, instanceId)
  const series = await listSeries(db, instanceId)
  const idsExercices = [...new Set(arbre.exercices.map((e) => e.exerciseId))]
  const noms =
    idsExercices.length === 0
      ? []
      : await db.getAll<{ id: string; name: string }>(
          `SELECT id, name FROM exercises WHERE deleted_at IS NULL AND id IN (${idsExercices.map(() => '?').join(', ')})`,
          idsExercices,
        )
  const vue = construireVue(arbre.blocs, arbre.exercices, series, new Map(noms.map((n) => [n.id, n.name])))
  return { instance, nomSeance: seance?.nom ?? 'Séance', ...vue }
}

// Instance vivante et non terminée, relue en base (jamais depuis l'état React, qui peut être en retard).
async function instanceModifiable(db: DbLecture, instanceId: string): Promise<InstanceSeance> {
  const instance = await getInstance(db, instanceId)
  if (!instance) throw new ErreurExecution('Séance introuvable.')
  if (instance.isCompleted) throw new ErreurExecution(TERMINEE)
  return instance
}

async function repsTypeExercice(db: DbLecture, instanceId: string, exerciceId: string): Promise<RepsType> {
  const ligne = await db.getOptional<{ reps_type: string | null }>(
    'SELECT reps_type FROM exercices_seance WHERE id = ? AND instance_seance_id = ? AND deleted_at IS NULL',
    [exerciceId, instanceId],
  )
  if (!ligne) throw new ErreurExecution('Exercice introuvable dans cette séance.')
  return ligne.reps_type === 'DURATION' ? 'DURATION' : 'REPS'
}

// Exécution d'une séance planifiée. Règle centrale : une série validée est écrite en base locale
// AVANT toute mise à jour de l'affichage, qui est ensuite relu depuis la base. Les écritures passent
// par une file sérialisée (deux appuis rapides ne réutilisent jamais un numéro de série).
// Le chrono et le repos sont dérivés d'horodatages stockés : un rechargement restitue tout.
export function useExecute(instanceId: string, { db, nowFn = Date.now, tickMs = 1000, userId }: DepsExecute = {}) {
  const [donnees, setDonnees] = useState<Donnees>(VIDE)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)
  const file = useRef<Promise<unknown>>(Promise.resolve())
  // Exercices dont une validation de série est en cours : la ref garde contre un double appui
  // (synchrone), l'état sert à désactiver le bouton à l'écran.
  const validationsRef = useRef(new Set<string>())
  const [validations, setValidations] = useState<ReadonlySet<string>>(() => new Set())
  const marquerValidation = useCallback((exerciceId: string, enCours: boolean) => {
    if (enCours) validationsRef.current.add(exerciceId)
    else validationsRef.current.delete(exerciceId)
    setValidations(new Set(validationsRef.current))
  }, [])

  const instance = donnees.instance
  const horloge = instance ? horlogeDe(instance) : SANS_HORLOGE
  const demarre = horloge.startedAtMs !== null
  const terminee = instance?.isCompleted ?? false
  const enPause = estEnPause(horloge)
  const { now, rafraichir } = useTicker(demarre && !terminee && !enPause, nowFn, tickMs)

  // Ouverture : copie du modèle UNIQUEMENT pour une instance non terminée (parité Android) ;
  // la copie est idempotente, une réouverture ne duplique rien.
  useEffect(() => {
    let annule = false
    const base = db ?? getDb()
    ;(async () => {
      const existante = await getInstance(base, instanceId)
      if (existante && !existante.isCompleted) await copyTemplateToInstance(base, instanceId)
      const d = await lire(base, instanceId)
      if (annule) return
      setDonnees(d)
      rafraichir()
    })()
      .catch((e: unknown) => {
        if (annule) return
        if (e instanceof ErreurExecution || e instanceof ErreurInstance) setErreur(e.message)
        else {
          console.error("Ouverture de la séance impossible", e)
          setErreur("L'ouverture de la séance a échoué.")
        }
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [db, instanceId, rafraichir])

  // Met une écriture en file, puis relit la base. Ne rejette jamais : l'échec est affiché dans `erreur`.
  // Résout à true si l'écriture a réussi (l'écran s'en sert pour enchaîner, ex. ouvrir le bilan).
  const ecrire = useCallback(
    (action: (base: Db, maintenantMs: number) => Promise<void>, messageEchec: string): Promise<boolean> => {
      const base = db ?? getDb()
      const tache = async () => {
        let ok = false
        try {
          await action(base, nowFn())
          setErreur(null)
          ok = true
        } catch (e) {
          if (e instanceof ErreurExecution) setErreur(e.message)
          else {
            console.error(messageEchec, e)
            setErreur(messageEchec)
          }
        }
        try {
          setDonnees(await lire(base, instanceId))
          rafraichir()
        } catch (e) {
          console.error('Relecture de la séance impossible', e)
        }
        return ok
      }
      const suite = file.current.then(tache, tache)
      file.current = suite
      return suite
    },
    [db, instanceId, nowFn, rafraichir],
  )

  const demarrer = useCallback(
    () =>
      ecrire(async (base, maintenant) => {
        await instanceModifiable(base, instanceId)
        await demarrerInstance(base, instanceId, new Date(maintenant).toISOString())
      }, 'Le démarrage de la séance a échoué.'),
    [ecrire, instanceId],
  )

  const pause = useCallback(
    () =>
      ecrire(async (base, maintenant) => {
        const inst = await instanceModifiable(base, instanceId)
        const h = horlogeDe(inst)
        if (h.startedAtMs === null || estEnPause(h)) return
        const pauses = [...h.pauses, { fromMs: maintenant, toMs: null }]
        await enregistrerPauses(base, instanceId, clockToRow({ ...h, pauses }).paused_json, new Date(maintenant).toISOString())
      }, 'La mise en pause a échoué.'),
    [ecrire, instanceId],
  )

  const reprendre = useCallback(
    () =>
      ecrire(async (base, maintenant) => {
        const inst = await instanceModifiable(base, instanceId)
        const h = horlogeDe(inst)
        if (!estEnPause(h)) return
        const pauses = h.pauses.map((p) => (p.toMs === null ? { ...p, toMs: Math.max(p.fromMs, maintenant) } : p))
        await enregistrerPauses(base, instanceId, clockToRow({ ...h, pauses }).paused_json, new Date(maintenant).toISOString())
      }, 'La reprise de la séance a échoué.'),
    [ecrire, instanceId],
  )

  const terminer = useCallback(
    () =>
      ecrire(async (base, maintenant) => {
        // Clôture ET évaluation de progression dans UNE transaction (ordre Android : prepareFinish
        // avant finishInstance) : si l'évaluation échoue, l'instance reste non terminée.
        await base.writeTransaction(async (tx) => {
          const inst = await getInstance(tx, instanceId)
          if (!inst) throw new ErreurExecution('Séance introuvable.')
          if (inst.isCompleted) return
          const h = horlogeDe(inst)
          const fermee: SessionClock = {
            ...h,
            pauses: h.pauses.map((p) => (p.toMs === null ? { ...p, toMs: Math.max(p.fromMs, maintenant) } : p)),
          }
          await terminerInstance(tx, instanceId, {
            completedAt: new Date(maintenant).toISOString(),
            durationSeconds: Math.round(elapsedMs(fermee, maintenant) / 1000),
            pausedJson: clockToRow(fermee).paused_json,
          })
          await evaluerEtAppliquerSilencieux(tx, instanceId, { userId, maintenantMs: maintenant })
        })
      }, "L'enregistrement de la fin de séance a échoué."),
    [ecrire, instanceId, userId],
  )

  const validerSerie = useCallback(
    (exerciceId: string, s: Mesures): Promise<boolean> => {
      // Anti double appui : une seconde validation du même exercice, tant que la première n'est pas
      // terminée, est ignorée (sinon deux séries identiques seraient enregistrées).
      if (validationsRef.current.has(exerciceId)) return Promise.resolve(false)
      marquerValidation(exerciceId, true)
      return ecrire(async (base, maintenant) => {
        const iso = new Date(maintenant).toISOString()
        // Lecture du numéro max ET insertion dans UNE transaction : aucun autre écrit ne s'intercale.
        await base.writeTransaction(async (tx) => {
          const inst = await instanceModifiable(tx, instanceId)
          const repsType = await repsTypeExercice(tx, instanceId, exerciceId)
          const invalide = verifierMesures(s, repsType)
          if (invalide) throw new ErreurExecution(invalide)
          // Valider une série sans avoir appuyé sur « Démarrer » lance le chrono (aucune saisie perdue).
          if (inst.startedAt === null) await demarrerInstance(tx, instanceId, iso)
          const existantes = (await listSeries(tx, instanceId)).filter((x) => x.exerciceSeanceId === exerciceId)
          const numero = 1 + existantes.reduce((max, x) => Math.max(max, x.numeroSerie), 0)
          await addSerie(
            tx,
            {
              instanceSeanceId: instanceId,
              exerciceSeanceId: exerciceId,
              numeroSerie: numero,
              repsRealisees: s.reps,
              chargeKg: s.chargeKg,
              chargeLabel: null,
              rpe: s.rpe,
              notes: '',
              isCompleted: true,
            },
            iso,
          )
        })
      }, "L'enregistrement de la série a échoué. Réessayez.").finally(() => marquerValidation(exerciceId, false))
    },
    [ecrire, instanceId, marquerValidation],
  )

  const corrigerSerie = useCallback(
    (serieId: string, s: Partial<Mesures>) =>
      ecrire(async (base, maintenant) => {
        await instanceModifiable(base, instanceId)
        const serie = await base.getOptional<{ exercice_seance_id: string }>(
          'SELECT exercice_seance_id FROM series_realisees WHERE id = ? AND instance_seance_id = ? AND deleted_at IS NULL',
          [serieId, instanceId],
        )
        if (!serie) throw new ErreurExecution('Série introuvable.')
        const invalide = verifierMesures(s, await repsTypeExercice(base, instanceId, serie.exercice_seance_id))
        if (invalide) throw new ErreurExecution(invalide)
        await updateSerie(
          base,
          serieId,
          { repsRealisees: s.reps, chargeKg: s.chargeKg, rpe: s.rpe },
          new Date(maintenant).toISOString(),
        )
      }, "La correction de la série a échoué. Réessayez."),
    [ecrire, instanceId],
  )

  return {
    chargement,
    erreur,
    // false tant que l'instance n'est pas chargée, ou si elle est introuvable
    trouvee: instance !== null,
    nomSeance: donnees.nomSeance,
    date: instance?.date ?? '',
    blocs: donnees.blocs,
    exercices: donnees.exercices,
    // Séance terminée : durée figée enregistrée (aussi valable pour une séance importée sans horloge)
    elapsedMs: terminee && instance ? instance.durationSeconds * 1000 : elapsedMs(horloge, now),
    demarre,
    enPause,
    terminee,
    reposRestantMs: demarre && !enPause && !terminee ? reposRestant(donnees.exercices, now) : null,
    demarrer,
    pause,
    reprendre,
    terminer,
    validerSerie,
    corrigerSerie,
    /** Vrai pendant l'enregistrement d'une série de cet exercice (bouton « Valider » désactivé). */
    validationEnCours: (exerciceId: string) => validations.has(exerciceId),
  }
}
