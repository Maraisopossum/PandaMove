# Plan d’implémentation : saisie par unités et badges

Date : 2026-11-24. Maquettes validées sur Claude Design (toile « PandaMove – Nutrition vivante et badges », 14 écrans).
Deux chantiers indépendants, livrés dans l’ordre : **A. unités** puis **B. badges**. Chaque lot est une PR ; une PR qui touche le
schéma porte sa migration, à appliquer dans Supabase **avant** la fusion (sinon PGRST204 et file d’envoi bloquée).

---

## A. Saisie par unités (Nutrition)

### Objectif
On compte comme on mange : à la pièce, au verre, à la cuillère ou au poids. Le calcul reste exact (tout se ramène à une base),
et le journal réaffiche ce qui a été saisi (« 2 œufs »), puis le repropose la fois suivante.

### Modèle
- **Base d’un aliment** : `g` (valeurs pour 100 g) ou `ml` (valeurs pour 100 ml). Jamais de conversion ml ↔ g sans densité.
- **Mesure** : `{ id, libelle, pluriel, quantiteBase }`, par exemple `{ oeuf, « œuf », « œufs », 50 }`, `{ verre, « verre », « verres », 200 }`.
  La première mesure d’un aliment est proposée par défaut ; l’unité de base (g ou ml) est toujours disponible.
- **Mesures communes des liquides** (seulement si base = ml) : verre 200, tasse 250, bol 300, canette 330, cuillère à soupe 15,
  cuillère à café 5.
- **Entrée du journal** : garde `quantite_g` (quantité de base, en g ou en ml, inchangé pour les calculs) et ajoute la saisie
  `quantite_saisie` + `unite_saisie` (id de mesure, ou `g` / `ml`). Entrée ancienne sans saisie : affichée en grammes, comme aujourd’hui.

### Lot A1 : données et calculs (PR 1, migration 0022)
- `web/supabase/migrations/0022_nutrition_unites.sql` (idempotent) :
  - `aliments` : `unite_base text not null default 'g' check (unite_base in ('g','ml'))`, `mesures_json text` (liste JSON).
    Reprise : un aliment qui a `portion_g` + `portion_label` reçoit une mesure équivalente dans `mesures_json`.
  - `repas_entrees` : `quantite_saisie real`, `unite_saisie text` (nulles pour l’existant).
  - Couvert par `supabase/tests/schema-rls.test.ts` (colonnes, contrainte, reprise des portions).
- `web/src/core/db/schema.ts` : nouvelles colonnes (tables déjà synchronisées, `sync-rules.yaml` inchangé : `SELECT *`).
- `web/src/core/nutrition/mesures.ts` (nouveau, fonctions pures) : `mesuresDe(aliment)`, `versBase(qte, mesure)`,
  `depuisBase(qteBase, mesure)`, `libelleQuantite(qte, mesure)` (pluriel, ½ et ¼, ml → L à partir de 1 000), `pasDe(mesure)`
  (½ pour pièces et portions, 10 g, 50 ml), `raccourcisDe(aliment, mesure)` (1 à 4 pièces ; autour de la portion habituelle ; verre, bol, 25 cl).
  Tests unitaires complets (`mesures.test.ts`).
- `web/src/core/nutrition/baseAliments.ts` : chaque aliment courant reçoit sa base (`ml` pour les boissons, le lait, les soupes)
  et ses mesures (œuf, banane, tranche, pot, assiette, cuillère d’huile…). Test : toute mesure > 0, base cohérente avec la catégorie.
- `web/src/core/nutrition/openFoodFacts.ts` : base 100 g ou 100 ml d’après le produit, mesure « portion » depuis `serving_size`
  (« 1 biscuit (12,5 g) » → `biscuit`, 12,5) et mesure « paquet » depuis la contenance. Tests sur des réponses réelles anonymisées.
- `web/src/core/db/repos/nutrition.ts` : lecture et écriture des nouveaux champs, mappers et tests sur SQLite en mémoire.

### Lot A2 : écrans (PR 2, sans migration)
- **Choisir la quantité** (`AjouterAlimentScreen`, logique dans un hook `useQuantiteAliment`) : sélecteur d’unité segmenté,
  stepper au pas de l’unité, nombre saisissable au clavier, équivalence écrite sous le nombre, raccourcis adaptés,
  « Ça fait N kcal » avec la barre de la journée (déjà mangé + ajout + reste) et les macros en direct.
  Changer d’unité conserve la quantité de base. Case « Retenir “2 œufs” pour la prochaine fois ».
- **Ajouter un aliment** : bandeau du repas avec son panda, recherche et scan en tête, « Refaire en un geste »
  (aliments fréquents, ajout en un appui avec la dernière quantité **dans son unité**), favoris avec « + » direct.
- **Mesures d’un aliment** (`AlimentFormScreen`) : base 100 g / 100 ml, liste des mesures (lue sur l’emballage, contenance,
  personnelles), ajout et modification d’une mesure.
- **Journal** et entrées : affichage « 2 œufs · 140 kcal » ; modifier une entrée rouvre l’écran dans l’unité saisie.
- Saisie rapide (valeurs totales) et photo d’assiette (grammes estimés, affichés « environ ») inchangées.
- Tests d’écran (jsdom) : œuf à la pièce, lait au verre, riz au poids, changement d’unité, entrée ancienne en grammes, accessibilité
  (libellés, cibles de 44 px). Contrastes AA vérifiés par les tests existants.

---

## B. Badges (tous les modules)

