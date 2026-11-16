# Audit de concordance entre les modules de la WebApp (2026-11-15)

Périmètre : tous les modules sauf Nutrition (PR 82, auditée à part en fin de document) : Accueil, Renforcement, Course, Vélo, Calendrier, Plans, Hyrox, Statistiques,
Respiration, Mobilité, Outils, Profil, Import, Administration. Base : `main` au commit `c0c7b82`.
Méthode : lecture du code et vérifications mécaniques (scripts d'inventaire sur routes, menu, CSS, schéma, migrations, textes, clés de stockage), puis garde-fous
permanents ajoutés dans `src/app/concordanceModules.test.ts` pour que les règles qui avaient été oubliées ne le soient plus.

## Verdict

Le socle est cohérent : chaque table suit les mêmes conventions (UUID, suppression logique, `updated_at`, RLS `<table>_proprietaire`, 4 endroits alignés et testés), la
suppression de compte et la sauvegarde couvrent toutes les tables, les contrastes des couleurs de module sont testés. Les écarts sont à la **surface**
(navigation, textes, redondances) et dans la **couverture transversale** (ce que l'Accueil, les statistiques et l'export savent des modules récents).

| Dimension | Résultat |
| --- | --- |
| Tables : migration, schéma local, règles de synchro, dépôt | ✅ testé (`coherenceTables.test.ts`, `sync-rules.test.ts`) |
| Suppression de compte : toutes les tables vidées | ✅ testé (`fonctionAdminComptes.test.ts`) |
| Sauvegarde complète : toutes les tables exportées | ✅ désormais testé (garde-fou ajouté) ; ❌ textes obsolètes (corrigés) |
| Menu ↔ routes ↔ barre du haut | ❌ `/admin/*` s'affichait « Accueil » (corrigé), ✅ le reste, désormais testé |
| Pastilles et couleurs de module | ⚠️ Hyrox réutilise l'icône du Renforcement (assumé, testé) |
| Accueil (tuiles, bilan, propositions) | ⚠️ Plans et Hyrox absents des tuiles ; Hyrox absent du bilan |
| Statistiques / charge d'entraînement | ⚠️ les simulations Hyrox n'y entrent pas |
| Export ciblé (« Exporter une partie ») | ⚠️ ni Hyrox, ni plans |
| Écran = composant + hook (CLAUDE.md) | ❌ 13 composants lisent la base directement |
| Style des boutons principaux | ⚠️ 4 familles de couleur |
| Typographie des textes (apostrophe ’) | ❌ environ 80 textes avec ' (corrigés dans l'interface), ⚠️ messages de `core/` restants |
| Redondances Profil / Outils / Statistiques | ⚠️ 2 doublons |
| Documentation | ⚠️ 12 dossiers sur 17 sans README, `CLAUDE.md` en retard |

## Corrigé dans cette PR

1. **Barre du haut des écrans d'administration** : `/admin`, `/admin/comptes`, `/admin/journal`, `/admin/synchro` retombaient sur « Accueil » en violet. Ils affichent maintenant
   « Administration » (gris ardoise `#37474F`, texte blanc ≥ 4,5:1, pastille « clé »). L'administration n'entre toujours pas au menu (accès depuis le Profil).
2. **Textes d'export faux** : « Les sorties et la respiration n'y sont pas encore » (Outils > Mes données) et « toutes vos données de renforcement » (Profil > Sauvegarde)
   ignoraient le complément web (sorties, séances planifiées, respiration, mobilité, plans, Hyrox) que l'export complet contient bel et bien. Les deux textes disent maintenant
   ce qui est exporté et ce qui reste sur l'appareil (poids, objectifs personnels, réglages d'appareil).
