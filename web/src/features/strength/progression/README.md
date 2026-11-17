# strength/progression

Évaluation de la surcharge progressive d'une séance de renforcement (miroir web de `InstanceExecuteViewModel` Android). Partagé par la fin de séance (`execute`) et le bilan (`report`). Le moteur pur vit dans `core/progression` ; ce dossier fait le lien entre ce moteur, la base et « Mon matériel ».

## Interface

- `cible.ts`
  - `parseChargeKg(chargeCible)`, `cibleInitiale(es)`, `cibleDepuis(objectif, es)` : cible courante (objectif, sinon modèle).
  - `lireListeEquipement(json)`, `pasMaterielExercice(equipement, pasParCategorie)`, `chargesAtteignablesExercice(equipement, inventaire)` : pas et charges composables.
  - `dateLocale(ms)` : date locale `yyyy-MM-dd`.
  - `objectifApresDecision(decision, proposition, existant, ctx, derniereMaj)` : objectif à écrire pour Oui / Non / Ajuster. Types `Decision`, `ContexteDecision`.
- `evaluation.ts`
  - `evaluerInstance(db, instanceId, userId?, bases?)` : évaluation en lecture seule, un `EvaluationExercice` par exercice en progression.
  - `evaluerEtAppliquerSilencieux(tx, instanceId, { userId, maintenantMs })` : fin de séance, applique seulement les échecs simples.
  - `appliquerDecision(tx, instanceId, e, decision, maintenantMs)` : écrit une décision du récap.
  - `appliquerSilencieusement`, `marquerObjectif`, `marquerProposition`.
- `apercu.ts` : `calculerApercus(db, seanceId, exercices, userId)` renvoie une `Map` (id de ligne d'instance vers proposition si tout réussit, compteur d'échec 0).
- `ciblesInstance.ts` : `libelleChargeCible`, `rafraichirCiblesProgression(db, instanceId)` aligne les cibles de la copie d'instance sur l'objectif courant.
- `reevaluation.ts` : `reevaluerApresCorrection(db, instanceId, { userId, maintenantMs })` renvoie des `ChangementProgression` (`recalculee` | `a_redecider` | `objectif_deja_evolue`).

## Invariants

- Seuls les exercices avec `progressionActivee` sont évalués ; une proposition à valider (succès, deload, non loggé) n'est jamais écrite sans geste explicite de l'utilisateur.
- Une instance est évaluée une seule fois (marqueur `progression.evaluee`) ; une décision déjà enregistrée pour un exercice n'est pas réécrite (`dejaDecidee`).
- « Non » conserve la cible existante, avec le compteur d'échec de la proposition.
- `rafraichirCiblesProgression` ne touche jamais une instance terminée ni le modèle (lignes d'instance seulement).
- Réévaluation : repart de la cible et du compteur d'origine (bases du marqueur) ; ne touche pas un objectif modifié depuis ; sans base, jamais recalculée ; idempotente.
- Les durées (`DURATION`) sont des secondes, pas des répétitions.

## Side Effects

- Écritures SQL (objectifs, `exercices_seance` de l'instance, nombre de séries prévues, `progression_json` de l'instance) uniquement dans la transaction (`DbTx`) fournie ; `evaluerInstance` et `calculerApercus` sont en lecture seule.
- Lecture de `settings` (équipement stocké) quand `userId` est fourni.

## Dépendances

`core/db` (repos instances, objectifs, séances, séries, settings), `core/progression` (engine, marqueur, inventory, chargeLisible), `core/import/equipment`.

## Verification

`cd web && npm test` (vitest).
