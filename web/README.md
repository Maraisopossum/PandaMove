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
7. `supabase/migrations/0007_nom_instance_note_exercice.sql` : colonnes `instances_seance.nom` (renommer une séance jouée sans toucher au modèle) et `exercices_seance.notes` (note par exercice). Idempotente, sans défaut ni réécriture de ligne.

À propos de 0006 :

- **Exécuter 0006 AVANT de fusionner ou de pousser sur la branche de production** : Cloudflare Pages déploie à chaque push, et le nouveau client écrit `series_realisees.validated_at`. Sans 0006, Supabase répond PGRST204 (colonne inconnue) ; ce code est réessayé sans fin et, comme les envois partent dans l'ordre, **toute la file d'envoi de chaque appareil se bloque** (toutes tables), sans perte de données, jusqu'à la migration. Garde-fou du client : sur PGRST204 visant `validated_at`, il renvoie la ligne sans cette colonne (avertissement dans la console) ; la file avance, mais ces séries n'ont pas d'ancre de repos côté serveur. Ne pas compter sur ce repli.
- Elle retire tout droit au rôle `anon` et le DELETE physique au rôle `authenticated` (la suppression est logique, par `deleted_at`). Le rôle de réplication de PowerSync (`powersync_role` ou `postgres`) n'est pas touché.
- Elle s'interrompt sans rien modifier si des doublons empêchent la création des index uniques (`user_settings` vivantes en double pour un même utilisateur, ou blocs d'instance en double). Le message d'erreur donne la requête qui les repère.
- Elle est rejouable sans erreur.

À propos de 0007 : exécutez-la **avant de pousser** (comme 0006). Sans elle, Supabase répond PGRST204 sur `nom` / `notes` ; le client renvoie alors la ligne sans cette colonne (avertissement dans la console) pour ne pas bloquer la file d'envoi, mais le nom propre d'une séance jouée et les notes d'exercice ne sont pas synchronisés tant que la migration manque.

Authentification : ajouter l'origine du site (locale et Cloudflare) dans **Authentication → URL Configuration** pour les liens magiques.

## PowerSync

