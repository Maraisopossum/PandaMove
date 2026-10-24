# PandaMove web

Application web (PWA) de PandaMove : React + TypeScript + Vite, données locales SQLite (PowerSync) synchronisées avec Supabase. Elle fonctionne hors ligne ; les écritures partent vers Supabase au retour du réseau.

## Installation

Prérequis : Node.js 22.13 ou plus récent (voir `engines` dans `package.json`).

```bash
cd web
npm ci
cp .env.example .env.local   # puis renseigner les valeurs (voir plus bas)
npm run dev                  # http://localhost:5173
```

Commandes utiles :

| Commande | Rôle |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | vérification TypeScript (`tsc -b`) |
| `npm test` | tests Vitest (unitaires, écrans, schéma Postgres sous PGlite) |
| `npm run build` | build de production dans `dist/` |
| `npm run preview` | sert `dist/` en local (le service worker et le hors-ligne n'existent qu'en build) |
| `npm run images` | régénère les images WebP du panda depuis `assets/` |
| `npm run test:e2e` | tests Playwright (voir « Tests de bout en bout ») |

## Variables d'environnement

Fichier `web/.env.local` (ignoré par git, ne jamais le committer) :

| Variable | Contenu |
|---|---|
| `VITE_SUPABASE_URL` | URL du projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | clé publique (anon) du projet Supabase |
| `VITE_POWERSYNC_URL` | URL de l'instance PowerSync |

Sans ces variables, l'application affiche « Configuration manquante » au lieu d'une page blanche.

Variables des tests de bout en bout (dans le shell, jamais dans un fichier versionné) : `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_EMAIL2`, `E2E_PASSWORD2`, `E2E_REQUIRED`.

## Supabase

Exécuter les migrations **dans l'ordre**, une seule fois chacune, dans l'éditeur SQL du tableau de bord Supabase :

1. `supabase/migrations/0001_schema.sql` : tables
2. `supabase/migrations/0002_rls.sql` : RLS
3. `supabase/migrations/0003_dark_mode_nullable.sql`
4. `supabase/migrations/0004_instance_clock.sql`
5. `supabase/migrations/0005_instance_progression.sql`
6. `supabase/migrations/0006_durcissement.sql` : droits, politiques RLS, index uniques, colonne `validated_at`

À propos de 0006 :

- Elle doit être exécutée **avant** de déployer une version du client qui écrit `series_realisees.validated_at`. Sinon l'envoi de ces séries est refusé par Supabase et reste en file d'attente sur l'appareil (aucune perte, mais rien n'est synchronisé tant que 0006 n'est pas passée).
- Elle retire tout droit au rôle `anon` et le DELETE physique au rôle `authenticated` (la suppression est logique, par `deleted_at`). Le rôle de réplication de PowerSync (`powersync_role` ou `postgres`) n'est pas touché.
- Elle s'interrompt sans rien modifier si des doublons empêchent la création des index uniques (`user_settings` vivantes en double pour un même utilisateur, ou blocs d'instance en double). Le message d'erreur donne la requête qui les repère.
- Elle est rejouable sans erreur.

Authentification : ajouter l'origine du site (locale et Cloudflare) dans **Authentication → URL Configuration** pour les liens magiques.

## PowerSync

- **Connexion à la base** : rôle de réplication avec `replication` et `bypassrls`, `select` sur les tables de `public`, publication `powersync` (voir l'en-tête de `dev/docker-compose.powersync.yml`).
- **Client Auth** : activer l'authentification Supabase et ajouter l'audience **`authenticated`**. Sans elle, la connexion échoue (erreur `PSYNC_S2105`).
- **Sync Streams** : coller le contenu de `powersync/sync-rules.yaml` (format Sync Streams, `edition: 3`) dans l'éditeur du tableau de bord, puis déployer. Chaque utilisateur ne reçoit que ses lignes (`user_id = auth.user_id()`).

## Régions d'hébergement

À noter ici une fois vérifiées dans les tableaux de bord (données d'entraînement personnelles) :

- Supabase : région du projet = _à compléter_ (Project Settings → General)
- PowerSync : région de l'instance = _à compléter_

## Déploiement sur Cloudflare Pages

Étapes manuelles, dans le tableau de bord Cloudflare :

1. **Workers & Pages → Create → Pages → Connect to Git**, choisir le dépôt.
2. Réglages de build :
   - répertoire racine : `web`
   - commande de build : `npm run build`
   - répertoire de sortie : `dist`
   - variable `NODE_VERSION` = `22` si la version par défaut est plus ancienne
3. **Variables d'environnement** (production et préversions) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POWERSYNC_URL`. Elles sont intégrées au build : relancer un déploiement après toute modification.
4. Fallback SPA : `public/_redirects` (`/* /index.html 200`) est copié dans `dist/` ; une URL profonde (ex. `/strength/instance/…`) rechargée sert l'application au lieu d'une 404.
5. Ajouter l'URL Cloudflare (`https://<projet>.pages.dev` ou le domaine) dans Supabase Auth (URL Configuration).
6. Vérifier sur téléphone : ouverture, connexion, installation (« Ajouter à l'écran d'accueil »), puis rechargement en mode avion.

## Tests de bout en bout

Les tests Playwright (`e2e/*.spec.ts`) visent un vrai Supabase et un vrai PowerSync ; ils ne tournent pas en CI (pas de Docker ni de comptes dans GitHub Actions). Lancement local, navigateur Playwright installé une fois (`npx playwright install chromium`) :

```bash
cd web
E2E_EMAIL=… E2E_PASSWORD=… E2E_EMAIL2=… E2E_PASSWORD2=… E2E_REQUIRED=1 npm run test:e2e
```

- Sans les variables, chaque test est **sauté** avec la liste des variables manquantes ; avec `E2E_REQUIRED=1`, il **échoue** à la place (à utiliser avant une bascule).
- `rls-live.spec.ts` demande deux comptes de test distincts : le second ne doit voir ni modifier aucune ligne du premier, et le rôle anonyme doit être refusé (migration 0006 requise).
- Les comptes de test se créent dans Supabase (Authentication → Users). Ne jamais écrire leurs identifiants dans un fichier versionné.
- Développement entièrement local (facultatif, non validé) : `supabase start` puis `dev/docker-compose.powersync.yml` (images épinglées).

## Limites connues de la version web

- **Dernier écrit gagne entre appareils** : deux appareils qui modifient la même ligne hors ligne gardent la version envoyée en dernier ; l'autre modification est perdue pour cette ligne. Même règle pour le marqueur de progression d'une instance : deux appareils qui décident des exercices différents hors ligne peuvent perdre une des décisions (les objectifs, eux, sont bien écrits).
- **Même série sur deux appareils** : si deux appareils saisissent la même série (même exercice, même numéro) de la même séance en parallèle, une seule des deux est affichée et comptée ; l'autre reste en base, non supprimée.
- **Import de JSON** : « l'export gagne ». Réimporter un export Android remplace les lignes de même identifiant, y compris des modifications faites depuis sur le web. Seul le marqueur de progression local d'une instance est conservé.
- **Pas de Docker en CI** : la CI lance lint, typecheck, tests Vitest (schéma et RLS vérifiés sous PGlite) et build. Les e2e, le test pgTAP (`supabase/tests/rls.test.sql`) et la vérification RLS sur le vrai Supabase se lancent à la main.
- **Indicateur de synchro** : une coupure Wi-Fi peut mettre quelques secondes à apparaître ; le mode « Offline » des outils de développement ne coupe pas une connexion de synchro déjà ouverte.
