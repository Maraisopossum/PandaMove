# Plan : modules Course et Vélo centrés sur les statistiques de sorties

*   **Date :** 2026-11-06 (version 2, remplace la version « parité Android »)
*   **Statut :** plan à valider, aucun code écrit.
*   **Principe :** on repart de zéro, sans référence à Android. Le but est de **sortir les statistiques de mes sorties** (course et vélo). Le reste (planification, exécution) passe au second plan.

⚠️ Ce plan lève les non-objectifs du [spec cardio-agenda](../specs/2026-11-03-pandamove-seances-cardio-agenda-design.md) (pas de résultats, pas de statistiques, pas de fichiers FIT/GPX). Ce spec sera amendé au lot 0.

## 1. Idée directrice

Aujourd'hui l'application sait **planifier** du cardio (tables `seances_course` et `seances_velo` : titre, consigne, date, validée). Elle ne sait pas ce qui s'est **réellement passé**. Les données réelles (distance, allure, fréquence cardiaque, dénivelé) vivent sur Suunto et MyWoosh.

Le nouveau module part de la **sortie réalisée** :

*   une sortie = une activité réelle, avec ses métriques ;
*   elle peut être reliée à une séance planifiée (« j'ai fait la séance du mardi ») mais n'en dépend pas : une sortie libre est valable ;
*   les statistiques se calculent à partir des sorties, jamais des séances planifiées.

## 2. Comment les données entrent

Pas de GPS en direct (le web ne suit pas l'écran verrouillé, et ce n'est pas le besoin). Trois entrées, par ordre de priorité :

1.  **Import de fichier d'activité** : FIT (Suunto et MyWoosh), puis GPX. C'est la source la plus riche et sans saisie. Des fichiers d'exemple issus de Strava existent dans `support/` (4 FIT + 4 GPX) : utiles pour le format, mais des exports directs Suunto et MyWoosh sont à fournir.
2.  **Saisie manuelle** : date, sport, durée, distance, dénivelé, FC moyenne et max, RPE, notes. Tous champs facultatifs sauf date et sport.
3. **Liaison à une séance planifiée** : à l'import ou à la saisie, proposer la séance de l'agenda du même jour et la valider en même temps.

Anti-doublon : empreinte (sport + début + durée) pour qu'importer deux fois le même fichier ne crée pas deux sorties.

## 3. Statistiques visées

Par sport et tous sports confondus, sur semaine / mois / saison / période libre :

*   **Volume** : distance, durée, dénivelé, nombre de sorties, courbe hebdomadaire (barres).
*   **Allure et vitesse** : moyenne, meilleure, tendance ; allure par kilomètre sur une sortie (fractionnés).
*   **Cardio** : FC moyenne et max, temps par zone (zones configurables dans le profil), dérive cardiaque, ratio allure/FC pour suivre la forme.
*   **Records** : meilleurs temps sur 1 km, 5 km, 10 km, semi, marathon (course) ; plus longue sortie, plus gros dénivelé, meilleure vitesse moyenne (vélo).
*   **Charge** : charge d'entraînement hebdomadaire (durée × intensité), rapport charge aiguë / chronique, pour voir les semaines de trop.
*   **Objectifs** : progression vers Ravensberg, Pi Marathon, Lille-Hardelot (volume cumulé et sorties clés faites contre le programme).
*   **Détail d'une sortie** : résumé, tours / kilomètres, graphiques allure et FC dans le temps, carte du tracé si le fichier en contient (décision §7).
*   **Plan contre réalisé** : séances planifiées faites, faites autrement, sautées.

Règle : ces statistiques sont **séparées** de celles du renforcement (tonnage, heatmap). Le test `statsInchangeesParCardio` reste vrai.

## 4. Modèle de données (proposition)

Une table unique **`sorties`** (le sport est une colonne : les métriques sont les mêmes, et les statistiques croisent les sports). Contrairement aux séances planifiées, il n'y a pas de raison de séparer.

| Colonne | Rôle |
|---|---|
| `id`, `user_id`, `deleted_at` | identité, isolation par compte, suppression logique (comme le reste) |
| `sport` | `course` ou `velo` |
| `debut_at`, `duree_s`, `duree_deplacement_s` | début, durée totale, durée en mouvement |
| `distance_m`, `denivele_pos_m`, `denivele_neg_m` | volume |
| `fc_moy`, `fc_max`, `rpe` | intensité |
| `titre`, `notes`, `source`, `lien` | libellé, texte libre, `suunto` / `mywoosh` / `manuel`, lien vers l'activité |
| `en_salle`, `puissance_moy_w`, `puissance_max_w`, `puissance_norm_w`, `cadence_moy` | home-trainer et capteurs de puissance / cadence |
| `empreinte` | anti-doublon |
| `seance_course_id`, `seance_velo_id` (nullables) | lien optionnel avec la séance planifiée |
| `tours` (JSON) | kilomètres / tours : allure, FC, durée |
| `serie` (JSON, simplifiée) | échantillons réduits (par ex. 1 point / 10 s : temps, distance, FC, altitude) pour les graphiques |
| `trace` (JSON, simplifiée) | polyligne réduite pour la carte |

La trace brute (1 point par seconde) n'est **pas** stockée : trop lourde pour la base locale et la synchro. On garde une version réduite.

Migration `0010_sorties.sql` + schéma local + règles PowerSync + RLS + `coherenceTables.test.ts`, dans l'ordre habituel (migration → publication → règles → client), exécuté par Benoît.

## 5. Lots

### Lot 0 : décisions et amendement du spec
Trancher le §7, amender le spec cardio-agenda.

### Lot 1 : sorties saisies à la main + liste (le socle)
*   Migration `sorties` ; module d'accès aux données `core/db/repos/sorties.ts` (création, modification, suppression logique, lecture par période).
*   Routes `/running` et `/cycling` (ou `/endurance`, §7), entrées dans le tiroir, couleurs du module.
*   Liste des sorties par sport (plus récentes d'abord), formulaire de saisie, détail simple.
*   Liaison optionnelle à une séance planifiée (valide la séance).

### Lot 2 : import FIT (Suunto et MyWoosh)
*   Parseur FIT (dépendance `fit-file-parser`, à valider) : durée, distance, dénivelé, FC, puissance, cadence, tours, séries et trace simplifiées ; détection `en_salle` pour MyWoosh (pas de GPS).
*   Écran d'import : choix de fichier(s), aperçu avant enregistrement, anti-doublon, rattachement à une séance planifiée du jour.
*   Tests sur de vrais exports Suunto et MyWoosh (à fournir ; les 4 FIT Strava de `support/` complètent pour le format).

### Lot 3 : statistiques de base et carte
*   Vues Course et Vélo : volume par semaine et par mois, moyennes, nombre de sorties, période réglable ; vue croisée dans l'écran Stats.
*   Records course (1, 5, 10 km, semi) et vélo (plus longue sortie, plus gros dénivelé, meilleures puissances sur 5, 20, 60 min).
*   Détail d'une sortie : graphiques allure / vitesse, FC, puissance ; **carte du tracé** (MapLibre ou Leaflet, tuiles OSM, licence affichée) quand la sortie a un GPS.

### Lot 4 : import GPX
*   Parseur GPX (`DOMParser`, sans dépendance) pour les exports Suunto qui n'ont pas de FIT ; mêmes métriques hors puissance. Tests avec les 4 GPX de `support/`.

### Lot 5 : statistiques avancées
*   Réglage « FC max » dans le profil ; seuils et zones estimés depuis les sorties, corrigeables ; temps par zone, dérive cardiaque.
*   Charge d'entraînement (à la puissance si présente, sinon à la FC) et rapport aigu / chronique.
*   Progression vers Ravensberg, Pi Marathon, Lille-Hardelot ; plan contre réalisé.

### Lot 6 : sauvegarde et finitions
*   Export / import JSON incluant les sorties, test e2e (compte de test), accessibilité, `README`, `DESIGN.md`. Préparation de la fusion séance planifiée / sortie.

## 6. Découpage technique

```
web/src/features/endurance/   écrans liste, détail, saisie, import, stats (composants communs aux deux sports)
web/src/features/running/     fine couche : réglages et libellés course (allure min/km, records)
web/src/features/cycling/     fine couche : réglages et libellés vélo (vitesse km/h)
web/src/core/fichiers/        gpx.ts, fit.ts, empreinte.ts, simplification de trace
web/src/core/endurance/       calculs purs : allure, Haversine, zones, records, charge (testés à part)
web/src/core/db/repos/        sorties.ts
web/supabase/migrations/      0010_sorties.sql
```

Les calculs de statistiques sont des **fonctions pures** dans `core/endurance/`, testées sans interface, avec les fichiers réels comme jeux d'essai.

## 7. Décisions de Benoît (2026-11-06)

1.  **Sources** : directement Suunto (course, vélo extérieur) et MyWoosh (home-trainer), pas Strava. Suunto exporte en FIT et GPX ; MyWoosh en FIT, sans GPS mais avec puissance et cadence. Conséquence : **le FIT devient indispensable** (lot 2 et non plus lot 4), le GPX reste un bonus.
2.  **Une seule table `sorties`**, sport en colonne.
3.  **Deux entrées de navigation** : « Course » et « Vélo ». Les statistiques croisées restent accessibles depuis l'écran Stats.
4.  **Carte du tracé voulue** : dépendance cartographique (MapLibre ou Leaflet) et tuiles OSM avec mention de licence. Sorties MyWoosh (sans GPS) : pas de carte.
5.  **Zones de FC** : FC max connue (saisie dans le profil), seuils estimés depuis les sorties (meilleure FC moyenne soutenue sur 20 min, plafonds observés), recalculés au fil du temps et corrigeables à la main.
6.  **Sorties home-trainer gérées** : le modèle ajoute `en_salle`, puissance moyenne et max, puissance normalisée, cadence, et la charge se calcule à la puissance quand elle existe (sinon à la FC).
7.  **Fusion à terme** de la séance planifiée et de la sortie : on garde pour l'instant le lien optionnel, mais le schéma est pensé pour migrer (voir §4 : le lien est une simple clé, la sortie porte déjà titre, notes et état).
8.  **Ordre** : recommandation retenue, lot 1 très léger (saisie manuelle), puis import de fichiers.

### Effets sur le plan
*   **Source du fichier** : `source` vaut `suunto` ou `mywoosh` (plus `manuel`) ; l'empreinte reste sport + début + durée.
*   **Ordre des lots révisé** : 1 saisie et liste → 2 **import FIT** (Suunto et MyWoosh) → 3 statistiques de base et carte → 4 import GPX → 5 statistiques avancées (zones estimées, charge, objectifs) → 6 sauvegarde et finitions.
*   **Colonnes ajoutées au §4** : `en_salle` (booléen), `puissance_moy_w`, `puissance_max_w`, `puissance_norm_w`, `cadence_moy`.
*   **Profil** : champ « FC max » (nouveau réglage) et affichage des seuils estimés avec bouton « recalculer ».
*   **Points à valider avant le lot 2** : dépendance de lecture FIT (`fit-file-parser`), et exemples réels de fichiers Suunto et MyWoosh. Les fichiers de `support/` viennent de Strava : il faudra des exports directs de Suunto et de MyWoosh pour écrire les tests.