- **Connexion à la base** : rôle de réplication avec `replication` et `bypassrls`, `select` sur les tables de `public`, publication `powersync` (voir l'en-tête de `dev/docker-compose.powersync.yml`).
- **Client Auth** : activer l'authentification Supabase et ajouter l'audience **`authenticated`**. Sans elle, la connexion échoue (erreur `PSYNC_S2105`).
- **Sync Streams** : coller le contenu de `powersync/sync-rules.yaml` (format Sync Streams, `edition: 3`) dans l'éditeur du tableau de bord, puis déployer. Chaque utilisateur ne reçoit que ses lignes (`user_id = auth.user_id()`).

## Régions d'hébergement

À noter ici une fois vérifiées dans les tableaux de bord (données d'entraînement personnelles) :

- Supabase : région du projet = _à compléter_ (Project Settings → General)
- PowerSync : région de l'instance = _à compléter_

## Déploiement sur Cloudflare (Workers avec ressources statiques)

Cloudflare propose maintenant « Create application » avec Git (Workers Builds). `web/wrangler.jsonc` déclare le dossier `dist` comme ressources statiques et renvoie `index.html` pour toute URL inconnue (une URL profonde rechargée, ex. `/strength/catalog`, sert l'application au lieu d'une 404).

Étapes manuelles, dans le tableau de bord Cloudflare :

0. **Avant le premier push qui déploie ce client** : migrations 0001 à 0007 exécutées dans Supabase (voir « Supabase » ; sinon la file d'envoi des appareils se bloque).
1. **Workers & Pages → Create application → Import a repository**, choisir le dépôt, nom du projet `pandamove`.
2. Réglages de build :
   - répertoire racine (Advanced settings → Root directory) : `web`
   - commande de build : `npm run build`
   - commande de déploiement : `npx wrangler deploy` (valeur par défaut ; lit `wrangler.jsonc`)
3. **Variables de build** (Settings → Build → Variables and secrets, côté *build*, pas seulement côté Worker) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_POWERSYNC_URL`, et `NODE_VERSION` = `22`. Elles sont intégrées au build : relancer un déploiement après toute modification.
4. **Branche de production** (Settings → Build → Branch control) : la branche qui contient `web/wrangler.jsonc` (avant la fusion : `feat/pandamove-web-phase1`).
5. Ajouter l'URL Cloudflare (`https://pandamove.<compte>.workers.dev` ou le domaine) dans Supabase Auth (URL Configuration).
6. Vérifier sur téléphone : ouverture, connexion, installation (« Ajouter à l'écran d'accueil »), puis rechargement en mode avion.

Alternative Cloudflare Pages : build `npm run build`, sortie `dist`, répertoire racine `web`, et un fichier `public/_redirects` contenant `/* /index.html 200`.

## Tests de bout en bout

Les tests Playwright (`e2e/*.spec.ts`) visent un vrai Supabase et un vrai PowerSync ; ils ne tournent pas en CI (pas de Docker ni de comptes dans GitHub Actions). Lancement local, navigateur Playwright installé une fois (`npx playwright install chromium`) :

```bash
cd web
E2E_EMAIL=… E2E_PASSWORD=… E2E_EMAIL2=… E2E_PASSWORD2=… E2E_REQUIRED=1 npm run test:e2e
```

- Playwright sert le **build de production** (`npm run build` puis `npm run preview -- --port 4173 --strictPort`, http://localhost:4173) : le rechargement hors ligne exige le service worker, absent du serveur de dev. `web/.env.local` est lu par le build. Le parcours attend que le service worker contrôle la page avant de couper le réseau. Un serveur déjà lancé sur 4173 est réutilisé : le relancer après une modification du code.
- Sans les variables, chaque test est **sauté** avec la liste des variables manquantes ; avec `E2E_REQUIRED=1`, il **échoue** à la place (à utiliser avant une bascule).
- `rls-live.spec.ts` demande deux comptes de test distincts : le second ne doit voir ni modifier aucune ligne du premier, et le rôle anonyme doit être refusé (migration 0006 requise).
- Les comptes de test se créent dans Supabase (Authentication → Users). Ne jamais écrire leurs identifiants dans un fichier versionné.
- Développement entièrement local (facultatif, non validé) : `supabase start` puis `dev/docker-compose.powersync.yml` (images épinglées).

## Circuit automatique et minuteur d'exercice

Dans l'écran d'exécution d'une séance : un bloc **Circuit** (au moins un exercice en durée) propose « Démarrer le circuit » ; un exercice en durée hors circuit propose « Démarrer le minuteur ». Décompte 3-2-1, minuteur, série enregistrée automatiquement, repos entre exercices et en fin de tour. Réglages du circuit (tours, repos, durées) : édition de la séance. L'état du circuit n'est pas conservé au rechargement de la page ; les séries déjà enregistrées le restent.

**Retours** (réglages « Son », « Vibration », « Voix » dans l'encart de lancement et dans Profil → Séance, mémorisés par appareil dans `localStorage`, clé `pandamove.circuit.reglages`) :
- **Son** (activé par défaut) : bips comme sur Android, via Web Audio. Débloqué par le clic de lancement.
- **Vibration** (activée par défaut) : court au départ et chaque seconde des 5 dernières, long à la fin d'un exercice, double au repos et à la fin du circuit. `navigator.vibrate` : Chrome et Firefox sous Android ; **absente sur iOS Safari** (et sur ordinateur), sans effet ni erreur.
- **Voix** (désactivée par défaut, pour ne pas doubler un lecteur d'écran) : `speechSynthesis` en fr-FR, « Prochain exercice : … », « Allez ! », « Repos », « Circuit terminé », et compte à rebours 3-2-1 parlé en option. Disponibilité et voix françaises variables selon l'appareil ; silencieux si absente.
- Pendant le circuit l'écran est gardé allumé (Screen Wake Lock : Chrome, Edge, Safari 16.4+). Android ne vibre ni ne parle : ces deux retours sont une adaptation web.

## Outils de l'écran d'exécution

- **Repos** : le badge « Repos : mm:ss » ouvre un menu (allonger / écourter de 30 s, arrêter). La colonne « Repos » du tableau est saisissable : la durée saisie remplace celle de l'exercice pour le repos qui suit la validation. **Minuteur** : préréglages (30 s à 5 min), ± 5 s. Tout est basé sur des horodatages ; les réglages (+30 s, arrêt, minuteur manuel) sont gardés par séance dans `localStorage` (clé `pandamove.repos.<id de la séance>`) : un rechargement restitue le décompte.
- **Disques** : calculateur barre / haltère chargeable avec les disques de « Mon matériel » (algorithme glouton de l'Android, charge atteignable la plus proche sinon). **Montée en charge** : paliers d'échauffement (protocole débutant / standard / lourd) arrondis sur le matériel déclaré, à cocher dans l'ordre ; comme sur Android ce sont des paliers éphémères, ils ne créent pas de séries.
- **Note par exercice** : enregistrée à la sortie du champ dans `exercices_seance.notes` (migration 0007), sur la ligne de la séance jouée uniquement ; elle figure au rapport (détail de l'exercice), dans le résumé copié et dans l'export HTML / PNG. Sur Android elle n'est qu'en mémoire (`exerciceNotesLocal`) : c'est une amélioration web. Le commentaire de séance, lui, est enregistré avec l'instance.
- **Bandeau de progression** : pour un exercice en progression, objectif de la prochaine fois et séries qui atteignent déjà la cible. À l'ouverture d'une séance non terminée, charge et reps cibles sont alignées sur l'objectif de progression courant (comme l'Android).
- **Menu ⋮ de la séance** : « Modifier le nom » (renomme LA SÉANCE JOUÉE dans `instances_seance.nom`, migration 0007 ; l'Android renomme le modèle, ce qui viole l'isolation template / instance. Nom vide = nom de la séance type ; le nom propre s'affiche partout : exécution, rapport, listes, calendrier, reprise, export / import), « Modifier les exercices » (éditeur de séance appliqué à CETTE séance seulement, jamais au modèle ; retirer un exercice déjà travaillé demande confirmation et supprime ses séries) et « Supprimer la séance » (suppression logique avec confirmation).
- **Quitter l'exécution** : retour du navigateur, menu ou lien → dialogue de l'Android « Quitter la séance ? » : « Rester ici », « Aller dans le menu » (la séance reste en cours) ou « Quitter sans enregistrer » quand aucune série n'est validée (la séance redevient programmée), « Annuler la séance » (suppression logique de la séance jouée après confirmation, même vide ; l'Android remet seulement les séries à zéro). Pas de dialogue quand tout est déjà validé ni pour une séance terminée. Un seul bloqueur de navigation à la fois est possible dans le routeur : l'écran de correction a le sien.
- **Corriger une séance terminée** : bouton « Corriger la séance » du rapport (icône Modifier de l'Android) → `/strength/instance/:id/correct`. Séries validables, annulables, ajout / retrait ; enregistrement immédiat ; l'horloge et l'état « terminée » ne changent pas, la progression n'est pas ré-évaluée (le récap du rapport reste celui de la fin de séance). Sortie après modification : « Retourner au rapport ? ».
- **Bips de fin de repos** : un bip discret à chaque seconde des 5 dernières secondes du repos (réglage « Son » commun avec le circuit, débloqué au premier appui sur la page ; muet pendant un circuit, qui sonne lui-même).
- **Séance en cours** : le titre de l'onglet affiche chrono et repos, l'écran reste allumé (Wake Lock) et un bandeau « Reprendre » apparaît sur les autres écrans pour une séance démarrée depuis moins de 24 h et non terminée.

## Listes de séances et prise en main

- **Vocabulaire** : « séance type » (le modèle réutilisable), « séance programmée » (à faire, planifiée ou en cours), « séance terminée ». Le menu du module s'appelle « Renforcement », comme sur Android.
- **Sélection multiple** (Séances types, programmées, terminées) : bouton « Sélectionner » ou appui long (500 ms) sur une carte ; case par carte, barre « N sélectionnés » avec « Supprimer » (Android : la corbeille est la seule action groupée, pas de tri ni de favoris). Règle de l'Android : une séance type qui a des séances jouées est ARCHIVÉE (historique gardé), sinon supprimée ; une séance archivée est purgée pour de bon avec ses séances jouées. Suppressions logiques. L'écran Renforcement (`/strength`) regroupe, comme l'Android, les sections Séances types, programmées, terminées (5 puis « Voir les N autres ») et archivées ; une même sélection peut porter sur toutes les sections (types et séances jouées mélangés). Les entrées « Séances programmées » et « Séances terminées » du menu ouvrent les vues complètes de ces deux sections.
- **Pour commencer** : carte à trois étapes (importer l'export Android, ajouter le catalogue de base, créer sa première séance) sur l'accueil (l'écran Renforcement vide n'a qu'un bouton principal, « Créer ma première séance »). Elle se déduit des données (aucune séance type ni séance jouée), se masque à la main (`localStorage`, clé `pandamove.demarrage.masque`) et disparaît dès que la première séance existe.
- **Couleurs des groupes musculaires** : les couleurs de l'Android servent de repère (liseré, teinte de la puce choisie) dans le sélecteur d'exercices ; le texte garde la couleur du thème (contrastes AA vérifiés).
- **Export du rapport** : texte copiable, fichier HTML autonome, image PNG (dessinée sur un canvas, sans bibliothèque), partage natif.

## Sauvegarde

Les données vivent dans Supabase et dans la base locale du navigateur. Pour ne pas dépendre seulement de ces services, faire régulièrement une sauvegarde locale.

**Exporter** : Profil → Sauvegarde → « Exporter mes données ». Le navigateur télécharge `pandamove-export-AAAA-MM-JJ.json` (rien n'est envoyé ailleurs). Ranger ce fichier sur l'appareil ou un support personnel ; il contient tout l'historique d'entraînement, ne pas le déposer dans un dépôt ni un service partagé.

Contenu : export « PandaMoveExport » v3.2, le format de l'application Android, limité au renforcement (séances, séances jouées avec blocs, exercices et séries, exercices du catalogue, objectifs de progression, « Mon matériel »). Seules les lignes non supprimées sont exportées, sauf ce qui porte l'historique : une séance supprimée avec « Garder l'historique » (exportée archivée, sans blocs ni exercices) et un exercice supprimé encore utilisé par une séance. Les identifiants numériques du format sont dérivés des UUID de la base web (stables d'un export à l'autre). Chaque élément garde aussi son UUID et les champs propres au web (`uuid`, `isArchived`, `deletedAt`, `progressionJson`, `startedAt`, `pausedJson`, `validatedAt`, `updatedAt`, `nombreSeriesCible`, `isFavorite`, `isBodyweight`, et, seulement quand ils existent, `nom` d'une séance jouée renommée et `notes` d'un exercice), et le fichier porte l'identifiant du compte (`webUserId`).

**Réimporter** : Profil → « Importer des données », choisir le fichier, vérifier l'aperçu puis confirmer.

- **Dans le même compte** (y compris sur un appareil effacé) : les UUID du fichier sont repris comme identifiants. Chaque élément du fichier reprend l'état sauvegardé (une séance supprimée par erreur revient), sans doublon. Les éléments créés après la sauvegarde sont gardés ; si le fichier apporte les lignes d'une séance jouée que vous avez rouverte et copiée ensuite, la copie locale du même exercice est remplacée par celle du fichier et ses séries y sont rattachées (valeurs intactes, signalé dans le résultat de l'import). Archivage, horloge de séance et heure de validation des séries sont restaurés ; les décisions de progression aussi, sauf pour une séance jouée qui a déjà des décisions sur l'appareil (celles de l'appareil sont gardées).
- **Dans un autre compte**, ou avec un export Android : les UUID ne sont pas repris, l'import calcule ses propres identifiants à partir des numéros du fichier (règles de l'import Android). Le même fichier réimporté deux fois ne crée pas de doublon.
- Les copies d'une séance supprimée avec historique perdent leur lien vers les lignes du modèle (supprimé), sans effet sur l'affichage ni les stats.
- Horodatages : écrits en UTC sans fuseau ; l'application Android, qui les lit en heure locale, les décale du fuseau horaire. Dans l'autre sens, les horodatages d'un export Android (heure locale sans fuseau) sont lus comme UTC par l'app web.
- Import dans l'application Android : non vérifié. Les champs propres au web y sont ignorés, et une séance supprimée gardée pour son historique y apparaîtrait comme une séance ordinaire.

## Limites connues de la version web

- **Dernier écrit gagne entre appareils** : deux appareils qui modifient la même ligne hors ligne gardent la version envoyée en dernier ; l'autre modification est perdue pour cette ligne. Même règle pour le marqueur de progression d'une instance : deux appareils qui décident des exercices différents hors ligne peuvent perdre une des décisions (les objectifs, eux, sont bien écrits).
- **Même série sur deux appareils** : si deux appareils saisissent la même série (même exercice, même numéro) de la même séance en parallèle, une seule des deux est affichée et comptée ; l'autre reste en base, non supprimée.
- **Import de JSON** : « l'export gagne ». Réimporter un export (Android, ou sauvegarde web du même compte) remplace les lignes de même identifiant, y compris des modifications faites depuis sur le web. Si le fichier apporte les lignes d'une séance jouée déjà ouverte sur le web, seules les copies web du même exercice (même ligne du modèle) passent en suppression logique, avant l'écriture des lignes du fichier ; leurs séries sont rattachées aux lignes du fichier, et les exercices ajoutés sur le web restent. Seul le marqueur de progression local d'une instance est conservé.
- **Pas de Docker en CI** : la CI lance lint, typecheck, tests Vitest (schéma et RLS vérifiés sous PGlite) et build. Les e2e, le test pgTAP (`supabase/tests/rls.test.sql`) et la vérification RLS sur le vrai Supabase se lancent à la main.
- **Envois rejetés par le serveur** : une modification refusée définitivement par Supabase (contrainte, droit, donnée invalide) est signalée par un message sous la barre du haut (« Une modification n'a pas pu être envoyée au serveur (code …) »), mais elle n'est pas rejouable : elle disparaît de l'appareil au point de synchro suivant. Le détail (table, opération, identifiant) est dans la console du navigateur.
- **Indicateur de synchro** : une coupure Wi-Fi peut mettre quelques secondes à apparaître ; le mode « Offline » des outils de développement ne coupe pas une connexion de synchro déjà ouverte.

## Différences connues avec Android

Le moteur de progression (`src/core/progression/engine.ts`) reproduit volontairement le Kotlin (`ProgressionEngine.kt`), y compris deux particularités qui ressemblent à des défauts côté Android. Elles ne sont pas corrigées dans le web, pour que les deux applications proposent la même chose.

- **Exercice bilatéral** : les côtés sont repérés par la présence de « G » ou « D » dans les notes de série (sans tenir compte de la casse). Le verdict retenu est le pire des deux côtés, mais à sévérité égale c'est le côté G qui l'emporte. Conséquences : si seul le côté D est noté, l'exercice est « non noté » ; si seul le côté G est noté, son verdict s'applique ; à égalité de sévérité, la valeur atteinte par G pilote la hausse de charge même si D a fait moins.
- **Exercice en durée (`DURATION`) hors système `TEMPORELLE`** : en double progression, la valeur atteinte (des secondes) est comparée à `repsMax` (des répétitions) pour décider du passage au palier de charge.

Vérifier la parité après une modification du moteur Kotlin : `./gradlew :core:database:testDebugUnitTest` (tests `ProgressionEngineTest`, `EquipmentInventoryTest`) côté Android, puis `npm test` côté web (fixtures `test-kotlin` de `engine.json`).

- **Correction d'une séance terminée et progression** : à l'ouverture du rapport d'une séance corrigée, la progression est recalculée depuis l'état d'avant l'évaluation d'origine (le marqueur `progression_json` garde, par exercice, la cible évaluée, l'objectif d'avant / écrit et la proposition ; aucune migration). Proposition inchangée : rien n'est réécrit, la décision de l'utilisateur est gardée. Proposition changée : l'objectif revient à son état d'avant, l'ancienne décision est annulée et l'issue est appliquée (échec simple) ou proposée de nouveau au récap. Si une séance plus récente a déjà fait évoluer l'objectif, il n'est pas touché. Les séances évaluées avant ce lot (marqueur sans base) ne sont pas recalculées. Android : la correction ne recalcule rien, un nouveau « Terminer » ré-évalue par-dessus l'objectif déjà modifié.
- **Fin de repos** : bips 5 à 1 puis signal de fin (Android `restFinishedEvent`) ; l'Android ne navigue pas automatiquement après le repos (la navigation est immédiate à la validation de la série, déjà reprise dans `apresSerie`).
