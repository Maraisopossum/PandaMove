# PandaMove WebApp — Phase 1 (Renforcement) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la WebApp PandaMove (renforcement) : PWA React hors ligne, synchronisée entre appareils via Supabase et PowerSync, qui reprend les données de l'app Android PandaFit.

**Architecture:** Le navigateur lit et écrit uniquement dans un SQLite local (WASM, SDK PowerSync). PowerSync synchronise ce SQLite avec Supabase Postgres (Auth, RLS). La logique métier (moteur de progression, inventaire, import) vit dans des fonctions pures testées par fixtures ; l'UI ne contient aucune logique.

**Tech Stack:** React, TypeScript, Vite, vite-plugin-pwa, React Router, `@powersync/web` + `@powersync/react`, `@supabase/supabase-js`, Zod, Vitest, Playwright, sharp (script d'images), Supabase CLI, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-10-24-pandafit-webapp-phase1-design.md`

## Global Constraints

- Nom de l'application web : **PandaMove** (PandaFit = l'app Android actuelle, qui reste inchangée et fonctionnelle).
- Tout le code web est dans `web/`, **non ajouté** à `settings.gradle.kts`. Aucun fichier Kotlin n'est modifié.
- Stack : React + TypeScript + Vite, PWA installable ; Supabase (Postgres, Auth, RLS) ; sync PowerSync ; hébergement Cloudflare Pages.
- Clés primaires en **UUID** ; colonnes `user_id` (défaut `auth.uid()`), `updated_at`, `deleted_at` (suppression logique) sur chaque table synchronisée.
- Temps : secondes (entier) en base, millisecondes au runtime.
- **RLS activée partout**, politique `user_id = auth.uid()` en lecture et en écriture. Seule la clé anon est dans le front ; aucun secret dans le dépôt.
- Aucune logique dans les composants React : hooks ou fonctions pures.
- Toujours `ORDER BY position` pour les enfants ; template = `instance_seance_id IS NULL` ; copie template → instance une seule fois.
- `reps_type = 'DURATION'` : `reps_realisees` est en secondes, exclu des calculs de tonnage et de reps.
- Stats : filtre sur la date planifiée (`instances_seance.date`), jamais `completed_at`.
- Deload : **proposé** (Oui / Non / Ajuster), jamais imposé.
- Icône 📅 d'affectation : uniquement sur l'écran liste des séances.
- Règle de conflit : dernier écrit gagne par ligne ; séries réalisées en ajout uniquement, un UUID par série.
- Commentaires de code en **français**. Les commits se terminent par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Export ancien (v3.0 / v3.1)** sans `equipmentConfig` ni `objectifsProgression` : l'import réussit avec des valeurs par défaut. Test dans la tâche 9.
2. **Import rejoué deux fois** : aucun doublon (ids déterministes). Test dans la tâche 9.
3. **Fichier JSON corrompu ou tronqué** : rejet avec message clair, aucune ligne insérée (transaction unique). Test dans les tâches 9 et 10.
4. **Onglet fermé ou téléphone verrouillé en pleine séance** : à la réouverture, séries saisies et chrono sont retrouvés. Test dans la tâche 14.
5. **Base vide** (aucune séance, aucune instance, inventaire vide) : calendrier, stats et progression affichent un état vide propre ; sans inventaire, la progression retombe sur le pas simple. Tests dans les tâches 7, 16 et 17.

## Prérequis manuels (à faire par l'utilisateur, aucun secret n'est saisi par l'agent)

