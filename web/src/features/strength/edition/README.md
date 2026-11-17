# strength/edition

Briques de l'écran d'édition d'une séance de renforcement (`SeanceEditScreen`) : cartes de blocs et d'exercices, sélecteur d'exercices, configuration de la surcharge progressive, estimation de durée. Miroir web de `SeanceCreateScreen.kt` / `ProgressionConfigSection.kt` (Android).

## Interface

Logique pure (sans React) :
- `regles.ts` : `reglesBloc(type)`, `reglesExercice(typeBloc | null)` (champs affichables selon le contexte), `ICONES_BLOC`, `DESCRIPTIONS_BLOC`, `textesPas` (pas des compteurs de repos, en secondes).
- `resume.ts` : `formatReps`, `resumeExercice`, `decouperDuree` / `assemblerDuree` (min:sec <-> secondes en texte), `normaliserCharge`.
- `dureeEstimee.ts` : `repsVisees`, `dureeSerieSec`, `detailDuree`, `dureeEstimeeSec`, `dureeEstimeeMin`, `libelleDuree`, `libelleSecondes` et constantes d'hypothèses (`SEC_PAR_REPETITION`, `SERIE_MIN_SEC`, `REPS_PAR_DEFAUT`, `DUREE_PAR_DEFAUT_SEC`, `TRANSITION_SEC`).
- `progressionConfig.ts` : `SYSTEMES_PROGRESSION`, `TYPES_EXERCICE`, `aideSysteme`, `activerProgression`, `desactiverProgression`, `choisirSysteme`, `basculerPoidsDeCorps`, `optionsIncrement`, `apercuMontee`, `indiceCharge`, `avertissementsProgression`.
- `selecteur.ts` : `FILTRE_SELECTEUR_INITIAL`, `exerciceDisponible`, `filtrerSelecteur`, `basculerSelection`.
- `pasCompteur.ts` : `avancerCompteur(valeur, sens, pas, min)`.

Hooks :
- `useExerciceVue(e, typeBloc, materiel)` : regroupe règles, résumé, indice de charge et aperçu de montée (type `ExerciceVue`).
- `useSelecteurExercices({ catalogue, categoriesPossedees, ajouter })` : recherche, groupe, « Mon matériel », sélection multiple.
- `useSuppressionBloc(supprimer)` : suppression immédiate si le bloc est vide, sinon confirmation.
- `useAvertissementFermeture(modifie)` : `beforeunload` tant qu'il y a des modifications.

Composants : `BlocCarte` (+ `ActionsBloc`), `ExerciceCarte` (+ `ActionsExercice`), `ProgressionSection`, `SelecteurDialog`, `MenuAjoutBloc`, `DialogueConfirmation`, `GardeSortie`, `ChoixSegmente`, `Compteur`, `DureeMinSec`, `AffichageDuree`.

## Invariants

- Les composants ne décident de rien : ils lisent les tables de `regles.ts` et le résultat de `useExerciceVue`.
- Les fonctions de `progressionConfig.ts` retournent un nouvel `ExerciceDraft` (pas de mutation) ; les valeurs écrites sont celles que relit le moteur `core/progression/engine`.
- Pas de surcharge progressive en bloc ECHAUFFEMENT ni ACTIVATION ; en CIRCUIT, les exercices sont toujours en durée, sans séries propres.
- La sélection du sélecteur garde l'ordre des coches (jamais triée par nom) et repart de zéro à chaque ouverture.
- `avancerCompteur` ne descend jamais sous `min` et arrondit à 2 décimales (pas de dérive de flottant).
- La durée estimée est un ordre de grandeur calculé sur le contenu, volontairement un peu large (voir l'en-tête de `dureeEstimee.ts` pour les hypothèses).
- `normaliserCharge` laisse intacts le texte libre (« PDC ») et les saisies incomplètes.

## Side Effects

- `useAvertissementFermeture` ajoute/retire un écouteur `beforeunload` sur `window`.
- `GardeSortie` utilise `useBlocker` (react-router) : n'agit qu'avec un routeur de données, inactive sous un routeur simple (tests).
- Le reste est pur ; l'état local se limite aux hooks de sélecteur et de suppression.

## Dépendances

`../draft` (types `SeanceDraft`, `BlocDraft`, `ExerciceDraft`, `TypeBloc`), `../progression/cible`, `../catalog/filtreCatalogue`, `core/progression/*`, `core/import/equipment`, `core/db/types`.

## Verification

`cd web && npm test` (vitest) ; une classe seule : `npx vitest run src/features/strength/edition`.
