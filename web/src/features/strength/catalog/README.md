# strength/catalog

Écran du catalogue d'exercices de renforcement (liste, recherche, filtres, favoris, création / modification / suppression, maintenance du catalogue de base).

## Interface

- `CatalogScreen.tsx` : `default CatalogScreen` — écran React ; utilise `useAuth` pour l'utilisateur courant.
- `useCatalog.ts` : `useCatalog({ db?, userId? })` retourne `exercices` (filtrés et triés), `charge`, `filtre`, `baseInstallee`, `operation`, `installerBase`, `corrigerGroupes`, `setFiltre`, `toggleFavori`, `creerPersonnalise`, `modifier`, `supprimer`. Types réexportés : `NewExercise`, `FiltreCatalogue`. Types propres : `OperationCatalogue`, `DepsCatalogue`.
- `useFormulaireExercice.ts` : `useFormulaireExercice({ creerPersonnalise, modifier })` (brouillon, `nouveau`, `editer`, `fermer`, `basculerMuscle`, `soumettre`, `erreur`), `useSuppressionExercice(supprimer)` (`demander`, `erreur`), `versNouvelExercice`, type `BrouillonExercice`.
- `filtreCatalogue.ts` : `FILTRE_INITIAL`, `filtrerExercices`, `lireGroupes`, `musclesAffiches`, types `FiltreCatalogue`, `MusclesAffiches`.
- `libelles.ts` : `libelleMuscle`, `CATEGORIES_EXERCICE`, réexport `MUSCLE_GROUPS`.

## Invariants

- `filtrerExercices` trie par nom normalisé (`normalizeSearch`, accents et casse ignorés) ; la recherche porte sur le nom normalisé [filtreCatalogue.ts:filtrerExercices].
- `lireGroupes` renvoie `[]` pour tout JSON invalide ou non-tableau, et ne garde que les chaînes [filtreCatalogue.ts:lireGroupes].
- Un texte de muscle vide n'est jamais rangé dans « Autre » lors du filtrage [filtreCatalogue.ts:correspondAuMuscle].
- Une seule action de maintenance (installation, correction) à la fois [useCatalog.ts:lancer].
- Création et installation exigent un `userId`, sinon erreur « Utilisateur non connecté. » [useCatalog.ts:creerPersonnalise].
- La liste est relue après chaque écriture (pas d'observation de la base) [useCatalog.ts:recharger].
- Les erreurs de validation `ErreurExercice` sont affichées telles quelles ; les autres donnent un message générique [useFormulaireExercice.ts:soumettre].

## Side Effects

- Lecture et écriture de la base locale via `getDb()` / `core/db/repos/exercises` (création, modification, favori) et `softDelete` sur `exercises` [useCatalog.ts].
- Installation du catalogue de base et correction des groupes musculaires dans la base [useCatalog.ts:installerBase, corrigerGroupes].
- `window.confirm` avant suppression [useFormulaireExercice.ts:useSuppressionExercice].
- Journalisation via `console.error` en cas d'échec.

## Verification

`cd web && npm test` (vitest).