- Node 20+, Docker, Supabase CLI installés.
- Un projet Supabase (URL et clé anon), une instance PowerSync Cloud liée à ce projet, un projet Cloudflare Pages connecté au dépôt (racine `web`, build `npm run build`, sortie `dist`).
- Fichier `web/.env.local` (ignoré par git) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POWERSYNC_URL`.

## File Structure

```
web/
  package.json, vite.config.ts, tsconfig.json, playwright.config.ts, .env.example
  public/_redirects                      # SPA fallback Cloudflare
  supabase/migrations/*.sql              # schéma + RLS
  supabase/tests/rls.test.sql            # test RLS à deux utilisateurs
  powersync/sync-rules.yaml              # règles de synchronisation
  scripts/build-images.mjs               # PNG -> WebP + manifeste
  src/app/        (routes, shell, drawer, thème)
  src/core/db/    (schema.ts, client.ts, ids.ts, types.ts, repos/*.ts)
  src/core/sync/  (connector.ts, useSyncStatus.ts)
  src/core/auth/  (AuthProvider.tsx)
  src/core/progression/ (types.ts, inventory.ts, engine.ts, __fixtures__/*.json)
  src/core/import/ (schema.ts, plan.ts, apply.ts)
  src/core/images/ (pandaImage.ts, manifest.generated.ts)
  src/features/   (strength, calendar, stats, profile, import, auth)
  e2e/            (offline-sync.spec.ts, strength-flow.spec.ts)
.github/workflows/web-ci.yml
```

---

### Task 1: Squelette web, CI et déploiement

**Files:**
- Create: `web/` (Vite React TS), `web/public/_redirects`, `.github/workflows/web-ci.yml`, `web/.gitignore`
- Test: `web/src/app/smoke.test.ts`

**Interfaces:**
- Produces: scripts npm `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`.

- [ ] **Step 1: Test** `smoke.test.ts` : `it('vitest tourne', () => expect(1 + 1).toBe(2))`.
- [ ] **Step 2: Run** `cd web && npm run test` → FAIL (projet inexistant).
- [ ] **Step 3: Scaffolder** le projet Vite React TS dans `web/`, ajouter Vitest, ESLint, Playwright. `public/_redirects` contient `/* /index.html 200`. `.gitignore` exclut `.env.local`, `dist`, `node_modules`.
- [ ] **Step 4: Workflow CI** `web-ci.yml` : déclenché sur PR et push `main`, filtré sur `web/**`, étapes `npm ci`, `lint`, `typecheck`, `test`, `build` (Node 20). Distinct du `ci.yml` Android.
- [ ] **Step 5: Run** `npm run lint && npm run typecheck && npm run test && npm run build` → tout passe.
- [ ] **Step 6: Commit** `feat(web): squelette PandaMove web, CI et fallback SPA`.

### Task 2: Schéma Postgres, RLS et test à deux utilisateurs

**Files:**
- Create: `web/supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `web/supabase/tests/rls.test.sql`

**Interfaces:**
- Produces: tables Postgres ci-dessous, utilisées par les tâches 3, 6 et 9.

Tables (toutes avec `id uuid primary key`, `user_id uuid not null default auth.uid()`, `updated_at timestamptz not null default now()`, `deleted_at timestamptz`) et colonnes métier = colonnes Room v27 (`core/database/schemas/.../27.json`) en snake_case, `INTEGER` booléens → `boolean`, clés étrangères → `uuid` :
- `exercises`, `seances` (avec `is_archived`), `blocs_seance`, `exercices_seance`, `instances_seance`, `series_realisees`, `objectifs_progression` (avec `nombre_series_cible`).
- Ajouts propres au web : `exercices_seance.exercice_source_id uuid` et `blocs_seance.bloc_source_id uuid` (ligne de template dont l'instance est la copie) ; table `user_settings(id, user_id, equipment_json text, panda_variant text check in ('male','female') default 'male', dark_mode boolean default false, updated_at, deleted_at)`.
- Contraintes : `CHECK (reps_type in ('REPS','DURATION'))`, `CHECK (type_exercice in ('COMPOSE_BAS','COMPOSE_HAUT','ISOLATION','MACHINE','PDC') or type_exercice is null)`, unicité partielle `(instance_seance_id, exercice_source_id) where instance_seance_id is not null and deleted_at is null`.
- Trigger `set_updated_at` avant update sur chaque table.
- RLS : `enable row level security` + politique `using (user_id = auth.uid()) with check (user_id = auth.uid())` sur chaque table.

- [ ] **Step 1: Test SQL** `rls.test.sql` : crée deux utilisateurs, l'utilisateur A insère une `seances`, puis sous le rôle de B `select count(*) from seances` = 0 et un `update` / `delete` de la ligne de A affecte 0 ligne ; un `insert` de B avec `user_id` de A est refusé.
- [ ] **Step 2: Run** `supabase start && supabase test db` → FAIL (tables absentes).
- [ ] **Step 3: Écrire** les deux migrations selon la liste ci-dessus.
- [ ] **Step 4: Run** `supabase db reset && supabase test db` → PASS.
- [ ] **Step 5: Commit** `feat(web): schéma Postgres, RLS et test d'isolation`.

### Task 3: Authentification, client PowerSync et indicateur de synchronisation

**Files:**
- Create: `web/powersync/sync-rules.yaml`, `web/src/core/db/schema.ts`, `client.ts`, `web/src/core/sync/connector.ts`, `useSyncStatus.ts`, `web/src/core/auth/AuthProvider.tsx`, `web/src/features/auth/LoginScreen.tsx`
- Test: `web/src/core/sync/useSyncStatus.test.ts`, `web/src/core/sync/connector.test.ts`

**Interfaces:**
- Consumes: tables de la tâche 2.
- Produces: `AppSchema` (schéma PowerSync, une table par table Postgres, mêmes colonnes) ; `getDb(): PowerSyncDatabase` ; `class SupabaseConnector implements PowerSyncBackendConnector` (`fetchCredentials()` renvoie le JWT Supabase, `uploadData(db)` applique chaque CRUD vers Supabase, `PATCH` comme `upsert`, `DELETE` converti en mise à jour de `deleted_at`) ; `useAuth(): { session: Session | null; signIn(email: string, password: string): Promise<void>; signUp(email: string, password: string): Promise<void>; signInWithMagicLink(email: string): Promise<void>; signOut(): Promise<void> }` ; `useSyncStatus(): { state: 'online' | 'offline' | 'syncing' }`.

- [ ] **Step 1: Tests** : `useSyncStatus` renvoie `offline` quand `connected=false`, `syncing` quand `dataFlowStatus.uploading` ou `downloading`, `online` sinon ; `uploadData` transforme un CRUD `DELETE` sur `seances` en `update seances set deleted_at = <now>` (client Supabase simulé).
- [ ] **Step 2: Run** `npm run test -- sync` → FAIL.
- [ ] **Step 3: Implémenter** les signatures ci-dessus. `sync-rules.yaml` : un seul bucket `user_data` paramétré par `request.user_id()`, qui sélectionne chaque table `where user_id = bucket.user_id` (suivre la doc PowerSync pour Supabase).
- [ ] **Step 4: Écran de connexion** : formulaire email/mot de passe et lien magique, sans logique dans le composant (appelle `useAuth`).
- [ ] **Step 5: Run** `npm run test && npm run typecheck` → PASS.
- [ ] **Step 6: Commit** `feat(web): auth Supabase, client PowerSync et indicateur de sync`.

### Task 4: PWA installable et barrière de l'étape 1 (hors ligne → sync)

**Files:**
- Modify: `web/vite.config.ts` (vite-plugin-pwa)
- Create: `web/public/icons/` (192, 512, maskable, depuis `assets/09_UI_Formats/app_icon_v1.png`), `web/e2e/offline-sync.spec.ts`, `web/dev/docker-compose.powersync.yml`

**Interfaces:**
- Consumes: `getDb()`, `useAuth()` (tâche 3).

- [ ] **Step 1: Test e2e** `offline-sync.spec.ts` : connecté, `context.setOffline(true)`, insère une `seances` via l'UI de debug `/debug/write`, vérifie l'indicateur « hors ligne », `setOffline(false)`, attend « en ligne », puis ouvre un second contexte du même compte et vérifie que la séance y apparaît.
- [ ] **Step 2: Run** `npx playwright test offline-sync` → FAIL.
- [ ] **Step 3: Configurer** le manifeste (nom `PandaMove`, `display: standalone`, icônes) et le service worker (précache du shell ; icônes et splash seulement). Ajouter la page de debug `/debug/write`, active uniquement en mode dev.
- [ ] **Step 4: Run** le test e2e contre Supabase local et PowerSync (compose) → PASS. **C'est la barrière** : si elle échoue, ne pas poursuivre avant correction.
- [ ] **Step 5: Commit** `feat(web): PWA installable et preuve hors ligne vers sync`.

### Task 5: Coque applicative (routes, drawer, thème)

**Files:**
- Create: `web/src/app/AppShell.tsx`, `routes.tsx`, `theme.ts`, `modules.ts`
- Test: `web/src/app/routes.test.tsx`

**Interfaces:**
- Produces: `MODULES: Record<'home'|'strength'|'calendar'|'stats'|'profile'|'import', { path: string; label: string; color: string }>` (strength violet, stats orange, couleurs de `DESIGN.md`) ; routes `/`, `/strength`, `/strength/new`, `/strength/:id/edit`, `/strength/instance/:id`, `/strength/instance/:id/report`, `/calendar`, `/stats`, `/profile`, `/import`.

- [ ] **Step 1: Test** : chaque entrée de `MODULES` pointe vers une route déclarée, et la route inconnue rend une page « introuvable ».
- [ ] **Step 2: Run** `npm run test -- routes` → FAIL.
- [ ] **Step 3: Implémenter** drawer permanent au-dessus de 1024 px, rétractable en dessous, barre du haut colorée par module, indicateur de sync à droite, mode sombre lu depuis `user_settings`.
- [ ] **Step 4: Run** tests et typecheck → PASS. **Step 5: Commit** `feat(web): coque applicative, routes et thème`.

### Task 6: Types de domaine, ids et dépôts de données

**Files:**
- Create: `web/src/core/db/ids.ts`, `types.ts`, `repos/seances.ts`, `repos/instances.ts`, `repos/series.ts`, `repos/exercises.ts`, `repos/settings.ts`
- Test: `web/src/core/db/repos/*.test.ts` (SQLite en mémoire)

**Interfaces:**
- Produces: `newId(): string` ; `deterministicId(namespace: string, name: string): string` (UUID v5) ; types de ligne camelCase `Seance`, `BlocSeance`, `ExerciceSeance`, `InstanceSeance`, `SerieRealisee`, `ObjectifProgression`, `Exercise`, `UserSettings` (champs = colonnes de la tâche 2) ; `listSeanceTemplates(db): Promise<Seance[]>` ; `getSeanceTree(db, seanceId: string, instanceId: string | null): Promise<{ blocs: BlocSeance[]; exercices: ExerciceSeance[] }>` (blocs et exercices **triés par `position`**, filtrés sur `instance_seance_id` identique à `instanceId`) ; `softDelete(db, table: string, id: string): Promise<void>`.

- [ ] **Step 1: Tests** : `deterministicId('a','b')` est stable et diffère de `deterministicId('a','c')` ; `getSeanceTree` renvoie des exercices insérés dans le désordre triés par `position` ; une ligne `softDelete` disparaît de `listSeanceTemplates` ; avec `instanceId = null`, les lignes d'instance ne sont pas renvoyées.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter** selon les signatures (toutes les requêtes ajoutent `deleted_at IS NULL`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): types de domaine, ids déterministes et dépôts`.

### Task 7: Portage d'EquipmentInventory (fixtures puis TypeScript)

**Files:**
- Create: `web/src/core/progression/types.ts`, `inventory.ts`, `__fixtures__/inventory.json`
- Test: `web/src/core/progression/inventory.test.ts`

**Interfaces:**
- Produces: `DisquesConfig { barreKg: number; disques: Record<string, number> }` (clé = poids du disque) ; `PlageConfig { minKg; maxKg; pasKg }` ; `HalteresConfig { poidsFixes: number[]; chargeable: DisquesConfig | null }` ; `EquipmentInventaire` (mêmes champs que `EquipmentInventaire` Kotlin) ; `chargesAtteignables(cfg: DisquesConfig | PlageConfig | HalteresConfig): number[]` (trié, sans doublon) ; `chargesAtteignablesPourEquipement(inv: EquipmentInventaire, equipment: string[]): number[]` ; `chargeNonComposableHint(charges: number[], chargeKg: number, epsilon?: number): number | null`.

- [ ] **Step 1: Fixtures** : lire `core/database/src/main/java/com/pandafit/core/database/catalog/EquipmentInventory.kt` et `EquipmentInventoryTest.kt` ; traduire chacun des 8 cas de test en entrée/sortie dans `inventory.json`, plus un cas d'**inventaire vide** (renvoie `[]`).
- [ ] **Step 2: Test** `inventory.test.ts` : boucle sur chaque cas de la fixture et compare `toEqual` avec la sortie attendue.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implémenter** la combinatoire de disques, la plage et les haltères en reprenant l'algorithme Kotlin (arrondi à 0,01 kg, mêmes bornes).
- [ ] **Step 5: Run** → PASS. **Step 6: Commit** `feat(web): portage EquipmentInventory avec fixtures partagées`.

### Task 8: Portage de ProgressionEngine

**Files:**
- Create: `web/src/core/progression/engine.ts`, `__fixtures__/engine.json`
- Test: `web/src/core/progression/engine.test.ts`

**Interfaces:**
- Consumes: `types.ts` de la tâche 7.
- Produces (mêmes noms que Kotlin) : `StatutExercice = 'SUCCES' | 'SUCCES_SANS_MARGE' | 'ECHEC' | 'ECHEC_MARQUE' | 'NON_LOGGE'` ; `PropositionProgression { statut; nouvelleChargeCible: number | null; nouveauRepsCible: number | null; nouvelleDureeCible: number | null; nouveauCompteurEchec: number; deload: boolean; nouveauNombreSeries: number | null }` ; `CibleExercice { chargeKg: number | null; reps: number | null; dureeSec: number | null }` ; `ExerciceConfig` (sous-ensemble camelCase de `ExerciceSeance` utilisé par le moteur : `repsType`, `systemeProgression`, `repsMin`, `repsMax`, `incrementKg`, `incrementDureeSec`, `seuilDeload`, `typeExercice`, `incrementPct`, `isBodyweight`) ; `requiresValidation(p: PropositionProgression): boolean` ; `evaluerExercice(config, cible, compteurEchecActuel: number, seriesRealisees: SerieRealisee[], isBilateral: boolean, pasMateriel?: number, chargesAtteignables?: number[]): PropositionProgression` ; `serieReussie(config, cible, serie): boolean` ; `proposerMontee(config, cible, compteurEchecActuel, pasMateriel?, chargesAtteignables?, repsReellementAtteintes?): PropositionProgression` ; `calculerIncrementQualitatif(chargeActuelle: number, typeExercice: TypeExercice | null, incrementPctOverride: number | null, pasMateriel: number | null, chargesAtteignables: number[] | null, incrementKgManuel: number | null): number`.

- [ ] **Step 1: Fixtures** : lire `ProgressionEngine.kt` (367 lignes, à lire par tranches) et `ProgressionEngineTest.kt` ; traduire les 30 tests en cas `{ nom, entrée, attendu }` dans `engine.json`. Cas exigés explicitement : plafond de saut +10 %, dépassement du haut de plage en système DOUBLE, poids de corps (ajout de série au plafond de reps), `chargeActuelle` inférieure au minimum atteignable (pas de snapping), bilatéral G/D (pire côté retenu), deload avec statut `ECHEC` (`requiresValidation` doit rester `true`), séries `DURATION` ignorées pour la charge.
- [ ] **Step 2: Test** `engine.test.ts` : boucle sur `engine.json`, `toEqual` sur la proposition ; test dédié `requiresValidation({ statut: 'ECHEC', deload: true, ... })` vaut `true`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implémenter** chaque fonction en reprenant les constantes (`SEUIL_ECART_LEGER 0.15`, `SEUIL_ECART_FLAG 0.30`, `RPE_SANS_MARGE 9`, `POURCENTAGE_DELOAD 0.10`, `PLAFOND_SAUT_PCT 0.10`) et l'ordre de sévérité `ECHEC_MARQUE > ECHEC > SUCCES_SANS_MARGE > SUCCES / NON_LOGGE`.
- [ ] **Step 5: Run** → PASS (30 cas). **Step 6: Commit** `feat(web): portage ProgressionEngine avec fixtures partagées`.

### Task 9: Import JSON v3.x — schéma, plan d'import déterministe

**Files:**
- Create: `web/src/core/import/schema.ts`, `plan.ts`, `web/src/core/import/__fixtures__/` (copies de `support/pandamove_exercises_2026-08-25.json`, `pandamove_equipment_2026-08-25.json`, `pandafit-programme-pps-2026-08-29.json`, `pandafit-macrocycle-6mois-2026-08-29.json`)
- Test: `web/src/core/import/plan.test.ts`

**Interfaces:**
- Consumes: `deterministicId` (tâche 6).
- Produces: `PandaMoveExportSchema` (Zod, reprend `ExportDtos.kt` : `strengthTemplates`, `strengthSessions { completed, planned }`, `customExercises`, `objectifsProgression`, `equipmentConfig`, tous les champs optionnels avec les défauts du Kotlin) ; `ExerciseCatalogExportSchema` ; `EquipmentConfigExportSchema` ; `type ImportPlan = { rows: Record<TableName, Row[]>; report: { seances: number; instances: number; series: number; exercises: number } }` ; `buildImportPlan(input: unknown, userId: string): ImportPlan` (les ids `Long` deviennent `deterministicId(userId + ':' + table, String(id))` ; les exercices du catalogue sont résolus par `exerciceName` puisque l'export ne contient pas le catalogue de base ; lève `ImportError` avec le chemin du champ fautif).

- [ ] **Step 1: Tests** (avec les exports réels de `support/` comme fixtures) : (a) `buildImportPlan` sur l'export programme PPS produit des séances, blocs et exercices non vides ; (b) **deux appels donnent exactement les mêmes ids** ; (c) un export sans `equipmentConfig` ni `objectifsProgression` (v3.0/3.1) passe avec défauts ; (d) un JSON tronqué ou de mauvais type lève `ImportError` avec le champ en cause ; (e) les `exercices` d'une instance gardent `instance_seance_id` non nul et un `exercice_source_id` quand le template existe.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter** schéma et `buildImportPlan` (fonction pure, aucun accès base).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): schéma d'import v3.x et plan déterministe`.

### Task 10: Application de l'import et écran d'import

**Files:**
- Create: `web/src/core/import/apply.ts`, `web/src/features/import/ImportScreen.tsx`, `useImport.ts`
- Test: `web/src/core/import/apply.test.ts`, `web/e2e/import.spec.ts`

**Interfaces:**
- Consumes: `buildImportPlan`, `getDb()`.
- Produces: `applyImportPlan(db: PowerSyncDatabase, plan: ImportPlan): Promise<ImportReport>` (une seule `db.writeTransaction`, `INSERT ... ON CONFLICT(id) DO UPDATE`) ; `useImport(): { preview: ImportPlan['report'] | null; error: string | null; load(file: File): Promise<void>; confirm(): Promise<ImportReport> }`.

- [ ] **Step 1: Tests** : appliquer le même plan **deux fois** laisse le même nombre de lignes ; une erreur forcée au milieu de l'insertion annule tout (aucune ligne ne reste) ; e2e : déposer l'export PPS, voir l'aperçu, confirmer, retrouver les séances dans `/strength`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter** ; l'écran affiche l'aperçu (nombres) puis le bouton de confirmation, et le message d'`ImportError` en cas d'échec.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): import JSON atomique et idempotent`.

### Task 11: Catalogue d'exercices, « Mon matériel » et profil

**Files:**
- Create: `web/src/features/profile/` (`ProfileScreen.tsx`, `useProfile.ts`, `EquipmentScreen.tsx`, `useEquipment.ts`), `web/src/features/strength/catalog/` (`CatalogScreen.tsx`, `useCatalog.ts`)
- Test: `web/src/features/profile/useEquipment.test.ts`, `useCatalog.test.ts`

**Interfaces:**
- Consumes: dépôts `exercises` et `settings` (tâche 6), types d'inventaire (tâche 7).
- Produces: `useEquipment(): { inventaire: EquipmentInventaire; setHalteres(c: HalteresConfig): Promise<void>; setBarre(c: DisquesConfig): Promise<void>; setKettlebell(c: PlageConfig): Promise<void>; setCable(c: PlageConfig): Promise<void>; setPas(categorie: string, pasKg: number): Promise<void> }` ; `useCatalog(): { exercices: Exercise[]; filtre: { query: string; muscle: MuscleGroup | null; favorisSeulement: boolean }; setFiltre(f): void; toggleFavori(id: string): Promise<void>; creerPersonnalise(e: NewExercise): Promise<void> }` ; `MuscleGroup` = les 16 groupes (PECTORAUX, DOS, EPAULES, BICEPS, TRICEPS, QUADRICEPS, ISCHIO, FESSIERS, MOLLETS, ABDOMINAUX, TRAPEZES, LOMBAIRES, ADDUCTEURS, OBLIQUES, plus les groupes « autres » du catalogue Android).

- [ ] **Step 1: Tests** : la recherche normalise accents et casse (`normalizeSearch` reprend le comportement de `core/common`) ; filtre par muscle ; `toggleFavori` persiste ; `setBarre` met à jour `user_settings.equipment_json` et `useEquipment().inventaire` reflète la valeur ; un inventaire jamais renseigné renvoie un `EquipmentInventaire` vide valide.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter** ; le catalogue de base est amorcé au premier import depuis `ExerciseCatalogExportSchema`. Le profil règle variante panda, mode sombre, export/import.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): catalogue, matériel et profil`.

### Task 12: Liste, création et affectation des séances

**Files:**
- Create: `web/src/features/strength/` (`SeanceListScreen.tsx`, `useSeanceList.ts`, `SeanceEditScreen.tsx`, `useSeanceEdit.ts`, `AssignDialog.tsx`)
- Test: `useSeanceList.test.ts`, `useSeanceEdit.test.ts`

**Interfaces:**
- Consumes: `listSeanceTemplates`, `getSeanceTree` (tâche 6).
- Produces: `useSeanceList(): { seances: Seance[]; archiver(id: string): Promise<void>; assigner(seanceId: string, dateIso: string): Promise<string> }` (renvoie l'id de l'instance créée) ; `useSeanceEdit(seanceId: string | null): { draft: SeanceDraft; ajouterBloc(); ajouterExercice(blocId: string, exerciseId: string); deplacer(exerciceId: string, versPosition: number); enregistrer(): Promise<string> }`.

- [ ] **Step 1: Tests** : `enregistrer` renumérote `position` de 0 à n-1 d'après l'ordre du draft (et non l'index de liste, piège connu) ; `archiver` retire la séance de la liste sans la supprimer ; `assigner` crée une `instances_seance` à la date donnée ; le bouton 📅 n'est rendu que par `SeanceListScreen`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter**. **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): liste, édition et affectation des séances`.

### Task 13: Copie template → instance

**Files:**
- Modify: `web/src/core/db/repos/instances.ts`
- Test: `web/src/core/db/repos/instances.test.ts`

**Interfaces:**
- Produces: `copyTemplateToInstance(db, instanceId: string): Promise<void>` (copie blocs et exercices du template avec `instance_seance_id = instanceId`, `bloc_source_id` / `exercice_source_id` renseignés, ids = `deterministicId(instanceId, idSource)` ; lit uniquement les lignes `instance_seance_id IS NULL`).

- [ ] **Step 1: Tests** : après deux appels, le nombre de lignes d'instance est identique à celui du template ; les lignes du template sont intactes ; **simuler deux appareils** (deux appels sur deux bases distinctes puis fusion des lignes) ne produit aucun doublon, car les ids coïncident ; modifier le template après la copie ne change pas l'instance.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter**. **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): copie template vers instance idempotente`.

### Task 14: Exécution d'une séance (hors ligne, chrono, reprise)

**Files:**
- Create: `web/src/features/strength/execute/` (`ExecuteScreen.tsx`, `useExecute.ts`, `sessionClock.ts`, `useWakeLock.ts`)
- Test: `sessionClock.test.ts`, `useExecute.test.ts`, `web/e2e/strength-flow.spec.ts`

**Interfaces:**
- Consumes: `copyTemplateToInstance`, `getSeanceTree`, dépôt `series`.
- Produces: `sessionClock`: `startedAtMs`, `pauses: { fromMs: number; toMs: number | null }[]`, `elapsedMs(clock, nowMs: number): number` (pur) ; `useExecute(instanceId: string): { exercices: ExerciceVue[]; elapsedMs: number; validerSerie(exerciceId: string, s: { reps: number; chargeKg: number | null; rpe: number | null }): Promise<void>; corrigerSerie(serieId: string, s: Partial<...>): Promise<void>; pause(): Promise<void>; reprendre(): Promise<void>; terminer(): Promise<void> }`. L'horloge est stockée dans `instances_seance` (`started_at`, `paused_json`) pour survivre au rechargement.

- [ ] **Step 1: Tests** : `elapsedMs` exclut les pauses et gère une pause encore ouverte ; `validerSerie` écrit en base **immédiatement** (relire la base sans l'état React donne la série) ; **recharger le hook** après des séries saisies et un chrono lancé restitue séries et temps écoulé (Review Focus 4) ; deux `validerSerie` sur le même exercice créent deux lignes à UUID distincts ; `useWakeLock` ne plante pas quand `navigator.wakeLock` est absent ; e2e hors ligne : saisir 3 séries réseau coupé, recharger la page, les retrouver, rétablir le réseau, les voir sur un second contexte.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter** (migration SQL `0003_instance_clock.sql` ajoutant `started_at timestamptz`, `paused_json text` à `instances_seance`, et la même évolution dans `schema.ts`).
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): exécution de séance hors ligne avec reprise`.

### Task 15: Rapport et récap de progression

**Files:**
- Create: `web/src/features/strength/report/` (`ReportScreen.tsx`, `useReport.ts`, `ProgressionRecapDialog.tsx`), `web/src/core/db/repos/objectifs.ts`
- Test: `useReport.test.ts`, `objectifs.test.ts`

**Interfaces:**
- Consumes: `evaluerExercice`, `requiresValidation`, `chargesAtteignablesPourEquipement`, `useEquipment`.
- Produces: `useReport(instanceId: string): { resume: { tonnageKg: number; seriesTotal: number; dureeSec: number }; propositions: { exerciceId: string; proposition: PropositionProgression; aValider: boolean }[]; accepter(exerciceId: string): Promise<void>; refuser(exerciceId: string): Promise<void>; ajuster(exerciceId: string, chargeKg: number): Promise<void> }` ; `getObjectif(db, seanceId, exerciseId)` / `saveObjectif(db, o: ObjectifProgression)`.

- [ ] **Step 1: Tests** : séries `DURATION` exclues de `tonnageKg` ; un deload (même avec statut `ECHEC`) apparaît avec `aValider = true` et **n'écrit rien** dans `objectifs_progression` tant que `accepter` n'est pas appelé ; `refuser` laisse l'objectif intact ; `ajuster` écrit la charge choisie ; sans inventaire, l'incrément retombe sur le pas simple (Review Focus 5).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter**. **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): rapport de séance et progression proposée`.

### Task 16: Calendrier

**Files:**
- Create: `web/src/features/calendar/` (`CalendarScreen.tsx`, `useCalendar.ts`)
- Test: `useCalendar.test.ts`

**Interfaces:**
- Produces: `useCalendar(mois: { year: number; month: number }): { jours: JourVue[]; prochaines: InstanceVue[]; deplacer(instanceId: string, dateIso: string): Promise<void>; setFiltre(f: { statut: 'toutes' | 'planifiees' | 'terminees' }): void }`.

- [ ] **Step 1: Tests** : une instance apparaît le jour de sa `date` ; `prochaines` est triée par date croissante et exclut les terminées et supprimées ; **base vide** → `jours` sans événement et `prochaines` vide (Review Focus 5) ; `deplacer` met à jour `date`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter**. **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): calendrier`.

### Task 17: Statistiques et heatmap

**Files:**
- Create: `web/src/features/stats/` (`StatsScreen.tsx`, `useStats.ts`, `statsQueries.ts`, `MuscleHeatmap.tsx`, `heatmapZones.ts`)
- Test: `statsQueries.test.ts`, `useStats.test.ts`

**Interfaces:**
- Produces: `tonnagePeriode(db, from: string, to: string): Promise<number>` ; `volumeParMuscle(db, from, to): Promise<Record<MuscleGroup, number>>` ; `historiqueExercice(db, exerciseId: string): Promise<{ dateIso: string; maxChargeKg: number; reps: number }[]>` ; `HEATMAP_ZONES: Record<MuscleGroup, { vue: 'face' | 'dos' | 'liste'; svgPath: string | null }>` (les groupes sans zone visible, ex. ADDUCTEURS et OBLIQUES, ont `vue: 'liste'`).

- [ ] **Step 1: Tests** (SQLite en mémoire) : une instance planifiée en septembre mais terminée en octobre compte en septembre ; les séries `DURATION` valent 0 en tonnage ; dans une même série `(exercice, numero_serie)` en doublon (deux appareils), la ligne la plus récente seule est comptée ; **aucune donnée** → 0 et `{}` sans exception ; chaque `MuscleGroup` figure dans `HEATMAP_ZONES`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implémenter** ; la heatmap superpose un calque SVG par zone sur `11_Heatmaps` et colore selon le volume ; les groupes `liste` s'affichent en barres sous la figure.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(web): statistiques et heatmap musculaire`.

### Task 18: Pipeline d'images, panda par variante et onboarding

**Files:**
- Create: `web/scripts/build-images.mjs`, `web/src/core/images/pandaImage.ts`, `manifest.generated.ts` (généré), `web/src/features/onboarding/`
- Test: `web/src/core/images/pandaImage.test.ts`

**Interfaces:**
- Produces: `pandaImage(nom: PandaImageName, variant: 'male' | 'female', taille?: 'sm' | 'lg'): { src: string; srcSet: string }` ; `PandaImageName` = union générée depuis le manifeste (`joy`, `victory`, `tired`, `injury`, `motivation`, `musculation`, pose par exercice, fonds, onboarding_01 à 05).

- [ ] **Step 1: Test** : chaque nom du manifeste renvoie un `src` `.webp` existant dans `web/public/panda/` ; un nom inconnu échoue à la compilation (test de type) ; le script est **idempotent** (deux exécutions, même sortie).
- [ ] **Step 2: Run** → FAIL. **Step 3: Script** : lit le sous-ensemble de `assets/` (`09_UI_Formats`, `02_`/`03_Emotions`, `07A_Poses`, `05_`/`06_Sports` musculation, `10_Backgrounds`, `11_Heatmaps`), produit des WebP en deux tailles dans `web/public/panda/`, écrit le manifeste. Les originaux ne sont pas copiés dans `web/`. Le précache du service worker se limite aux icônes et au splash.
- [ ] **Step 4: Intégrer** les images dans accueil, exécution, rapport, calendrier vide et onboarding.
- [ ] **Step 5: Run** tests et `npm run build` → PASS, taille du dossier `dist` < 15 Mo hors images chargées à la demande. **Step 6: Commit** `feat(web): pipeline d'images WebP et onboarding`.

### Task 19: Durcissement, déploiement et bascule

**Files:**
- Modify: `.github/workflows/web-ci.yml` ; Create: `web/README.md`, `web/e2e/rls-live.spec.ts`
- Test: `web/e2e/` complet

- [ ] **Step 1: Vérifications** : e2e du parcours complet (import → créer → affecter → exécuter hors ligne → rapport → stats) ; audit Lighthouse PWA et accessibilité sur mobile (score ≥ 90, cibles tactiles ≥ 44 px, focus visible) ; test `rls-live.spec.ts` avec un second compte qui ne voit rien.
- [ ] **Step 2: Déploiement** : connecter Cloudflare Pages (prérequis manuel), variables d'environnement côté Cloudflare, vérifier le fallback SPA et l'installation PWA sur téléphone.
- [ ] **Step 3: Sauvegarde** : bouton d'export JSON des données depuis le profil (réutilise le format v3.2) pour ne pas dépendre uniquement des services tiers ; documenter la région d'hébergement Supabase et PowerSync dans `web/README.md`.
- [ ] **Step 4: Run** `npm run lint && npm run typecheck && npm run test && npm run build && npx playwright test` → tout passe.
- [ ] **Step 5: Commit** `feat(web): durcissement, déploiement et sauvegarde`.