3. **Apostrophes** : l'interface mélangeait `'` et `’` (Import, Renforcement, Outils, Statistiques, Calendrier, Profil, Réglages, messages d'erreur). Tous les textes visibles des
   écrans et des hooks utilisent `’`, comme le reste. Les tests sont alignés.
4. **Clé de stockage dupliquée** : `pandamove.mobilite.choix` était écrite deux fois (Mobilité et Profil) ; une seule constante exportée.
5. **Garde-fous permanents** (`src/app/concordanceModules.test.ts`, 7 tests) :
   - chaque entrée et sous-entrée du menu a une route ;
   - toute route appartient à un module (ou à l'administration) : aucune page ne retombe sur « Accueil » ;
   - les pastilles existent ; seul le partage Renforcement/Hyrox est toléré ;
   - deux modules n'ont pas la même couleur de barre ;
   - **toute nouvelle table synchronisée doit entrer dans la sauvegarde** (`TABLES_COMPLEMENT`) ;
   - les durées des tables web s'écrivent `_s` (le `_sec` est réservé aux tables venues d'Android : renforcement, respiration, mobilité).

## Écarts à décider (par priorité)

### Importants : un module ignore l'autre

1. **Hyrox invisible de l'Accueil, des statistiques et de la charge.** Une simulation chronométrée (jusqu'à plus d'une heure d'effort) ne compte ni dans « temps de sport » du
   bilan de la semaine (`home/bilanSemaine.ts` : sorties + renforcement + tonnage), ni dans la charge d'entraînement, ni dans les statistiques d'endurance. Seules les séances
   Hyrox **validées comme sorties** y entrent (par le préfixe « Hyrox · » de l'agenda). *Reco* : compter `hyrox_simulations` terminées dans durée et nombre de séances du bilan,
   et une durée équivalente dans la charge ; décision à prendre sur la pondération (RPE par défaut).
2. **Accueil : 6 tuiles** (`TUILES` : renforcement, course, vélo, mobilité, respiration, calendrier). Plans et Hyrox n'y sont pas, Nutrition non plus. *Reco* : 8 tuiles sur 2×4
   (Plans, Hyrox, Nutrition), ou une rangée « Préparer » (Plans, Hyrox) et une « Au quotidien » (Nutrition, Respiration, Mobilité).
3. **Export ciblé** (`outils/exportCible.ts`) : 5 familles (renforcement, sorties, mobilité, respiration, calendrier). Hyrox (simulations et segments), objectifs de plan et, dès
   la PR 82, le journal nutrition n'y figurent pas, alors que l'export complet les contient. *Reco* : ajouter `hyrox`, `plans`, `nutrition` (journal, eau comprise).
4. **Poids** (`pandamove.poids`, Profil) : stocké **sur l'appareil seulement**, non exporté, non synchronisé. Changer d'appareil le perd, et Nutrition (calculateur d'objectifs) le
   redemande. *Reco* : soit préremplir Nutrition depuis le Profil (une ligne), soit le passer en table synchronisée (donnée de santé : le décider explicitement, la mention
   « elle ne quitte pas l'appareil » de `poids.ts` et du Profil est un choix de confidentialité).

### Importants : règle d'architecture

5. **Écran = composant + hook** (CLAUDE.md) : 13 composants appellent `getDb()` / les dépôts eux-mêmes : Hyrox (`BilanHyroxScreen`, `JourJHyroxScreen`, `ObjectifHyroxScreen`,
   `PlanHyroxScreen`, `StationDetailHyroxScreen`), Plans (`AjusterPlanScreen`, `JalonPlanScreen`, `ObjectifPlanScreen`), Profil (`ObjectifsSection`, `ReglagesAppareilSection`),
   Respiration (`StatsRespirationScreen`), Renforcement (`ExecutionEnFond`, `BilanPlus`). Les modules récents (Hyrox, Plans, Nutrition) sont les plus concernés. Fonctionne, mais
   ces écrans se testent par le rendu complet plutôt que par un hook. *Reco* : extraire un hook par écran au fil des modifications, pas en bloc ; le test d'architecture
   « aucun `getDb` dans un `*Screen.tsx` » peut être ajouté avec une liste d'exceptions qui ne fait que diminuer.

### Moyens

6. **Boutons principaux : 4 familles.** Violet du Renforcement par défaut (Course, Vélo, Calendrier, Statistiques, Profil, Import, Outils, Administration : aucune surcharge), couleur du module pour
   Respiration (teal), Mobilité (framboise), Plans (vert foncé), Hyrox (anthracite, jaune en sombre), Nutrition (émeraude). Le design dit « action au violet du module » : Course et
   Vélo, pourtant verts et bleus, ont des actions violettes. *Reco* : une variable `--couleur-action` posée par module (déjà `--couleur-module` dans le menu) et un seul
   `.bouton--principal` ; supprime 6 surcharges dans `app.css`.
7. **Deux doublons fonctionnels.**
   - Outils > Progression et Statistiques > « Historique d'un exercice » : même courbe, même sélecteur d'exercice, mêmes textes. *Reco* : garder Statistiques, et faire pointer
     « Progression » dessus (ou l'inverse), pour ne maintenir qu'un écran.
   - Profil > Sauvegarde et Outils > Mes données > Sauvegarde : deux boutons d'export complet ; seul le second porte le rappel de sauvegarde et l'import. *Reco* : Profil renvoie
     vers Mes données.
8. **« Objectif » désigne sept choses** : objectifs personnels du Profil (séances/semaine, distance de l'année, mobilité), objectif de progression (renforcement), objectif de plan
   d'endurance, objectif Hyrox, objectif de sortie hebdomadaire (Course/Vélo), objectif quotidien de respiration, et désormais objectifs nutrition. Trois vivent sur
   l'appareil (Profil, Course/Vélo, Respiration), les quatre autres en base (progression, plan, Hyrox, nutrition). *Reco* : au minimum préciser les titres (« Objectifs de la semaine », « Objectif de course », « Objectifs nutrition ») ; à terme, une vue
   « Mes objectifs » qui les rassemble (c'est déjà le rôle de la section du Profil).

### Mineurs

9. **Adresses** : mélange anglais (`strength`, `running`, `cycling`, `breathing`, `mobility`, `calendar`, `profile`, `stats`) et français (`plans`, `hyrox`, `outils`, `nutrition`,
   `admin`, `import`). Les liens existent déjà (rappels, favoris installés) : ne pas renommer. *Règle proposée pour les nouveaux modules* : français, nom court.
10. **Messages de `core/`** (`import-ia`, `import`, `export`, dépôts) : encore des `'` droites. Laissés tels quels : l'aide à l'IA (schéma et consigne) en dépend, et ce sont des
    contrats de format.
