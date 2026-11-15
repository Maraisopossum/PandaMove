# Renforcement (strength) Blueprint

## System Overview

Module Renforcement de PandaMove : séances types (modèles), séances programmées (instances datées), exécution, rapport et catalogue d'exercices. Les écrans lisent et écrivent la base locale PowerSync (SQLite) via `core/db` ; la synchronisation est assurée ailleurs. Une séance existe sous deux formes dans les mêmes tables : le modèle (`instance_seance_id IS NULL`) et l'instance jouée à une date.

## Local Interface & Invariants

- **Écrans (export default)** : `SeanceListScreen` (modèles), `SeanceDetailScreen`, `SeanceEditScreen` (création/édition d'un modèle ou d'une instance), `ListeInstancesScreen` (séances programmées / terminées).
- **Brouillon d'édition** : `draft.ts` (`SeanceDraft`, `BlocDraft`, `ExerciceDraft`, `TYPES_BLOC`, fonctions pures `ajouterBloc`, `ajouterExercice`, `supprimerBloc`, `changerTypeBloc`, `deplacerRelatif`, `appliquerSeriesCircuit`, `validerBrouillon`…) ; persistance dans `seanceStore.ts` (`chargerBrouillon`, `enregistrerBrouillon`, `ecrireBrouillon`, `compterSeriesPerdues`, `ErreurEditionInstance`).
- **Cycle de vie d'une séance** : `affectation.ts` (`assignerSeance`, `lancerSeanceMaintenant`, `archiverSeance`, `desarchiverSeance`, `ErreurSeance`), `planification.ts` (`datesRecurrence`, `assignerDates`), `seanceDirecte.ts` (`creerSeanceDirecte`, catégorie `STRENGTH_ONESHOT`), `duplication.ts` (`dupliquerSeance`), `suppression.ts` / `suppressionSelection.ts` (suppression logique avec ou sans historique).
- **Lecture** : `detailSeance.ts` (`lireDetailSeance`), `listesInstances.ts` (`lireSeancesProgrammees`, `lireSeancesTerminees`), `rechercheSeances.ts` (`filtrerSeances`).
- **Composants et hooks partagés** : `champs.tsx` (`ChampTexte`, `ChampNombre`, `ChampChoix`…), `MenuActions`, `AssignDialog`, `SupprimerDialog`, `useMenu`, `usePiegeFocus` (relais vers `core/ui/usePiegeFocus`), `useSelection`.
- **Invariants** :
  - Un modèle se distingue d'une instance par `instance_seance_id IS NULL` ; filtrer avant toute copie.
  - Les suppressions sont logiques (`deleted_at`).
  - `ecrireBrouillon(tx, …)` s'exécute dans la transaction fournie par l'appelant ; `enregistrerBrouillon` ouvre la transaction.
  - Les dates sont des chaînes ISO validées (`dateIsoValide`) ; une récurrence est bornée à `MAX_OCCURRENCES` (365).

## Subdirectories & System Boundaries

- catalog: [./catalog/README.md](./catalog/README.md) - catalogue d'exercices : liste, recherche, filtres, création/modification/suppression, installation du catalogue de base.
- edition: [./edition/README.md](./edition/README.md) - cartes bloc/exercice, sélecteur d'exercices, surcharge progressive, durée estimée.
- execute: [./execute/README.md](./execute/README.md) - exécution d'une séance : tableau de séries, repos, circuit automatique, séance en cours.
- progression: [./progression/README.md](./progression/README.md) - surcharge progressive.
- report: [./report/README.md](./report/README.md) - rapport et bilan d'une séance terminée.

## Global Invariants

- Le temps est stocké en secondes (entiers) en base ; les exercices en durée (`RepsType.DURATION`) stockent des secondes dans `repsRealisees`.
- Les écrans ne portent pas de logique métier : elle vit dans les hooks `use*` et les fonctions pures.

## Global Side Effects

- Écritures dans la base locale PowerSync (tables `seances`, `blocs_seance`, `exercices_seance`, `instances_seance`, `series`), répliquées ensuite vers Supabase.
- `core/ui/verrouDefilement` (appelé par `usePiegeFocus`) verrouille le défilement de la page tant qu'une boîte de dialogue est ouverte.

## System Verification

- Run: `cd web && npm test`
