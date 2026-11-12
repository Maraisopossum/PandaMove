# CLAUDE.md

Seule la **WebApp PandaMove** (`web/`) évolue. L'application Android (Kotlin, racine du dépôt) est abandonnée depuis
novembre 2026 : ne plus la modifier ni chercher la parité, sauf demande explicite (voir « Archive Android » en bas).

## Commandes (depuis `web/`)

```bash
npm ci
npm run dev          # http://localhost:5173 (sans service worker)
npm run lint         # ESLint
npm run typecheck    # tsc -b
npm test             # Vitest : unitaires, écrans (jsdom), schéma + RLS sous PGlite
npx vitest run src/features/mobilite          # un dossier
npm run build        # dist/ (PWA, service worker)
npm run preview      # sert dist/ (seul moyen de tester le hors-ligne)
npm run images       # régénère les WebP du panda depuis assets/ (+ src/core/images/manifest.generated.ts)
npm run test:e2e     # Playwright, vrai Supabase/PowerSync, comptes en variables E2E_* (hors CI)
```
CI (`.github/workflows/web-ci.yml`, Node 22) : `lint` → `typecheck` → `test` → `build` sur chaque PR touchant `web/`.
La CI Android (`ci.yml`) ne tourne plus quand seuls `web/` ou `docs/` changent.

## Stack
React 19 + TypeScript + Vite • React Router 8 • PowerSync (SQLite wa-sqlite dans le navigateur, hors ligne d'abord)
• Supabase (Postgres + Auth + RLS) • zod 4 • vite-plugin-pwa (Workbox) • Vitest + Testing Library + PGlite • Playwright.
Déploiement : Cloudflare Workers Builds (`web/wrangler.jsonc`, ressources statiques, repli SPA) à chaque fusion sur `main`.

## Arborescence `web/`
```
src/app/        → AppShell, Drawer, routes.tsx, modules.ts (couleur + pastille par module), app.css (jetons :root)
src/core/db/    → client.ts (getDb/getSupabase), Db.ts (interface testable), schema.ts (schéma PowerSync), repos/ (accès SQL)
src/core/sync/  → connecteur Supabase (envoi de la file, rejets définitifs signalés), état de synchro
src/core/       → auth, catalogue (exercices de base), progression (moteur), import / import-ia / export, images (panda)
src/features/   → home, strength, endurance (course + vélo : sorties, import FIT, cartes), calendar (+ séances cardio
                  planifiées), stats, respiration, mobilite, outils, profile, import, onboarding, demarrage
supabase/migrations/ → 0001 à 0012 (SQL idempotent, appliqué à la main par Benoît)
supabase/tests/      → schema-rls.test.ts (PGlite), rls.test.sql (pgTAP, manuel)
powersync/sync-rules.yaml → Sync Streams (chaque utilisateur ne reçoit que ses lignes)
public/         → icônes, panda/ (WebP générés), mobilite/ (illustrations par exercice, -male/-female), _headers (CSP)
```
Documentation détaillée : `web/README.md` (installation, Supabase, PowerSync, déploiement, comportements),
READMEs de module (`src/features/calendar|respiration/README.md`), specs dans `docs/superpowers/specs/`.

## Patterns
- **Écran = composant de présentation + hook** (`useEcranAccueil`, `useSorties`, `useSeanceMobilite`…) : le hook lit/écrit
  via les `repos/`, le composant ne fait qu'afficher et appeler. Pas de SQL ni de règle métier dans un composant.
- **Accès aux données** : toujours par `src/core/db/repos/*`, qui prennent un `Db` en paramètre (tests sur SQLite en
  mémoire via `src/test/sqliteDb.ts`, `vi.mock('../../core/db/client')`). Pas d'observation réactive : relire après chaque action.
- **Identifiants UUID**, **suppression logique** (`deleted_at`, jamais de DELETE physique : refusé par la RLS),
  `updated_at` maintenu par trigger, horodatages ISO UTC, durées en secondes en base.
- **Isolation modèle / séance jouée (renforcement)** : un modèle a `instance_seance_id IS NULL` ; une séance jouée copie
  ses blocs/exercices une seule fois avec `instance_seance_id` rempli. Toujours filtrer les lignes du modèle avant une
  copie. Les modifications d'une séance jouée ne touchent jamais le modèle.
- **Nouvelle table synchronisée** = 4 endroits à garder alignés : migration Supabase (table + RLS `<table>_proprietaire`,
  droits, publication `powersync`), `schema.ts`, `sync-rules.yaml`, repo. `src/core/db/coherenceTables.test.ts` le vérifie.
- **Migration** : nouveau fichier `00NN_*.sql`, idempotent, couvert par `schema-rls.test.ts`. Elle doit être appliquée
  dans Supabase **avant** la fusion du client qui l'utilise (sinon PGRST204 et file d'envoi bloquée) : le signaler à Benoît.
- **Préférences locales** (`localStorage`, clés `pandamove.*`) : seulement pour des réglages d'appareil, non synchronisés
  (interrupteur des rappels, dernier choix de mobilité, réglages de circuit/RPE…). Tout ce qui est un historique va en base.
- **Images du panda** : `useImagePanda(nom, { userId, taille })` + `PandaIllustration` ; variante male/female du profil
  (`usePandaVariante`), repli sur l'autre variante. Ajouter une image = l'entrée dans `scripts/build-images.mjs` puis `npm run images`.

## Règles
- Code, commentaires, messages et textes d'interface en **français** ; réponses à Benoît en français.
- Design : lire `web/DESIGN.md` (« PandaMove System ») avant tout travail visuel. Jetons dans `:root` de `app.css`,
  couleur de barre par module dans `modules.ts`, contrastes AA testés (`contraste*.test.ts`), cibles tactiles ≥ 44 px.
- `app.css` est un seul gros fichier : ajouter les styles d'un module dans sa section, ne pas recopier de blocs existants.
- PWA : le précache ne contient que le shell (JS/CSS/HTML, polices, icônes, `wa-sqlite-async`) ; les images du panda et
  de la mobilité sont en cache à la première vue. `pwa.config.test.ts` verrouille ces motifs.
- CSP dans `public/_headers` : toute nouvelle origine externe (API, tuiles, polices) doit y être ajoutée.
- Tests avec minuteries : attendre l'état visible (dialogue, ligne en base) plutôt qu'un nombre de tours fixe (CI lente).

## Ce que Claude ne fait pas sans demande explicite
- Fusionner une PR (`gh pr merge` seulement quand Benoît le demande).
- Appliquer une migration ou déployer quoi que ce soit côté Supabase / PowerSync (Benoît le fait à la main).
- Supprimer des branches distantes.
- Toucher `google-services.json`, `app/keystore/`, `gradle/libs.versions.toml`, ou committer `web/.env.local`.

## Archive Android
Code Kotlin (`app/`, `core/`, `feature/`, `build-logic/`), Room schéma v27, documentation `docs/ai/` et `DESIGN.md` racine :
**obsolètes**, conservés pour l'historique. `docs/ai/` décrit l'app Android, pas la WebApp. `AGENTS.md` pointe ici.
Build Android si besoin : `./gradlew assembleDebug` (JDK 17).
