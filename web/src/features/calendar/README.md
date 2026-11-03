# Agenda (calendar) Blueprint

## System Overview

Agenda de PandaMove : une grille mensuelle, le panneau du jour choisi et la liste des prochaines séances. Il affiche trois genres d'événements : `renfo` (séances de renforcement, instances de `instances_seance`), `course` et `velo` (séances de cardio, tables `seances_course` et `seances_velo`). Le cardio n'est **pas un module** : il n'a ni route, ni écran d'exécution, ni statistiques. On pose une séance dans l'agenda, on la déplace, on la valide, on la supprime ; les données réelles restent sur Strava, Suunto et MyWoosh (un lien facultatif y renvoie). Les écrans lisent et écrivent la base locale PowerSync via `core/db` ; la synchronisation est assurée ailleurs.

## Local Interface & Invariants

- **Écran (export default)** : `CalendarScreen`, branché sur `useEcranCalendrier` (état des dialogues et de la saisie) et `useCalendar` (lecture du mois, actions).
- **Union des événements** : `types.ts` (`EvenementAgenda = EvenementRenfo | EvenementCardio`, discriminée sur `genre`), `evenements.ts` (`depuisInstance`, `depuisCardio`, `trierEvenements`, `peutDeplacer`, `messageRefusDeplacement`, `LIBELLE_GENRE`, `ORDRE_GENRES`, `exhaustif`). Tout `switch` sur le genre se termine par `exhaustif(x: never)` : ajouter un genre casse la compilation aux endroits à compléter.
- **Cardio** (`seancesCardio/`) : `LigneCardio` (ligne d'une séance), `FeuilleSeanceCardio` et `saisieCardio.ts` (formulaire, validation par champ), `lienValide.ts` (lien `https://` uniquement), `importerProgramme2027.ts`, `useImportProgramme.ts` et `programme2027.json` (import du programme).
- **Accès aux données** : `core/db/repos/seancesCardio.ts` (`creer`, `modifier`, `deplacer`, `definirValidation`, `supprimer`, `lirePlage`, `lireProchaines`, `lireParId`). Aucune requête SQL dans cette feature.
- **Invariants** :
  - Une séance de cardio validée est « terminée » et **ne se déplace pas** : il faut d'abord la dévalider (`peutDeplacer`, revérifié dans la transaction par `deplacer`).
  - Le cardio ne compte dans aucune statistique : `stats`, `demarrage` et `home` ne lisent jamais `seances_course` ni `seances_velo` (garde : `stats/exclusionCardio.test.ts` et `stats/statsInchangeesParCardio.test.ts`).
  - Le cardio est hors de l'export JSON de sauvegarde.
  - « Optionnelle » et le jalon sont de simples mentions d'affichage, sans effet. Le jalon s'affiche avec un drapeau et son libellé en toutes lettres ; le genre, « Optionnelle » et « Validée » aussi : jamais la couleur seule.
  - `detail` est un texte « durée · zone » conservé tel quel, jamais découpé.
  - L'agenda n'importe jamais `features/strength` (le renforcement importe l'agenda) : le code partagé vit dans `core/` (`core/ui/usePiegeFocus` pour les dialogues, `core/common/dates` pour les dates). Garde : `independanceStrength.test.ts`.
  - Les suppressions sont logiques (`deleted_at`) ; les dates sont des chaînes ISO validées (`dateIsoValide`, `core/common/dates.ts`).

## Données et synchronisation

Deux tables identiques, créées par `web/supabase/migrations/0008_seances_cardio.sql`, déclarées dans `core/db/schema.ts` et listées dans `web/powersync/sync-rules.yaml` (`core/db/coherenceTables.test.ts` vérifie que ces listes concordent). **Ordre de déploiement** : 1) la migration, 2) la vérification de la publication et du rôle de réplication (messages NOTICE de la migration), 3) les règles de synchro PowerSync, 4) le nouveau client. Un client qui écrit avant la migration voit ses envois relancés sans fin. Retour arrière : redéployer l'ancien client ; les tables restent en place, inertes.

## Import du programme 2027

Onglet « Programme 2027 » de l'écran Import (`features/import/ImportProgrammePanel.tsx`). La source est le fichier HTML `support/Programme_endurance_PandaMove_2027_Zwift_KICKR.html`, converti **une fois, à la main** par `node scripts/extraire-programme-2027.mjs` en `programme2027.json` (versionné ; un test vérifie qu'il est à jour). Le bouton est inactif tant que la première synchronisation n'est pas faite, hors ligne, pendant une synchronisation ou avec une file d'envoi non vide (`useImportProgramme`, `useSourceSynchro`). L'import est atomique et rejouable : l'identifiant est `deterministicId(userId, 'programme2027|' + cle)`, une séance déjà présente (déplacée, validée ou supprimée comprises) n'est jamais touchée.
