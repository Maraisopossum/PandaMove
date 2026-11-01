import { z } from 'zod'
import { catalogueDeBase } from '../catalogue/catalogueDeBase'
import { LIBELLES_GROUPE, muscleToGroup } from '../catalogue/muscleToGroup'
import { normalizeSearch } from '../common/normalizeSearch'
import type { Db } from '../db/Db'
import { MUSCLE_GROUPS } from '../db/types'
import {
  DEFAUTS, FORMAT_ID, FichierIASchema, NB_BLOCS_MAX, NB_EXERCICES_MAX, NB_SEANCES_MAX, TYPES_BLOC_IA, VERSION_FORMAT,
  type FichierIA,
} from './format'

// Générateur du « fichier modèle » à donner à l'IA : consigne Markdown (rôle, règle de sortie, schéma, règles de
// bon sens, exemple, liste des exercices disponibles), exemple JSON seul et JSON Schema. Tout est DÉRIVÉ du
// code (schéma Zod, types de bloc, groupes musculaires, catalogue) : la consigne ne peut pas dériver du format
// accepté. Fonction pure ; aucun accès réseau, aucune donnée personnelle (seuls les NOMS des exercices
// personnalisés de l'utilisateur y figurent, et il décide de ce qu'il transmet à l'IA).

export interface ExerciceListe {
  name: string
  musclePrimary: string
}

export interface EntreeModele {
  /** Exercices personnalisés de l'utilisateur (le catalogue de base est toujours inclus). */
  exercicesPersonnalises?: ExerciceListe[]
}

export interface ModeleIA {
  /** Consigne Markdown à coller ou joindre dans l'IA. */
  consigne: string
  /** Exemple complet, JSON seul. */
  exemple: string
  /** JSON Schema du fichier attendu. */
  schema: string
}

// ── Exemple : typé par FichierIA, donc obligé de rester conforme au schéma ──────────────────────────
export const EXEMPLE: FichierIA = {
  format: FORMAT_ID,
  version: VERSION_FORMAT,
  seances: [
    {
      nom: 'Haut du corps – force',
      notes: 'Séance poussée / tirage, 3 fois par semaine maximum.',
      blocs: [
        {
          type: 'ECHAUFFEMENT',
          exercices: [
            { exercice: 'Face pull câble', series: 2, reps: 15, chargeKg: 15 },
            { exercice: 'Pompes', series: 2, reps: 10, charge: 'PDC' },
          ],
        },
        {
          type: 'LIBRE',
          exercices: [
            {
              exercice: 'Développé couché barre',
              series: 4,
              reps: 6,
              chargeKg: 60,
              reposSec: 150,
              tempo: '2-0-1',
              consigne: 'Omoplates serrées, pieds ancrés au sol.',
              typeExercice: 'COMPOSE_HAUT',
              progression: { activee: true, systeme: 'DOUBLE', repsMin: 6, repsMax: 8, incrementKg: 2.5, seuilDeload: 3 },
            },
            { exercice: 'Rowing barre (Bent-over row)', series: 4, reps: '8-10', chargeKg: 50, reposSec: 120, typeExercice: 'COMPOSE_HAUT' },
          ],
        },
        {
          type: 'SUPERSET',
          nom: 'Bras',
          reposInterExercicesSec: 15,
          reposFinTourSec: 90,
          exercices: [
            { exercice: 'Curl haltères debout', series: 3, reps: '10-12', chargeKg: 12, typeExercice: 'ISOLATION' },
            { exercice: 'Extension triceps câble (corde)', series: 3, reps: '10-12', chargeKg: 20, typeExercice: 'ISOLATION' },
          ],
        },
        {
          type: 'RECUPERATION',
          exercices: [
            {
              // Exercice absent du catalogue : il sera créé, d'où « muscles »
              exercice: 'Étirement des pectoraux au mur',
              series: 2,
              dureeSec: 30,
              bilateral: true,
              muscles: { principal: 'PECTORAUX', secondaires: ['EPAULES'] },
            },
          ],
        },
      ],
    },
    {
      nom: 'Jambes et gainage',
      blocs: [
        { type: 'ACTIVATION', exercices: [{ exercice: 'Glute bridge', series: 2, reps: 15, charge: 'PDC' }] },
        {
          type: 'LIBRE',
          exercices: [
            {
              exercice: 'Squat barre haute',
              series: 4,
              reps: 5,
              chargeKg: 80,
              reposSec: 180,
              typeExercice: 'COMPOSE_BAS',
              progression: { activee: true, systeme: 'LINEAIRE', incrementKg: 2.5 },
            },
            { exercice: 'Fente haltères', series: 3, reps: 10, chargeKg: 14, bilateral: true, reposSec: 90 },
          ],
        },
        {
          type: 'CIRCUIT',
          nom: 'Gainage',
          tours: 3,
          reposInterExercicesSec: 15,
          reposFinTourSec: 90,
          exercices: [
            { exercice: 'Planche (gainage)', dureeSec: 40 },
            { exercice: 'Mountain climber', dureeSec: 30 },
            { exercice: 'Crunch', dureeSec: 30 },
          ],
        },
      ],
    },
  ],
}

