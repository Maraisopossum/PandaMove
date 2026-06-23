# Rapport d'analyse — Module de progression (Strength)

Comparaison entre `bible-progression.md` + les maquettes (`maquette-encodage.html`,
`seance-en-direct.html`, `seance-type-finale.html`, `variantes-rapport-seance.html`) et
l'implémentation actuelle (`ProgressionEngine.kt`, `SystemeProgression.kt`,
`ExerciceSeanceEntity.kt`, `InstanceExecuteViewModel.kt`, `SeanceCreateScreen.kt`,
`SeanceDetailScreen.kt`, `InstanceExecuteScreen.kt`, tests).

Périmètre : **Strength uniquement**.

---

## Écarts majeurs (cœur de la bible non implémenté)

### 1. Systèmes de progression incomplets
La bible (§1.1) et la maquette d'encodage listent 6 systèmes : Linéaire, Double, Volume,
Densité, RPE/RIR, Temporelle. `SystemeProgression.kt` n'a que `LINEAIRE | DOUBLE | TEMPORELLE`.
Volume (ajout de série/reps), Densité (réduction du repos) et RPE/RIR autorégulé sont absents
de l'enum, de `ProgressionEngine.proposerMontee()` et de l'UI (`SeanceCreateScreen` n'affiche
que 3 boutons système).

### 2. Champ `type_exercice` totalement absent
La bible (§4.1, §6.1) ET la maquette d'encodage exigent un sélecteur "Composé bas / Composé
haut / Isolation / Machine / PDC" qui détermine l'incrément. Aucun champ équivalent dans
`ExerciceSeanceEntity`. L'incrément (`incrementKg`) est aujourd'hui saisi manuellement, sans
lien avec le type d'exercice — la fonctionnalité "incrément auto" de la maquette (composé bas
→ +5 kg, isolation → reps d'abord, etc.) n'existe pas.

### 3. Formule d'incrément qualitatif non implémentée
Bible §4.2/§4.3 : `increment = max(pas_matériel, charge × %cible)`, avec arrondi à la charge
réellement chargeable (`arrondir_a_charge_realisable`, selon le matériel : haltères / barre +
disques / machine). Le code actuel (`arrondirIncrement()`) arrondit juste au multiple du
`incrementKg` fixé manuellement — aucune notion de matériel, de pas minimum, ou de pourcentage
cible.

### 4. Niveau utilisateur (ancienneté) absent
Bible §4.4 : le niveau (débutant / intermédiaire / avancé) doit moduler la vitesse de
progression et le `%cible`. Aucun champ "niveau" nulle part (ni profil utilisateur, ni config
exercice).

### 5. Garde-fou "plafond de saut >10%" manquant
Bible §4.5 : ne jamais proposer une hausse de charge >10% en une fois. Seul le deload est
plafonné (-10%) ; rien ne borne la hausse côté linéaire/double.

---

## Écarts UI (maquettes vs écrans actuels)

### 6. Bandeau "à battre" en direct absent
`seance-en-direct.html` décrit un indicateur live pendant la séance : "Fais 12 reps sur les 3
séries pour débloquer 22,5 kg 🔓 1/3". Vérifié dans `InstanceExecuteScreen.kt` : aucun
équivalent — le retour de progression n'apparaît qu'à la clôture via
`ProgressionRecapDialog`. C'est pourtant identifié comme la fonctionnalité signature de la
maquette.

### 7. Détection des exercices non loggés limitée aux exercices en progression
Bible §2.3/§3 : `detecter_exo_non_logge` doit s'appliquer à *tout* exercice planifié absent du
rapport (l'exemple donné — abduction de hanche — n'est même pas forcément en progression). Or
`prepareFinish()` (`InstanceExecuteViewModel.kt`) ne boucle que sur
`es.progressionActivee == true` : un exercice de travail oublié pendant la séance, sans
progression activée, ne sera jamais signalé.

### 8. Pas de "variante d'exercice" suggérée pour le PDC en échec répété
Bible §3 (exemple Nordic curl : "Échec → garder ; si répété, variante") et maquette : "Pour un
exercice au poids du corps : progression en reps, puis lest, puis variante plus difficile." Le
moteur ne gère que reps/charge/durée ; aucune notion de lest additionnel ou de substitution
d'exercice après plusieurs échecs sur un PDC.

---

## Écarts mineurs / cosmétiques

- Réordonnancement par boutons haut/bas au lieu d'un vrai drag handle (maquette d'encodage) —
  fonctionnellement équivalent, juste moins fluide.
- Aucune estimation de durée de séance (~75 min) dans l'en-tête `SeanceDetailScreen` — feature
  exploratoire (variante C de `variantes-rapport-seance.html`), absente de la maquette finale
  retenue (`seance-type-finale.html`), donc faible priorité.

---

## Ce qui est déjà conforme (pas de travail nécessaire)

- Séparation séance type / objectif courant (bible §0.1)
- Propagation aux instances futures non réalisées
- Boîte de validation Oui / Non / Ajuster à la clôture (§2.6)
- Compteur d'échecs consécutifs + deload à -10% (§2.5)
- Garde-fou RPE ≥ 9 → succès sans marge, cible inchangée (§4.5)
- Gestion bilatérale : le côté faible déterminé le statut global (§4.5)
- Non-régression des séances déjà clôturées (rapports figés)
- Historique cross-séance affiché à l'écran d'exécution (`HistoriqueSection`)
