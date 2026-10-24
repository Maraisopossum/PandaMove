# PandaMove WebApp — Phase 1 (Renforcement) — Design

Date : 2026-10-24
Statut : à relire par l'utilisateur avant le plan d'implémentation

## 1. Objectif et contexte

PandaFit (nom de l'app Android actuelle) est aujourd'hui une application Android (Kotlin, Compose, Room v27, 11 modules).
L'utilisateur veut une **WebApp** pour utiliser PandaFit sur plusieurs appareils (PC, iPhone, Android) avec les **mêmes données synchronisées**.

Critère de succès de la phase 1 : l'utilisateur peut, depuis un navigateur ou la PWA installée, importer ses données existantes, créer et affecter des séances de renforcement, les exécuter **sans réseau** en salle, voir la progression proposée, consulter calendrier et stats, et retrouver le tout identique sur un autre appareil.

### Décisions prises (validées par l'utilisateur)

| Sujet | Décision |
|---|---|
| Motivation | Multi-appareils avec données synchronisées |
| Backend | Supabase (Postgres, Auth, RLS) |
| Front | React + TypeScript + Vite, PWA installable |
| Périmètre phase 1 | Renforcement et ses fondations |
| Hors ligne | Complet (saisie de séance sans réseau, resynchronisation ensuite) |
| Sync | PowerSync + Supabase (SQLite local en WASM) |
| Hébergement PWA | Cloudflare Pages |
| Images | Banque `C:\Users\benoi\Desktop\PandaMoveStudio\assets` (copie déjà présente dans `assets/`) |

### Hypothèses (non contredites à ce stade)

1. L'app Android reste en place et fonctionnelle pendant toute la migration. Le code Kotlin n'est pas supprimé.
2. Utilisateur unique au départ : un compte, des données isolées par RLS, ni partage ni facturation.
3. Reprise des données par import de l'export JSON v3.2 (`PandaMoveExport`).
4. `ProgressionEngine` et `EquipmentInventory` sont portés en TypeScript ; les tests Kotlin servent de spécification.

### Hors périmètre de la phase 1

Running et GPS live, vélo, randonnée, respiration, minuteur autonome, échauffement. Chacun aura son propre spec. Le schéma est conçu pour les accueillir (ex. table `workouts` ajoutée plus tard) mais ne les implémente pas.

## 2. Architecture

```
Navigateur (PWA React + TS + Vite)
  UI React  →  hooks  →  SQLite local (WASM, SDK PowerSync)
                              │  file d'écritures hors ligne
                              ▼
                       Service PowerSync  ⇄  Supabase Postgres (Auth, RLS)
```

- Nouveau dossier `web/` à la racine du dépôt, **indépendant de Gradle** (non ajouté à `settings.gradle.kts`).
- Structure de `web/src/` :
  - `core/db` : schéma local, requêtes (équivalent des DAO), migrations
  - `core/progression` : portage de `ProgressionEngine` et `EquipmentInventory` (fonctions pures, sans React ni base)
  - `core/sync` : connecteur PowerSync, auth Supabase
  - `features/strength | calendar | stats | profile | import` : UI et hooks
- Règle reprise d'Android : **aucune logique dans les composants** ; elle va dans des hooks ou des fonctions pures.
- Un indicateur d'état (en ligne, hors ligne, synchronisation) est affiché dans la barre du haut.

## 3. Modèle de données

Les tables Postgres reprennent les noms Room : `seances`, `blocs_seance`, `exercices_seance`, `instances_seance`, `series_realisees`, `objectifs_progression`, `exercises`, plus `user_settings` (inventaire matériel, variante panda, mode sombre).

Règles communes :
- Clés primaires en **UUID** (évite les collisions d'ID entre appareils hors ligne).
- Colonnes `user_id` (défaut `auth.uid()`), `updated_at`, `deleted_at` (suppression logique : sans elle, un appareil hors ligne ressusciterait une ligne supprimée ailleurs).
- Unités : temps en secondes (entier) en base, millisecondes au runtime (règle du projet).

Règles critiques portées par le schéma ou les requêtes :
- **Isolation template/instance** : template = lignes avec `instance_seance_id IS NULL`. La copie template → instance ne se fait qu'une fois, protégée par une contrainte d'unicité sur (`instance_seance_id`, `exercice_source_id`). Si deux appareils copient hors ligne, la contrainte écarte le doublon à la synchronisation au lieu de dupliquer en silence.
- **Ordre des enfants** : toujours `ORDER BY position`.
- **`RepsType.DURATION`** : `reps_realisees` contient des secondes ; exclu des calculs de tonnage et de reps.
- **Stats** : filtre sur `scheduled_date`, jamais `completed_at`.
- `CHECK` sur `reps_type` et `type_exercice` (COMPOSE_BAS | COMPOSE_HAUT | ISOLATION | MACHINE | PDC).

Migrations : fichiers SQL versionnés dans `web/supabase/migrations/` (CLI Supabase). Les règles de synchronisation PowerSync sont versionnées à côté.

## 4. Sécurité

- **RLS activée sur toutes les tables**, politique `user_id = auth.uid()` en lecture et en écriture.
- Test d'intégration obligatoire : un second compte ne doit voir aucune ligne du premier.
- Seule la clé publique (anon) est dans le front. Aucune clé de service dans le front ni dans le dépôt.
- Les secrets d'hébergement sont dans les variables d'environnement de Cloudflare Pages, pas dans le code.

## 5. Écrans de la phase 1

Navigation : menu latéral (drawer), sans barre du bas, permanent sur grand écran. Barre du haut colorée par module (renforcement violet, stats orange). Les ids passent dans l'URL (`/strength/instance/:id`) et sont lus par le hook de l'écran.

| Écran | Contenu |
|---|---|
| Connexion | Email et mot de passe, ou lien magique ; création de compte au premier lancement |
| Import | Dépôt du JSON v3.2, validation par schéma Zod, aperçu (séances, exercices, séries), confirmation, insertion |
| Accueil | Carte « séance en cours », prochaines séances, panda de la variante choisie |
| Catalogue et « Mon matériel » | 16 groupes musculaires, exercices personnalisés, favoris, inventaire (disques, haltères, kettlebell, câble) |
| Liste des séances | Templates ; icône 📅 d'affectation **uniquement ici** (jamais sur détail ni rapport) |
| Création / édition | Blocs, exercices, progression, type d'exercice, réglage du deload |
| Exécution | Saisie série par série, chrono de repos, panda de motivation |
| Rapport | Résumé et récap de progression ; deload **proposé** (Oui / Non / Ajuster), jamais imposé |
| Calendrier | Vue multi-sport (renforcement seul pour l'instant), filtres, « Prochaines séances » |
| Stats | Tonnage, volume, historique, heatmap musculaire |
| Profil | Variante homme/femme, mode sombre, export/import |

### Séance en cours
- L'état est écrit dans SQLite local à **chaque série validée**, jamais seulement en mémoire.
- Le chrono repose sur des horodatages (début, pauses), pas sur un compteur d'écran : fermer l'onglet ou verrouiller le téléphone ne fait rien perdre.
- Wake lock pour garder l'écran allumé pendant la séance quand le navigateur le permet.

## 6. Hors ligne et conflits

- Toutes les lectures et écritures passent par le SQLite local, y compris l'import. PowerSync pousse la file d'écritures au retour du réseau, sans action de l'utilisateur.
- La PWA est installable et se charge sans réseau (service worker).
- **Règle de conflit** : dernier écrit gagne, par ligne (utilisateur unique).
- **Séries réalisées** : ajout uniquement, un UUID par série, jamais d'écrasement.
- **Copie d'instance** : protégée par la contrainte d'unicité décrite en §3.

## 7. Moteur de progression (portage TypeScript)

- `calculerIncrementQualitatif` : `max(pas_matériel, charge × %cible)`, plafonné à +10 %.
- Snapping exact sur la charge composable : `DisquesConfig` (combinatoire), `PlageConfig` (min/max/pas), `HalteresConfig` (fixes et chargeables). Pas simple pour Machine et legacy.
- Deload (−10 % après échecs répétés) uniquement **proposé**.
- Méthode : lire `ProgressionEngineTest` et `EquipmentInventoryTest`, en extraire les cas (entrées et sorties) dans des **fixtures JSON partagées**, écrire le TypeScript jusqu'à ce que les mêmes cas passent. Les fixtures sont le contrat.
- Attention particulière : arrondis flottants identiques au Kotlin, cas limites (plafond, dépassement du haut de plage, poids de corps) couverts explicitement.

## 8. Images

- Source : `assets/` (114 PNG, 250 Mo, trop lourds pour le web).
- Un script de build produit du **WebP en 2 tailles** et un manifeste TypeScript typé ; les écrans demandent une image par nom logique (`pandaImage('joy', variant)`), jamais par chemin.
- Cache d'avance : icônes PWA et splash seulement. Fonds et onboarding chargés à la demande.
- Sous-ensemble utilisé en phase 1 : `09_UI_Formats` (icône, splash, onboarding, badges), `02_`/`03_Emotions` (victoire, joie, fatigue, blessure), `07A_Poses`, `05_`/`06_Sports` (musculation), `10_Backgrounds`, `11_Heatmaps`.
- Variante homme/femme choisie dans le profil, stockée dans `user_settings`.
- **Heatmap** : les images `11_Heatmaps` ne couvrent que face et dos. Choix retenu : elles servent de fond, et un calque SVG par groupe musculaire est superposé et coloré selon le volume. Les groupes sans zone visible sur ces deux vues (ex. ADDUCTEURS, OBLIQUES) sont regroupés avec la zone voisine ou listés en barres sous la figure. Le tracé des calques est une tâche de l'étape 5.

## 9. Tests

- **Vitest** : moteur de progression, parseur d'import JSON v3.2 (avec les exports réels `support/pandamove_*.json` en fixtures), requêtes de stats (tonnage, `scheduled_date`, `DURATION` exclu).
- **SQL** : isolation template/instance et ordre par `position` sur SQLite en mémoire.
- **RLS** : test d'intégration contre un Supabase local (`supabase start`) avec deux utilisateurs.
- **Playwright** : import → créer une séance → l'affecter → l'exécuter hors ligne → revenir en ligne → vérifier la synchronisation.
- **CI** : workflow GitHub Actions séparé d'Android (`lint`, `tsc`, `vitest`, `build`).

## 10. Hébergement

- PWA : **Cloudflare Pages**, déploiement par push sur `main`.
- Supabase : projet cloud, palier gratuit au départ.
- PowerSync : Cloud, palier gratuit ; l'auto-hébergement reste possible plus tard sans changer le schéma.

## 11. Étapes de livraison

1. Squelette `web/`, auth, schéma Postgres, RLS, sync PowerSync, PWA installable. **Valider ici la chaîne complète écriture hors ligne → synchronisation** avant de continuer.
2. Import JSON v3.2, catalogue, matériel, profil.
3. Séances : liste, création, copie template → instance.
4. Exécution hors ligne, rapport, portage du moteur de progression.
5. Calendrier et stats (avec heatmap).
6. Images WebP, onboarding, durcissement (RLS, accessibilité, mobile), bascule d'usage.

Chaque étape est livrable et testable seule. L'Android reste utilisable jusqu'à la fin.

## 12. Risques

- PowerSync ajoute une dépendance et un langage de règles de synchronisation à apprendre. Mitigation : étape 1 qui prouve la chaîne complète.
- « Dernier écrit gagne » suffit pour un utilisateur seul ; à revoir si des programmes sont un jour partagés.
- Les assets lourds peuvent dégrader le chargement si le pipeline WebP est contourné.
- Les données réelles de l'utilisateur transitent par Supabase et PowerSync (services tiers) : vérifier la région d'hébergement et l'export régulier des données.
