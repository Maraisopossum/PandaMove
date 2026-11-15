# strength/report

Rapport d'une séance de renforcement terminée (miroir d'`InstanceReportScreen` et de `ProgressionRecapDialog` Android) : chiffres clés, détail par exercice, récap de progression à décider, export.

## Interface

- `ReportScreen.tsx` : écran par défaut (route avec `instanceId`), sans logique, tout vient de `useEcranBilan`.
- `ProgressionRecapDialog.tsx` : dialogue modal (Oui / Non, garder / Ajuster, un seul « Valider ») ; props `lignes`, `sousTitre`, `erreur`, `enCours`, `onValider`, `onFermer`.
- `useEcranBilan(instanceId)` : orchestration (données, textes formatés, ouverture du récap, annonces, export). Type `LigneRecap`.
- `useReport(instanceId, { db?, userId?, nowFn? })` : charge le bilan, évalue les propositions (lecture seule), expose `accepter`, `refuser`, `ajuster`, `valider(lot)` ; recalcule via `reevaluerApresCorrection`. Types `LigneBilan`, `GroupeBilan`, `PropositionBilan`, `ChoixRecap`, `EtatProposition`.
- `useChoixRecap(lignes)` : brouillon des choix du récap (`choixDe`, `chargeDe`, `conseilDe`).
- `useExportRapport(rapport, date, annoncer)` : `copier`, `telecharger`, `telechargerImage`, `partager`, `peutPartager`.
- `bilan.ts` : fonctions pures de formatage (`resumerSeance`, `texteProposition`, `texteStatut`, `formaterDureeBilan`, `formaterTonnage`, `formaterDateLongue`, `formaterRpe`, `ligneSerie`, `compterSeries`, `libelleCible`, `conseilCharge`, `titreBloc`, `sousTitreRecap`, `messageEnregistrement`, `phrasesRecalcul`).
- `exportRapport.ts` : `texteResume`, `genererHtml`, `nomFichierRapport`, `detailLigne`.
- `imageRapport.ts` : `planImage` (mise en page pure), `genererPng` (canvas, injectable), `nomFichierImage`, `LARGEUR_IMAGE`.

## Invariants

- Aucune logique dans les composants ; l'évaluation vit dans `../progression`.
- Rien n'est écrit avant « Valider » ; « Plus tard » ferme sans écrire. « Oui » est présélectionné, un deload n'est jamais appliqué sans ce geste.
- Chaque décision est écrite une seule fois, dans une transaction (objectif + marqueur de l'instance).
- Une instance importée d'Android (sans `started_at`) n'est jamais ré-évaluée.
- Tonnage = Σ reps × charge des séries terminées ; les séries `DURATION` (secondes) comptent pour 0.
- Pas d'affectation au calendrier sur cet écran.
- Le HTML exporté est autonome (aucun script).

## Side Effects

- Lecture/écriture de la base locale (objectifs, instance, séries prévues) via `useReport`.
- Export : presse-papiers (`navigator.clipboard`), téléchargement de fichiers HTML/PNG (lien temporaire), `navigator.share` si disponible. Rien n'est envoyé à un serveur.
- Utilise `useAuth` et `useImagePanda` pour l'utilisateur et l'illustration.

## Dépendances

`../progression`, `../execute/vue`, `../draft`, `../champs`, `../usePiegeFocus`, `core/db`, `core/progression`, `core/common/formaterCharge`.

## Verification

`cd web && npm test` (vitest).