// ── JSON Schema ────────────────────────────────────────────────────────────────────────────────
type Schema = {
  type?: string
  properties?: Record<string, Schema>
  required?: string[]
  items?: Schema
  anyOf?: Schema[]
  enum?: unknown[]
  const?: unknown
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  maxLength?: number
  description?: string
  additionalProperties?: boolean
  [cle: string]: unknown
}

// Les objets refusent les champs inconnus dans le schéma donné à l'IA (côté application, ils ne sont qu'ignorés
// et signalés) : la consigne la plus stricte donne les fichiers les plus propres.
function interdireChampsInconnus(s: Schema): Schema {
  const copie: Schema = { ...s }
  if (s.properties) {
    copie.additionalProperties = false
    copie.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, interdireChampsInconnus(v)]))
  }
  if (s.items) copie.items = interdireChampsInconnus(s.items)
  if (s.anyOf) copie.anyOf = s.anyOf.map(interdireChampsInconnus)
  return copie
}

export function schemaJson(): Schema {
  const brut = z.toJSONSchema(FichierIASchema, { io: 'input' }) as Schema
  return {
    ...interdireChampsInconnus(brut),
    title: 'PandaMove – séances créées par une IA (v1)',
  }
}

// ── Tableau des champs, lu dans le JSON Schema ─────────────────────────────────────────────────
// Champs dont l'obligation dépend du type de bloc (vérifiée par le schéma, pas exprimable par « required »)
const CONDITIONNELS: Record<string, string> = {
  'seances[].blocs[].exercices[].series': 'oui, sauf CIRCUIT',
  'seances[].blocs[].exercices[].dureeSec': 'oui dans un CIRCUIT',
}

function typeLisible(s: Schema): string {
  if (s.anyOf) return s.anyOf.map(typeLisible).join(' ou ')
  if (s.const !== undefined) return typeof s.const === 'string' ? `texte « ${s.const} »` : `nombre ${String(s.const)}`
  switch (s.type) {
    case 'string': return 'texte'
    case 'integer': return 'entier'
    case 'number': return 'nombre'
    case 'boolean': return 'booléen'
    case 'array': return s.items?.type === 'object' ? "liste d'objets" : `liste de ${typeLisible(s.items ?? {})}`
    case 'object': return 'objet'
    default: return s.type ?? 'valeur'
  }
}

function contrainte(s: Schema): string {
  if (s.anyOf) return s.anyOf.map(contrainte).filter(Boolean).join(' ou ')
  if (s.enum) return s.enum.map((v) => `\`${String(v)}\``).join(', ')
  if (s.const !== undefined) return `\`${JSON.stringify(s.const)}\``
  if (s.minimum !== undefined || s.maximum !== undefined) return `de ${s.minimum ?? '…'} à ${s.maximum ?? '…'}`
  if (s.minItems !== undefined || s.maxItems !== undefined) return `${s.minItems ?? 0} à ${s.maxItems ?? '…'} éléments`
  if (s.maxLength !== undefined) return `${s.maxLength} caractères max`
  return ''
}

const echapper = (t: string) => t.replace(/\|/g, '\\|').replace(/\n/g, ' ')