### Objectif
83 badges en 9 familles (PandaMove, Renforcement, Course, Vélo, Hyrox, Plans et calendrier, Respiration, Mobilité, Nutrition),
calculés sur l’appareil à partir des données déjà enregistrées, illustrés (166 dessins Gemini, garçon et fille).

### Règles (validées)
- Un badge gagné n’est jamais retiré.
- Le sport se compte en **semaines actives** (au moins 3 jours actifs dans la semaine) ; séries quotidiennes seulement pour la
  respiration, la mobilité et le journal. Un jour de grâce par semaine sur ces séries ; une pause (blessure, vacances) les gèle.
- Aucun badge pour manger moins, peser moins ou souffrir plus.
- Une seule célébration par moment ; plusieurs badges gagnés ensemble sont regroupés.
- Les rubans des dessins restent vides : le nom et le seuil sont du texte de l’application.
- Seuils validés, dont le tonnage : 100 t (argent), 500 t (or), 2 000 t (panda).

### Lot B1 : images (PR 3, sans migration)
- Sources : `assets/15_Badges/<variante>_badge_<id>_v1.png` (166 fichiers, déjà produits et contrôlés).
- `web/scripts/build-images.mjs` : nouvelle famille `badges`, sortie `public/badges/<id>-<variante>-{sm,lg}.webp`
  et entrées dans le manifeste (`manifest.generated.ts`), avec texte alternatif.
- PWA : ajouter `badges` au motif du cache à la première vue (`/(panda|mobilite|badges)/`) et mettre à jour `pwa.config.test.ts`.
  Nouveau dossier, donc pas besoin d’incrémenter `images-panda-vN`.
- `useImageBadge(id)` sur le modèle de `usePandaImages` (variante du profil, garçon par défaut).

### Lot B2 : moteur et données (PR 4, migration 0023)
- `web/src/core/badges/catalogue.ts` : les 83 badges (id, module, famille, palier, nom, règle affichée, seuil, mesure utilisée).
- `web/src/core/badges/faits.ts` : un instantané des faits par module, lu par les repos existants
  (séances terminées, tonnage cumulé, records estimés, sorties et distances, dénivelé, simulations et segments Hyrox, jalons et
  séances planifiées réalisées, séances de respiration et de mobilité, journal, eau, objectifs, aliments gardés, scans et photos).
- `web/src/core/badges/moteur.ts` (pur) : `evaluer(faits, catalogue)` → progression de chaque badge (valeur, seuil, part, gagné) ;
  `nouveaux(evaluation, dejaGagnes)`. Calcul des jours actifs, semaines actives, séries avec jour de grâce et pause.
  Tests unitaires par famille, plus des cas limites (semaine à cheval sur deux mois, fuseau, jour de grâce, pause).
- Table synchronisée **`badges_obtenus`** (`web/supabase/migrations/0023_badges.sql`) : `id uuid`, `user_id`, `badge_id text`,
  `valeur real`, `obtenu_at timestamptz`, `vu_at timestamptz` (pour ne fêter qu’une fois, même sur deux appareils), `deleted_at`,
  `updated_at` ; contrainte d’unicité `(user_id, badge_id)` ; RLS `badges_obtenus_proprietaire`, droits, publication `powersync`.
  Les 4 endroits alignés : migration, `schema.ts`, `sync-rules.yaml`, `repos/badges.ts` (vérifié par `coherenceTables.test.ts`).
- Pause des séries : réglage synchronisé dans `user_settings` (période de pause), pas en `localStorage`.
- Les records de course actuels (`recordsSorties.ts`) alimentent les badges « Record battu » sans doublon d’affichage.

### Lot B3 : écrans (PR 5, sans migration)
- `useBadges()` : évalue après chaque action (relire, pas d’observation réactive), enregistre les nouveaux badges, renvoie ceux à fêter.
- **Page Badges** (`/badges`, accès depuis l’Accueil et le Profil) : filtre par module, « Presque à vous » (les plus proches), une
  rangée par famille ; badge gagné en couleur, badge à gagner en gris avec sa barre de progression.
- **Détail d’un badge** : ce qu’il faut faire, où on en est, les paliers de la famille, un bouton pour agir (« Noter un repas »,
  « Lancer une séance »…).
- **Animation d’obtention** : fond du module, le badge tombe et se pose, reflet sur le métal (masqué par la forme du badge),
  éclats, puis titre, texte et barre du prochain palier (environ 2 s). Vibration courte au moment où il se pose
  (`navigator.vibrate`, si disponible). Rien ne bouge avec « réduire les animations ». Regroupement si plusieurs badges.
- **Intégration dans les modules** : rapport de fin de séance de renforcement, fin de sortie, fin de simulation Hyrox, fin de
  respiration et de mobilité, ajout d’un repas ; petit rappel « prochain badge » dans le bandeau de chaque module.
- **Premier lancement** : les badges déjà mérités sont attribués d’un coup et présentés sur un seul écran récapitulatif.
- Tests d’écran : page, filtre, détail, animation (classes et repli sans animation), récapitulatif, intégration dans le rapport.

---

## Ordre, migrations et vérifications
| Lot | Contenu | Migration à appliquer à la main |
|---|---|---|
| A1 | données et calculs des unités | **0022_nutrition_unites** |
| A2 | écrans de saisie | aucune |
| B1 | images des badges | aucune |
| B2 | moteur, catalogue, table des badges | **0023_badges** |
| B3 | écrans et intégration | aucune |

Chaque PR : `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` verts, captures des écrans dans la PR,
fusion seulement sur demande de Benoît. Hors périmètre : recettes et plats composés, badges partagés ou classements.