11. **Formats de date** : 30 `Intl.DateTimeFormat('fr-FR', …)` répartis dans 10 modules (`jour`, `dateCourte`, `libelleJour`, `formaterDate`…). *Reco* : un module
    `core/common/formatDates.ts` (jour long, jour court, jour de semaine), repris au fil de l'eau.
12. **Cartes** : une douzaine de familles de classes `__carte` / `__section` dans `app.css` (9 000 lignes), toutes quasi identiques (bordure, rayon, ombre). Hyrox et Nutrition réutilisent
    `plans__carte` ; *Reco* : une classe `.carte` commune, les familles actuelles lui deviennent des alias puis disparaissent.
13. **Réglages d'appareil** : le bouton « Réinitialiser » du Profil (`CLES_REINITIALISABLES`) ne couvre que 5 des plus de 25 clés `pandamove.*` (hors plans, Hyrox, charge, RPE, circuit,
    rappels…). Le texte dit « ni le mode sombre, la variante du panda ou la décharge » : à compléter si l'intention est « tous les réglages ».
14. **Couverture de tests** (lignes de test / lignes de source) : Renforcement 0,96, Calendrier 1,28, Administration 1,12 ; Endurance 0,38, Respiration 0,41, Hyrox 0,42,
    Mobilité 0,42, Profil 0,44, Plans 0,45, Accueil 0,58. Écrans sans test qui les cite : `LoginScreen`, `MfaChallengeScreen` (testé via la barrière de connexion),
    `SortieFormScreen`, `ProgressionScreen`, `EquipmentScreen`, `DebugWriteScreen`.
15. **Documentation** : README seulement pour Administration, Calendrier, Hyrox, Respiration, Renforcement (et ses sous-dossiers) ; absents pour Endurance, Mobilité, Plans, Stats,
    Outils, Profil, Import, Accueil, Auth, Onboarding, Démarrage. `CLAUDE.md` dit « migrations 0001 à 0011 » (il y en a 18), omet Hyrox, Plans, Administration dans la liste des
    modules et ne cite que deux READMEs. *Reco* : corriger après la fusion de la PR 82 (qui touche les mêmes lignes) ; trois lignes.
16. **Calendrier** : les séances Hyrox y paraissent comme des séances de course (« Hyrox · … ») sans genre propre ; la mobilité et la respiration ne se planifient pas. Cohérent
    avec l'usage actuel ; à reconsidérer si Hyrox gagne son propre agenda.

### Vérifié, sans écart
Rappels push (renforcement + course/vélo, donc aussi Hyrox par le préfixe) ; suppression de compte ; sauvegarde (toutes les tables) ; synchro (21 tables avec Nutrition) ;
filtre `Hyrox · ` côté Plans ; contraste AA des couleurs de module (testé) .

## Nutrition (PR 82) face aux autres modules

- ✅ Conventions de données, 4 endroits, export/import, suppression de compte, couleur AA, pastille, adresses, garde-fous ci-dessus.
- ⚠️ Mêmes écarts que les autres modules récents : écrans qui lisent la base (point 5), pas de tuile à l'Accueil (point 2), absente de l'export ciblé (point 3), poids à ressaisir
  (point 4), `plans__carte` réutilisée (point 12).
- ⚠️ Pas de rappel de saisie (les rappels existants ne couvrent que les séances) ; pas d'effet sur le bilan de la semaine (volontaire : l'énergie dépensée n'est pas comptée).

## Comment relancer l'audit
`npm test -- src/app/concordanceModules` pour les garde-fous. Les inventaires (apostrophes, accès base dans les composants, formats de date, clés de stockage, tailles de CSS par
module) se refont avec les commandes `grep` décrites dans l'historique de cette PR ; ils pourraient devenir des tests d'architecture si les listes d'exceptions sont figées.
