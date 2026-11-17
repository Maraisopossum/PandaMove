# strength/execute

Écran d'exécution d'une séance de renforcement (instance calendrier) : saisie des séries, repos, montée en charge, calculateur de disques, horloge de séance, sortie et correction. Le circuit automatique est dans [./circuit/README.md](./circuit/README.md).

## Interface

- Écran : `ExecuteScreen` (export par défaut ; props `correction`, `instanceId`, `enFond`), `ExecutionEnFond`, `BandeauSeanceActive`, `BandeauLive`, `BarreExercices`, `TableauSeries`, `CelluleStepper`, `DialogueSortie`, `GardeSortieExecution`, `GardeCorrection`, `RenommerSeanceDialog`, `Feuille` et ses variantes `FeuilleDisques`, `FeuilleMinuteur`, `FeuilleMontee`, `MenuRepos`.
- Hook principal : `useExecute(instanceId, DepsExecute)` ; orchestration d'écran : `useEcranExecution`. Hooks associés : `useTableauSeries`, `useMinuteurRepos`, `useBipsRepos`, `useMontee`, `useNavExercices`, `useCalculateurDisques`, `useMateriel`, `useHistoriqueExercice`, `useNotesSeance`, `useRenommageSeance`, `useSuppressionSeanceEnCours`, `useGardeSortie`, `useSeanceActive`, `useTitreOnglet`, `useTicker`, `useWakeLock`, `useReglageRpe`.
- Modèle de vue : `construireVue`, `verifierMesures`, `infoRepos`, `reposRestant`, `formaterDuree`, `texteCibles`, `texteSerie` (types `ExerciceVue`, `BlocVue`, `SerieVue`, `Mesures`).
- Logique pure : `construireLignes`, `propagerCharge`, `valeursLigne` (`lignesSeries.ts`) ; `apresSerie`, `exerciceComplet`, `exerciceValide` (`navigationSeries.ts`) ; `calculerDisques`, `configurationMateriel` (`disques.ts`) ; `calculerPaliers`, `protocoleDefaut`, `monteeDisponible` (`montee.ts`) ; `bandeauProgression`, `texteBandeau` ; `construireNav` (`navExercices.ts`) ; `messageFin` ; `optionsSortie`, `gardeSortieActive` ; `bipRepos`, `finRepos` ; `dernieresSeries` ; `chargeSuivante`, `valeurSuivante` ; `choisirSeanceActive`, `titreOnglet`.
- Horloge : `elapsedMs`, `estEnPause`, `clockFromRow`, `clockToRow` (type `SessionClock`).
- Minuteur de repos : `restantMs`, `ajuster`, `arreter`, `demarrerManuel`, `forcerDuree`, `oublierReglage`, `serialiserEtat`, `lireEtat`, `ETAT_INITIAL`, `PRESETS_MANUEL`.
- Stockage : `lireStockage`, `ecrireStockage`, `lireReglageRpe`, `ecrireReglageRpe`.

## Invariants

- Le temps écoulé de la séance est toujours recalculé depuis `started_at` et `paused_json` (`elapsedMs`), jamais incrémenté en mémoire : rechargement, onglet en arrière-plan et veille ne perdent rien.
- `useExecute` accepte des dépendances injectables (`db`, `nowFn`, `tickMs`, `userId`, `correction`) ; `db` et `nowFn` doivent être des références stables.
- Le mode `correction` rouvre une séance terminée ; `GardeCorrection` bloque la sortie via une référence `bloquerRef`.
- Les séries en `RepsType` `DURATION` portent des secondes dans `reps` (`libelleReps`, `rpeApplicable`) ; `verifierMesures` valide les mesures selon `repsType`.
- Le décompte du repos s'appuie sur l'instant courant (`restantMs`) ; `bipRepos` et `finRepos` ne déclenchent un bip qu'au franchissement d'un seuil entre deux valeurs successives.
- Une séance active n'est proposée à la reprise que si elle date de moins de 24 h (`choisirSeanceActive`).
- Les lecteurs de stockage (`lireStockage`, `lireReglageRpe`, `lireEtat`) tolèrent un stockage indisponible ou un contenu invalide.

## Side Effects

- Base locale (via `getDb` de `core/db/client`) : `useExecute` copie le template vers l'instance (`copyTemplateToInstance`), démarre, termine ou abandonne l'instance (`demarrerInstance`, `terminerInstance`, `abandonnerDemarrage`), enregistre les pauses, les notes, le renommage et les séries (`addSerie`, `updateSerie`, `supprimerSeriesNumeros`, `changerSeriesPrevues`), puis lance l'évaluation de progression à la fin (`evaluerEtAppliquerSilencieux`).
- `setInterval` : `useTicker` (1 s par défaut), `useSeanceActive`, `ExecutionEnFond` (vérification toutes les 10 s).
- `localStorage` : réglage RPE (`reglageRpe.ts`) et état du minuteur de repos (via `stockageNavigateur.ts`).
- `navigator.wakeLock` maintenu actif par `useWakeLock` pendant l'exécution ; le titre de l'onglet est mis à jour par `useTitreOnglet`.
- Bips de repos via `useBipsRepos` (sonneur de [./circuit/README.md](./circuit/README.md)).

## Verification

`cd web && npm test`