function lignesChamps(s: Schema, chemin: string, lignes: string[]): void {
  const proprietes = s.properties ?? {}
  for (const [nom, sous] of Object.entries(proprietes)) {
    const cle = chemin === '' ? nom : `${chemin}.${nom}`
    const elementObjet = sous.type === 'array' && sous.items?.type === 'object' ? sous.items : null
    const enfant = sous.type === 'object' ? sous : elementObjet
    const nomAffiche = elementObjet ? `${cle}[]` : cle
    const obligatoire = CONDITIONNELS[nomAffiche] ?? ((s.required ?? []).includes(nom) ? 'oui' : 'non')
    const cible = elementObjet ?? sous
    const bornes = [contrainte(sous), elementObjet ? contrainte(elementObjet) : ''].filter(Boolean).join(' ; ')
    lignes.push(
      `| \`${nomAffiche}\` | ${typeLisible(sous)} | ${obligatoire} | ${echapper(bornes)} | ${echapper(sous.description ?? cible.description ?? '')} |`,
    )
    if (enfant) lignesChamps(enfant, elementObjet ? `${cle}[]` : cle, lignes)
  }
}

function tableauChamps(): string {
  const lignes = ['| Champ | Type | Obligatoire | Valeurs / bornes | Description |', '| --- | --- | --- | --- | --- |']
  lignesChamps(schemaJson(), '', lignes)
  return lignes.join('\n')
}

// ── Liste des exercices disponibles ────────────────────────────────────────────────────────────
export function listeExercices(personnalises: ExerciceListe[] = []): string {
  const parGroupe = new Map<string, Map<string, string>>(MUSCLE_GROUPS.map((g) => [g, new Map()]))
  const ajouter = (name: string, musclePrimary: string) => {
    const nom = name.trim()
    if (nom === '') return
    const groupe = muscleToGroup(musclePrimary)
    const dejaPresent = [...parGroupe.values()].some((m) => m.has(normalizeSearch(nom)))
    if (!dejaPresent) parGroupe.get(groupe)?.set(normalizeSearch(nom), nom)
  }
  for (const e of catalogueDeBase()) ajouter(e.name, e.musclePrimary)
  for (const e of personnalises) ajouter(e.name, e.musclePrimary)

  const blocs: string[] = []
  for (const g of MUSCLE_GROUPS) {
    const noms = [...(parGroupe.get(g)?.values() ?? [])].sort((a, b) => a.localeCompare(b, 'fr'))
    if (noms.length === 0) continue
    blocs.push(`### ${g} (${LIBELLES_GROUPE[g]})\n\n${noms.map((n) => `- ${n}`).join('\n')}`)
  }
  return blocs.join('\n\n')
}

