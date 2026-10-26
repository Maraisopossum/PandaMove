# Audit visuel complet — cohérence de tous les modules vs DESIGN.md

## Contexte
L'utilisateur demande un audit visuel de chaque module de l'app (feature/*) comparé aux règles du
`DESIGN.md`, dans le but de préparer une "linéarisation" (mise à niveau/harmonisation) globale du
visuel avant la prochaine refonte. Trois explorations en lecture seule ont couvert l'ensemble des
modules : (1) strength/running/cycling, (2) warmup/calendar/stats, (3) profile/timer/home/breathing.
Ce document compile leurs résultats en un audit unique et une feuille de route de linéarisation
priorisée. Aucune modification de code n'a été faite à ce stade — c'est un rapport de diagnostic.

---

## 1. Écart systémique n°1 — `PandaTopBar` ne peut pas respecter DESIGN.md

Le composant `core/designsystem/.../PandaTopBar.kt` a `containerColor: Color = Color.Transparent`
par défaut et **n'expose pas de paramètre `contentColor`**. Résultat : **aucun écran de l'app**
(tous modules confondus) n'affiche de TopBar pleine couleur sport + texte blanc, alors que c'est la
règle n°1 du DESIGN.md ("Header / TopBar → fond plein couleur sport, texte + icônes blancs").
C'est la cause racine de la majorité des écarts "TopBar non conforme" listés plus bas — corriger le
composant réglerait la moitié des écarts en un seul endroit.

## 2. Écart systémique n°2 — `contentPadding bottom` à 88.dp au lieu de 80.dp

strength, running et cycling utilisent de façon très cohérente `bottom = 88.dp` sur leurs écrans
liste, alors que DESIGN.md prescrit `80.dp`. C'est trop cohérent pour être un hasard — probablement
une convention d'équipe non répercutée dans la doc. **Décision à prendre** : soit corriger le code
(88→80), soit mettre à jour DESIGN.md (80→88) pour refléter la réalité. warmup/calendar respectent
déjà 80.dp ; stats et profile n'ont pas de bottom padding dédié du tout (16.dp uniforme).

## 3. Écart systémique n°3 — pattern "bande gauche 4dp + fond teinté" jamais implémenté tel quel
Aucun des ~15 écrans de liste/détail audités n'implémente le pattern exact du DESIGN.md. Variantes
trouvées en pratique : `Card` + bordure conditionnelle de sélection (la plus fréquente), `PandaCard`
+ `SportIconBadge` rond sans bande, bande à 3dp au lieu de 4dp (`BlocCard` strength), bordure
complète sans bande (`RunRepeatCard`, `BlocGroupFrame`), ou bande 4dp mais colorée par type
fonctionnel plutôt que par sport (`RunStepCard`). Le pattern documenté doit soit être appliqué
partout, soit être révisé pour documenter le pattern réellement utilisé (badge rond + bordure).

## 4. Écart systémique n°4 — fuite de couleurs entre modules
Plusieurs écrans utilisent la couleur d'un **autre** module sport que le leur :
- **running** : `RunningScreen.kt` (header sélection, `RunSectionHeader`, bordure carte) et
  `RunningWorkoutDetailScreen.kt` (bouton "Enregistrer", label section, checkbox) utilisent
  `PandaPurple` (couleur strength) au lieu de `PandaGreen` — semble être un copier-coller depuis
  `SeanceListScreen`/strength sans adaptation de couleur.
- **strength** : `InstanceReportScreen.kt` mélange **4 couleurs** dans un seul écran — `KalyptusGreen`
  (couleur Respiration) pour le header, `PandaGreen` pour le bouton final, `PandaOrange` pour les
  superset, en plus du violet attendu. C'est l'écart le plus grave relevé dans tout l'audit.
- **warmup** : utilise `PandaOrange` (couleur Calendrier) partout au lieu de `KalyptusGreen`
  (couleur officiellement assignée à warmup/respiration selon le cheat sheet).
- **breathing** : **aucun des 3 écrans** n'utilise `KalyptusGreen` — mélange `PandaGreen` (CTA) et
  `PandaBlue` (steppers) selon les écrans, sans cohérence ni respect de l'identité du module.
- **profile** : `EquipmentScreen.kt` utilise `PandaPurple` sur les icônes/boutons alors que
  `ProfileScreen.kt`/`ExerciseCatalogScreen.kt` utilisent `PandaGreen`.
- **calendar** : `PandaOrange` (sa propre couleur) n'apparaît nulle part dans l'écran actif — le
  seul usage est un FAB commenté/désactivé. Le module Calendrier n'a donc concrètement aucune
  couleur d'identité visible à l'écran.
- **stats** : mélange jusqu'à 4 couleurs sport simultanément sur l'onglet "Tout" (acceptable
  fonctionnellement pour une vue multi-sport, mais à noter comme tension avec la règle "ne pas
  mélanger deux couleurs sport dans la même vue").
- **timer** : possède sa propre sous-palette de 6+ couleurs hardcodées (`StopwatchColor`,
  `CountdownColor`, `TabataColor`, etc.) non répertoriées dans le cheat sheet DESIGN.md — le module
  Timer n'a pas d'identité de couleur documentée du tout.

## 5. Écart systémique n°5 — écrans d'exécution sans fond sombre/coloré profond
DESIGN.md prescrit pour le pattern "Écran exécution" : "Fond sombre ou couleur sport profond". Or
`InstanceExecuteScreen` (strength), `RunningWorkoutExecuteScreen` (running), `TimerScreen`
(vues actives Stopwatch/Countdown/HIIT) et `BreathingSessionScreen` restent tous sur fond clair
standard (`MaterialTheme.colorScheme.background`). Aucun écran d'exécution de l'app n'applique
réellement ce pattern — soit le pattern documenté est obsolète, soit c'est un chantier de refonte
entier à part.

## 6. Écart systémique n°6 — couleurs hardcodées `Color(0xFF...)` dupliquant des tokens existants
Concentration la plus forte dans `RunningWorkoutExecuteScreen.kt` (7 couleurs locales dupliquant
`PandaOrange`/`PandaRed`/`PandaSubtext`), `InstanceReportScreen.kt` (5 gris/rouges hardcodés),
`StatsScreen.kt` (`PandaPurpleLight` redéfini localement avec une **valeur différente** du token
officiel — collision de nom dangereuse), `TimerScreen.kt` (8+ couleurs). cycling et calendar sont
les plus propres sur ce point (quasi aucune couleur hardcodée trouvée).

## 7. Écart systémique n°7 — chiffres-clés pas toujours `ExtraBold`
Incohérent même au sein d'un seul module : `StatsScreen.kt` a `FunCardBig` en `ExtraBold` mais
`StatItem`/`StatMiniCard`/`ProgressionHeroCard` en `Bold`/`SemiBold`. `TimerScreen.kt` utilise
`FontWeight.Thin` sur le grand chrono du stopwatch — à l'opposé de la règle. `SeanceDetailScreen`
(`HeroStat`) est en `Bold` au lieu d'`ExtraBold`. Seuls `InstanceReportScreen` (KPI) et
`WeekRecapCard` (home) respectent strictement la règle.

## 8. Écart systémique n°8 — coexistence de systèmes d'écran divergents dans un même module
strength a deux familles d'écrans qui semblent dupliquer la même fonctionnalité avec des patterns
visuels différents : `SeanceXxxScreen` (nouveau) vs `StrengthWorkoutXxxScreen` (legacy) — à
clarifier si le legacy doit être supprimé avant toute harmonisation visuelle (sinon la
linéarisation devra être faite deux fois).

---

## Tableau de synthèse par module

| Module | TopBar colorée | Bande gauche cartes | Couleurs hors-module | Couleurs hardcodées | ExtraBold chiffres | bottom padding |
|---|---|---|---|---|---|---|
| strength | ❌ | ❌ (4 patterns différents coexistent) | ⚠️ Report mélange 4 couleurs | ⚠️ Execute/Report | ⚠️ partiel | 88dp / 24dp incohérent |
| running | ❌ | ❌ | ❌ PandaPurple récurrent (bug copier-coller) | ⚠️ Execute/Report | N/A | 88dp / 48dp incohérent |
| cycling | ❌ | ❌ | ✅ le plus discipliné | ✅ quasi aucune | N/A | 88dp |
| warmup | ❌ | ❌ (Card M3 générique) | ❌ PandaOrange au lieu de KalyptusGreen | ✅ | N/A | ✅ 80dp |
| calendar | ❌ | ⚠️ badge rond, pas de bande | ⚠️ couleur d'identité absente de l'écran actif | ✅ | N/A | ✅ 80dp |
| stats | ✅ (surface = correct) | ⚠️ acceptable (écran générique) mais hero gradient à 100% | ⚠️ 4 couleurs simultanées (justifié fonctionnellement) | ❌ collision de nom `PandaPurpleLight` | ❌ incohérent | ❌ 16dp uniforme |
| profile | ✅ (générique) | N/A | ❌ EquipmentScreen en PandaPurple vs reste en PandaGreen | ⚠️ mineur | N/A | ❌ manquant |
| timer | ⚠️ structure OK, palette non documentée | ❌ composants custom | — (palette propre non liée aux modules sport) | ❌ 8+ couleurs | ❌ Thin/Bold | ✅ partiel |
| home | ❌ (TopAppBar natif, pas PandaTopBar) | ✅ conforme | — | ⚠️ mineur (overlay) | ✅ | ✅ 80dp |
| breathing | ❌ jamais KalyptusGreen | ❌ | ❌ mélange PandaGreen/PandaBlue | ✅ | ⚠️ Bold pas ExtraBold | ❌ 32dp |

**Modules les plus problématiques (priorité de correction)** : strength (`InstanceReportScreen`),
running (bug PandaPurple récurrent), breathing (identité de couleur jamais respectée), timer
(absence totale d'identité documentée + fond exécution non conforme).
**Modules les plus sains** : cycling (couleur cohérente), home (bande gauche + ExtraBold corrects),
calendar (propre mais couleur d'identité invisible).

---

## Proposition de feuille de route de linéarisation (priorisée)

### Phase A — corriger les fondations du design system (impact transversal, peu de fichiers)
1. Ajouter `contentColor` à `PandaTopBar` et fixer sa valeur par défaut cohérente avec DESIGN.md.
2. Trancher 80dp vs 88dp pour le bottom padding des listes — mettre à jour soit le code (tous les
   écrans identifiés), soit `DESIGN.md`.
3. Supprimer la redéfinition locale erronée de `PandaPurpleLight` dans `StatsScreen.kt` (collision
   de nom avec le token officiel) — utiliser le vrai token ou en créer un nouveau nommé différemment.

### Phase B — corriger les fuites de couleur inter-modules (bugs visibles, priorité haute)
4. `RunningScreen.kt` + `RunningWorkoutDetailScreen.kt` : remplacer tous les `PandaPurple` par
   `PandaGreen` (bug de copier-coller depuis strength).
5. `InstanceReportScreen.kt` (strength) : remplacer `KalyptusGreen`/`PandaOrange`/`PandaGreen` par
   `PandaPurple` de façon cohérente (garder l'orange uniquement si fonctionnellement justifié pour
   les superset, mais documenter ce cas dans DESIGN.md s'il est conservé).
6. `WarmupListScreen.kt` : remplacer `PandaOrange` par `KalyptusGreen`.
7. Module breathing (3 écrans) : remplacer `PandaGreen`/`PandaBlue` par `KalyptusGreen` partout.
8. `EquipmentScreen.kt` (profile) : aligner sur `PandaGreen` (cohérent avec le reste du module).

### Phase C — appliquer le pattern de carte standard (chantier plus large)
9. Définir un seul pattern de carte de référence (bande 4dp + fond teinté ≤50%, ou officialiser le
   pattern "badge rond + bordure" s'il est préféré en pratique) et l'appliquer aux cartes de liste
   de strength/running/cycling/warmup/calendar.

### Phase D — cohérence typographique
10. Harmoniser `FontWeight.ExtraBold` sur tous les chiffres-clés identifiés en écart (`StatItem`,
    `StatMiniCard`, `ProgressionHeroCard`, `HeroStat` de strength, chrono de `TimerScreen`).

### Phase E — décision produit sur les écrans d'exécution
11. Décider si le pattern "fond sombre/coloré profond" du DESIGN.md doit réellement être implémenté
    sur les écrans d'exécution (strength/running/timer/breathing), ou si le pattern documenté doit
    être retiré/révisé pour refléter le choix réel (fond clair partout actuellement).

### Hors scope immédiat
- Nettoyage des couleurs hardcodées restantes (Phase B les couvre en partie via les remplacements
  de couleur module, mais un passage dédié sera nécessaire pour `RunningWorkoutExecuteScreen.kt`,
  `InstanceExecuteScreen.kt`, `TimerScreen.kt`).
- Clarification/suppression du système legacy `StrengthWorkoutXxxScreen` vs `SeanceXxxScreen`
  (décision produit préalable nécessaire, hors périmètre visuel pur).

## Verification
Aucune modification de code n'est prévue à cette étape — livrable = document d'audit. Une fois le
document sauvegardé, toute correction de Phase A-E devra être vérifiée via
`./gradlew :feature:<module>:assembleDebug` + relecture visuelle sur device/émulateur avant commit.
