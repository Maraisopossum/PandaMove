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

- **Exécuter 0006 AVANT de fusionner ou de pousser sur la branche de production** : Cloudflare Pages déploie à chaque push, et le nouveau client écrit `series_realisees.validated_at`. Sans 0006, Supabase répond PGRST204 (colonne inconnue) ; ce code est réessayé sans fin et, comme les envois partent dans l'ordre, **toute la file d'envoi de chaque appareil se bloque** (toutes tables), sans perte de données, jusqu'à la migration. Garde-fou du client : sur PGRST204 visant `validated_at`, il renvoie la ligne sans cette colonne (avertissement dans la console) ; la file avance, mais ces séries n'ont pas d'ancre de repos côté serveur. Ne pas compter sur ce repli.
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

0. **Avant le premier push qui déploie ce client** : migrations 0001 à 0006 exécutées dans Supabase (voir « Supabase » ; sinon la file d'envoi des appareils se bloque).
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

## Sauvegarde

Les données vivent dans Supabase et dans la base locale du navigateur. Pour ne pas dépendre seulement de ces services, faire régulièrement une sauvegarde locale.

**Exporter** : Profil → Sauvegarde → « Exporter mes données ». Le navigateur télécharge `pandamove-export-AAAA-MM-JJ.json` (rien n'est envoyé ailleurs). Ranger ce fichier sur l'appareil ou un support personnel ; il contient tout l'historique d'entraînement, ne pas le déposer dans un dépôt ni un service partagé.

Contenu : export « PandaMoveExport » v3.2, le format de l'application Android, limité au renforcement (séances, séances jouées avec blocs, exercices et séries, exercices du catalogue, objectifs de progression, « Mon matériel »). Seules les lignes non supprimées sont exportées, sauf ce qui porte l'historique : une séance supprimée avec « Garder l'historique » (exportée archivée, sans blocs ni exercices) et un exercice supprimé encore utilisé par une séance. Les identifiants numériques du format sont dérivés des UUID de la base web (stables d'un export à l'autre). Chaque élément garde aussi son UUID et les champs propres au web (`uuid`, `isArchived`, `deletedAt`, `progressionJson`, `startedAt`, `pausedJson`, `validatedAt`, `updatedAt`, `nombreSeriesCible`, `isFavorite`, `isBodyweight`), et le fichier porte l'identifiant du compte (`webUserId`).

**Réimporter** : Profil → « Importer des données », choisir le fichier, vérifier l'aperçu puis confirmer.

- **Dans le même compte** (y compris sur un appareil effacé) : les UUID du fichier sont repris comme identifiants. Chaque élément du fichier reprend l'état sauvegardé (une séance supprimée par erreur revient), sans doublon ; les éléments créés après la sauvegarde sont gardés. Archivage, horloge de séance, heure de validation des séries et décisions de progression sont restaurés.
- **Dans un autre compte**, ou avec un export Android : les UUID ne sont pas repris, l'import calcule ses propres identifiants à partir des numéros du fichier (règles de l'import Android). Le même fichier réimporté deux fois ne crée pas de doublon.
- Les copies d'une séance supprimée avec historique perdent leur lien vers les lignes du modèle (supprimé), sans effet sur l'affichage ni les stats.
- Horodatages : écrits en UTC sans fuseau ; l'application Android, qui les lit en heure locale, les décale du fuseau horaire. Dans l'autre sens, les horodatages d'un export Android (heure locale sans fuseau) sont lus comme UTC par l'app web.
- Import dans l'application Android : non vérifié. Les champs propres au web y sont ignorés, et une séance supprimée gardée pour son historique y apparaîtrait comme une séance ordinaire.

## Limites connues de la version web

- **Dernier écrit gagne entre appareils** : deux appareils qui modifient la même ligne hors ligne gardent la version envoyée en dernier ; l'autre modification est perdue pour cette ligne. Même règle pour le marqueur de progression d'une instance : deux appareils qui décident des exercices différents hors ligne peuvent perdre une des décisions (les objectifs, eux, sont bien écrits).
- **Même série sur deux appareils** : si deux appareils saisissent la même série (même exercice, même numéro) de la même séance en parallèle, une seule des deux est affichée et comptée ; l'autre reste en base, non supprimée.
- **Import de JSON** : « l'export gagne ». Réimporter un export (Android, ou sauvegarde web du même compte) remplace les lignes de même identifiant, y compris des modifications faites depuis sur le web. Si le fichier apporte les lignes d'une séance jouée déjà ouverte sur le web, les lignes copiées sur le web passent en suppression logique. Seul le marqueur de progression local d'une instance est conservé.
- **Pas de Docker en CI** : la CI lance lint, typecheck, tests Vitest (schéma et RLS vérifiés sous PGlite) et build. Les e2e, le test pgTAP (`supabase/tests/rls.test.sql`) et la vérification RLS sur le vrai Supabase se lancent à la main.
- **Envois rejetés par le serveur** : une modification refusée définitivement par Supabase (contrainte, droit, donnée invalide) est signalée par un message sous la barre du haut (« Une modification n'a pas pu être envoyée au serveur (code …) »), mais elle n'est pas rejouable : elle disparaît de l'appareil au point de synchro suivant. Le détail (table, opération, identifiant) est dans la console du navigateur.
- **Indicateur de synchro** : une coupure Wi-Fi peut mettre quelques secondes à apparaître ; le mode « Offline » des outils de développement ne coupe pas une connexion de synchro déjà ouverte.