// ── Consigne ───────────────────────────────────────────────────────────────────────────────────
export function genererModeleIA(entree: EntreeModele = {}): ModeleIA {
  const exemple = JSON.stringify(EXEMPLE, null, 2)
  const schema = JSON.stringify(schemaJson(), null, 2)
  const types = TYPES_BLOC_IA.map((t) => `\`${t}\``).join(', ')
  const consigne = `# Consigne pour l'IA : créer des séances de renforcement pour PandaMove

## Ton rôle

Tu es un coach de musculation expérimenté. À partir de ma demande (en bas de ce document), tu conçois de 1 à ${NB_SEANCES_MAX} séances de renforcement musculaire, réalistes, progressives et sûres, que j'importerai dans l'application PandaMove.

## Règle de sortie (essentielle)

Réponds **UNIQUEMENT par un bloc JSON valide** conforme au schéma ci-dessous, rien d'autre :

- aucun texte avant ou après le JSON, aucun commentaire (\`//\` et \`/* */\` sont interdits en JSON) ;
- guillemets droits \`"\` uniquement, pas de virgule après le dernier élément d'une liste ou d'un objet ;
- n'invente aucun champ : seuls les champs du tableau ci-dessous existent ;
- le champ \`format\` vaut toujours \`"${FORMAT_ID}"\` et \`version\` vaut \`${VERSION_FORMAT}\` ;
- tous les textes (noms, notes, consignes) sont en français.

## Schéma du fichier

Un fichier contient 1 à ${NB_SEANCES_MAX} séances ; une séance contient 1 à ${NB_BLOCS_MAX} blocs ; un bloc contient 1 à ${NB_EXERCICES_MAX} exercices. Types de bloc : ${types}.

${tableauChamps()}

Valeurs par défaut quand un champ facultatif est omis : repos entre séries ${DEFAUTS.reposSec} s ; superset et circuit : repos entre exercices ${DEFAUTS.reposInterExercicesSec} s, repos en fin de tour ${DEFAUTS.reposFinTourSec} s ; circuit : ${DEFAUTS.tours} tours ; progression : système \`${DEFAUTS.systeme}\`, plage ${DEFAUTS.repsMin}–${DEFAUTS.repsMax} répétitions, +${DEFAUTS.incrementKg} kg, décharge après ${DEFAUTS.seuilDeload} échecs.

## Règles de bon sens

1. **Ordre des blocs** : \`ECHAUFFEMENT\` puis \`ACTIVATION\` (facultatifs) en premier, ensuite les exercices principaux (\`LIBRE\`, \`SUPERSET\`, \`CIRCUIT\`), enfin \`RECUPERATION\` (étirements, mobilité) en dernier. Les exercices lourds et polyarticulaires viennent avant les exercices d'isolation.
2. **Bloc \`LIBRE\`** : sert à poser des exercices simples les uns après les autres (3 à 4 séries chacun). Pas de nom de bloc ni de repos de bloc.
3. **Volume réaliste** : 4 à 8 exercices principaux par séance ; 2 à 5 séries par exercice ; 5 à 8 répétitions pour la force, 8 à 12 pour l'hypertrophie, 12 à 20 pour l'endurance musculaire.
4. **Repos** : 120 à 180 s pour les exercices lourds, 60 à 90 s pour l'isolation, 30 à 60 s pour l'échauffement.
5. **Superset** : 2 à 4 exercices enchaînés sans repos entre eux ; on se repose seulement après le tour (\`reposFinTourSec\`). Chaque exercice a son propre nombre de séries (\`series\`).
6. **Circuit** : exercices **chronométrés** (\`dureeSec\` obligatoire, pas de \`reps\`), répétés sur plusieurs tours (\`tours\` du bloc, 2 à 5). Ne mets pas de \`series\` : c'est \`tours\` qui compte.
7. **Poids de corps** : \`"charge": "PDC"\` (et pas de \`chargeKg\`). Exercice chronométré (gainage, étirement) : \`dureeSec\` à la place de \`reps\`.
8. **Charges** : \`chargeKg\` seulement si tu peux l'estimer raisonnablement d'après ma demande ; sinon omets-le (je le renseignerai). Jamais de charge pour un échauffement au poids de corps.
9. **Progression** (\`progression.activee: true\`) : uniquement pour les exercices principaux chargés. Jamais dans \`ECHAUFFEMENT\` ni \`ACTIVATION\` (elle serait ignorée). Avec \`DOUBLE\`, renseigne \`repsMin\` et \`repsMax\` (la plage visée) et mets dans \`reps\` le nombre de départ (le bas de la plage). Avec \`LINEAIRE\`, \`reps\` est un nombre unique.
10. **Noms d'exercices** : utilise EXACTEMENT les noms de la liste « Exercices disponibles » ci-dessous (même orthographe, mêmes parenthèses). Si aucun ne convient, propose un nouvel exercice avec un nom clair en français **et** le champ \`muscles\` (\`principal\` obligatoire, \`secondaires\` facultatif) en utilisant uniquement les codes de groupes musculaires de la liste.
11. **Cohérence** : ne répète pas la même séance sous plusieurs noms ; donne à chaque séance un nom court et distinct.

## Exemple complet

Exemple de réponse attendue (2 séances, avec un superset et un circuit). L'exercice « Étirement des pectoraux au mur » n'est pas dans la liste : il est proposé avec \`muscles\`.

\`\`\`json
${exemple}
\`\`\`

## Exercices disponibles

Noms exacts à utiliser, regroupés par groupe musculaire principal (le code du groupe sert pour \`muscles\`).

${listeExercices(entree.exercicesPersonnalises)}

## Ma demande

Ma demande : …
`
  return { consigne, exemple, schema }
}

export const NOMS_FICHIERS_MODELE = {
  consigne: 'consigne-ia-pandamove.md',
  exemple: 'exemple-pandamove-seances-ia.json',
  schema: 'schema-pandamove-seances-ia.json',
} as const

/** Exercices personnalisés vivants de la base locale : seuls leurs noms et groupes sont lus. */
export async function lireExercicesPersonnalises(db: Db): Promise<ExerciceListe[]> {
  const lignes = await db.getAll<{ name: string; muscle_primary: string | null }>(
    'SELECT name, muscle_primary FROM exercises WHERE deleted_at IS NULL AND is_custom = 1 ORDER BY name',
  )
  return lignes.map((l) => ({ name: l.name, musclePrimary: l.muscle_primary ?? '' }))
}
