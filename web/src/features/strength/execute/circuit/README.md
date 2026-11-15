# execute/circuit

Circuit automatique et minuteur d'exercice de l'écran d'exécution : plan, machine à états pure, retours sensoriels (bips, vibration, voix) et réglages.

## Interface

- Plan : `construirePlan`, `lancementPour`, `recapCircuit`, `secondesCible`, `estEligible` (types `Lancement`, `Cible`, `PlanCircuit`, `ExercicePlan`, `LignePlan`).
- Machine à états : `demarrer`, `avancer`, `arreter`, `affichage`, constante `INACTIF` (types `EtatCircuit`, `Affichage`, `Position`, `Niveau`, `NatureRepos`, `FinCircuit`, `Cote`, `EffetValider`). Constantes `DUREE_DECOMPTE_SEC` et `PAUSE_COTE_SEC`.
- Retours : `bipsEntre` (type `Bip`), `evenementsEntre` (type `Evenement`), `creerSonneur` (`audio.ts`), `creerVibreur`, `creerVoix`, `creerRetours`, `capacites`, `MOTIFS`, `annonce`, `dureeParlee`, `COULEURS_CIRCUIT`.
- Réglages : `analyserReglages`, `lireReglages`, `ecrireReglages`, `lireBrut`, `DEFAUTS`, `CLE_REGLAGES`.
- Hooks : `useCircuit` (`EntreesCircuit`, `OptionsCircuit`), `useReglagesCircuit`.
- Composants : `LancementCircuit`, `OverlayCircuit`, `ReglagesRetours`.

## Invariants

- `machine.ts` est pur : aucun `setInterval`, chaque fonction reçoit l'instant courant. Le temps restant est recalculé depuis le début de la phase, donc un onglet en arrière-plan ne dérive pas.
- `avancer` rattrape en un appel toutes les phases échues, chacune datée de sa vraie fin ; un garde-fou `MAX_TRANSITIONS` (10 000) évite toute boucle infinie.
- Seuls les exercices `repsType === 'DURATION'` avec une durée cible lisible sont éligibles (`estEligible`).
- Les réglages lus (`analyserReglages`) retombent sur `DEFAUTS` si le contenu stocké est absent ou invalide ; toute erreur d'accès au stockage est absorbée.
- Le rythme du hook `useCircuit` est réglable (`tickMs`, 250 ms par défaut) et l'horloge est injectable (`nowFn`).

## Side Effects

- `useCircuit` démarre un `setInterval` pour recalculer l'affichage.
- `reglages.ts` lit et écrit `localStorage` sous la clé `pandamove.circuit.reglages`.
- `creerSonneur` utilise l'`AudioContext` du navigateur ; `creerVibreur` appelle `navigator.vibrate` ; `creerVoix` utilise `speechSynthesis` (fr-FR). Chaque canal est ignoré s'il est indisponible (par ex. vibration sur iOS Safari).

## Verification

`cd web && npm test`
