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
| Accueil (tuiles, bilan, propositions) | ✅ 9 accès rapides configurables ; Hyrox dans le bilan (voir « Suites données ») |
| Statistiques / charge d'entraînement | ✅ les simulations Hyrox y entrent (voir « Suites données ») |
| Export ciblé (« Exporter une partie ») | ✅ Hyrox, plans et nutrition ajoutés |
| Écran = composant + hook (CLAUDE.md) | ❌ 13 composants lisent la base directement |
| Style des boutons principaux | ⚠️ 4 familles de couleur |
| Typographie des textes (apostrophe ’) | ❌ environ 80 textes avec ' (corrigés dans l'interface), ⚠️ messages de `core/` restants |
| Redondances Profil / Outils / Statistiques | ✅ 2 doublons supprimés |
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

## Suites données (2026-11-16)

Décisions de Benoît sur les écarts ci-dessus, et ce qui en a été fait.

| Écart | Décision | Réalisation |
| --- | --- | --- |
| 1. Hyrox hors bilan, charge, statistiques | Ajouter | `hyrox/chargeHyrox.ts` : une simulation **terminée** compte comme séance terminée et temps de sport dans le bilan de l'Accueil ; elle entre dans la charge d'entraînement (forme, fatigue, fraîcheur) sous la forme d'une sortie de course à la volée, avec un effort supposé de **8/10** pour une simulation complète et **7/10** pour une partielle ou une station (pondération modifiable dans `RPE_PAR_FORME`) ; nouvelle vue **Hyrox** dans Statistiques (nombre, temps passé, temps moyen, meilleure simulation complète, liste). Les simulations en cours ou abandonnées ne comptent pas. Aucune distance n'est comptée (non mesurée). |
| 2. Tuiles Accueil | Ajouter Plans, Hyrox, Nutrition | 9 accès rapides (3 × 3), puis **configurables** : Profil > Organiser les modules (ordre commun au menu et à l'Accueil, case « Accueil » par module). |
| 3. Export ciblé | Ajouter Hyrox, plans (et nutrition) | Familles « Hyrox » (simulations terminées ; temps de chaque segment dans le JSON), « Plans » (objectifs, hors période comme le calendrier) et « Nutrition » (journal, eau comprise). |
| 4. Poids | Tout dans le Profil, Nutrition le lit | La **taille** se règle dans Profil > Poids (réglage d'appareil, comme le poids). Nutrition lit la dernière pesée et la taille du Profil, ne les redemande plus et renvoie vers le Profil pour les modifier. Âge et sexe restent saisis dans Nutrition (ils n'existent pas dans le Profil). |
| 5. 13 écrans sans hook | Proposition demandée | Voir ci-dessous. |
| 6. Boutons principaux | Proposition demandée | Voir ci-dessous. |
| 7. Doublons | Progression : garder Statistiques ; Sauvegarde : garder Mes données | `/outils/progression` supprimé (redirige vers `/stats`), entrée retirée du menu Outils ; la section « Sauvegarde » du Profil est remplacée par un renvoi vers Outils > Mes données. |

Autres demandes traitées avec ces décisions :
- **Menu** : plus de sous-menus, uniquement les modules, dans un ordre réglable (Profil > Organiser les modules).
- **Retour** : la barre du haut porte un bouton Retour sur tous les sous-écrans (`app/parents.ts` : table des écrans parents, couverte par un test sur toutes les routes). Il monte d'un niveau ; il revient en arrière dans l'historique si l'écran parent est celui d'où l'on vient, sinon il remplace l'écran courant par son parent. Enregistrer, supprimer ou annuler un formulaire **remplace** l'écran dans l'historique (le retour du système ne rouvre plus un formulaire validé). Les liens « ← Parent » et « Retour à X » redondants sont retirés (restent ceux des écrans « introuvable » et les actions « Annuler »).

### Proposition pour l'écart 5 : écrans sans hook

13 écrans appellent `getDb()` ou les dépôts eux-mêmes. Proposition : **un hook par écran, par module, sans changement de comportement**, protégé par les tests existants (écrans) :
1. Hyrox (5 écrans), puis Plans (3), puis Profil (2), Respiration (1), Renforcement (2), chacun dans sa PR ;
2. un test d'architecture « aucun `getDb` dans un `*Screen.tsx` » avec une **liste d'exceptions qui ne fait que diminuer** (elle contient les 13 écrans au départ, la PR de chaque module en retire) ;
3. pour Nutrition, les écrans neufs (objectifs, aliments, entrée) passent par `useJournalNutrition` ou un hook voisin dans la même série.
Coût : mécanique, sans valeur visible pour l'utilisateur ; je recommande de le faire **au fil des modifications** de chaque module plutôt qu'en bloc, avec le test d'architecture posé tout de suite.

### Proposition pour l'écart 6 : boutons principaux

Aujourd'hui : violet par défaut, couleur du module pour six modules. Proposition **A (recommandée)** : le bouton principal prend la **couleur du module courant** partout (Course vert, Vélo bleu, Calendrier orange foncé, Statistiques, Outils, Profil, Import, Administration selon leur propre couleur de barre), via une variable `--couleur-action` posée par la coque et un seul `.bouton--principal` ; les six surcharges de `app.css` disparaissent. Les couleurs de barre ont déjà un texte blanc ≥ 4,5:1 (testé), donc l'AA est acquis ; seul Hyrox garde sa variante jaune en mode sombre. Variante **B** : violet de marque pour tous (cohérence maximale, mais les modules perdent leur identité sur l'action principale). Une décision à prendre avant de coder.

## Comment relancer l'audit
`npm test -- src/app/concordanceModules` pour les garde-fous. Les inventaires (apostrophes, accès base dans les composants, formats de date, clés de stockage, tailles de CSS par
module) se refont avec les commandes `grep` décrites dans l'historique de cette PR ; ils pourraient devenir des tests d'architecture si les listes d'exceptions sont figées.
