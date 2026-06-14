# DESIGN.md — Guide de design PandaFit pour Claude

> Lire ce fichier en entier avant tout travail de design. Il est la source de vérité unique.

---

## Direction : Clean & Bold

**Référence** : Nike Training, Strava — fond neutre, typographie forte, couleurs sport en touches affirmées.

**Pas** : Flat total, glassmorphism, dark theme, surcharge d'ombres.

Trois règles résument tout :
1. **Identité par sport** — chaque module a sa couleur, visible immédiatement dans le header et les cartes
2. **Typographie comme hiérarchie** — les chiffres et titres parlent fort, le reste s'efface
3. **Blanc + une couleur** — les surfaces restent blanches/neutres, la couleur sport est réservée aux points d'impact

---

## Système de couleurs

### Palette sport (source : `Color.kt`)

| Module        | Primary          | Light (fond teinté) | Dark (texte/bord) |
|---------------|------------------|---------------------|-------------------|
| Renforcement  | `PandaPurple` `#7C5CBF` | `PandaPurpleLight` `#EDE8F7` | `PandaPurpleDark` `#5A3D9A` |
| Running       | `PandaGreen` `#2E9E6B`  | `PandaGreenLight` `#E6F7F1`  | `PandaGreenDark` `#1B6B46`  |
| Vélo          | `PandaBlue` `#1565C0`   | `PandaBlueLight` `#E3F2FD`   | `PandaBlueDark` `#0D47A1`   |
| Calendrier    | `PandaOrange` `#E65100` | `PandaOrangeLight` `#FFF3E0` | `PandaOrangeDark` `#BF360C` |
| Respiration   | `KalyptusGreen` `#969B7F` | `KalyptusGreenLight` `#E8EBE0` | `KalyptusGreenDeep` `#5A5E4C` |

**Accès Compose** : `MaterialTheme.extendedColors.strength.primary` (strength/running/cycling).

### Règles d'utilisation des couleurs

**Header / TopBar** → fond plein couleur sport, texte + icônes blancs.
```kotlin
// Pattern header coloré
PandaTopBar(
    containerColor = sportColor,        // couleur sport pleine
    contentColor   = Color.White,
    scrolledContainerColor = sportColor.copy(alpha = 0.95f),
)
```

**Cartes dans un module sport** → bande gauche 4dp couleur sport + fond très légèrement teinté.
```kotlin
Box(
    modifier = Modifier
        .fillMaxWidth()
        .background(sportColorLight.copy(alpha = 0.45f), shape = MaterialTheme.shapes.large)
) {
    // Bande gauche
    Box(Modifier.width(4.dp).fillMaxHeight().background(sportColor))
    // Contenu avec padding start = 12.dp + 4.dp
}
```

**Chiffres-clés et métriques** → `fontWeight = FontWeight.ExtraBold`, couleur sport ou `PandaOnBackground`.

**Boutons CTA principaux** → `AppButton(color = sportColor)` — jamais `PandaPurple` par défaut dans un module running/vélo.

**Badges / chips** → fond `sportColorLight`, texte `sportColorDark`, pas de bordure.

**Ce qu'on évite** :
- Mélanger deux couleurs sport dans la même vue
- Fond de carte > 50% d'opacité de teinte sport (trop chargé)
- Couleur sport sur du texte `bodySmall` (illisible)
- `PandaSubtext` pour des données importantes

---

## Typographie

Source : `Typography.kt`. Police principale **DM Sans**, grands chronos/affichages **Poppins**.

| Rôle                          | Style             | Poids        | Taille |
|-------------------------------|-------------------|--------------|--------|
| Titre d'écran (TopBar)        | `headlineMedium`  | ExtraBold    | 22sp   |
| Titre de section              | `titleMedium`     | SemiBold     | 15sp   |
| Chiffre-clé / stat principale | `displaySmall`    | Bold (Poppins)| 36sp  |
| Grand chrono                  | `displayLarge`    | Bold (Poppins)| 57sp  |
| Corps standard                | `bodyMedium`      | Normal       | 13sp   |
| Label badge / chip            | `labelMedium`     | SemiBold     | 11sp   |
| Texte secondaire              | `bodySmall`       | Normal       | 12sp, couleur `PandaSubtext` |

**Règle clé** : une seule taille de `display` par écran maximum. Les chiffres sport (pace, poids, durée) méritent `displaySmall` + couleur sport ou noir, jamais gris.

---

## Composants — Usage précis

### `PandaTopBar`
- Module sport → `containerColor = sportColor`, `contentColor = Color.White`
- Écrans génériques (profil, stats globales) → défaut `MaterialTheme.colorScheme.surface`
- Toujours `exitUntilCollapsedScrollBehavior` sur les écrans à liste longue

### `PandaCard`
- Élévation standard : `2.dp` (fond blanc, ombre légère)
- Dans un module sport actif : utiliser le pattern bande gauche (voir Couleurs)
- Ne jamais empiler deux `PandaCard` l'une dans l'autre

### `AppButton` / variantes
- CTA principal → `AppButton(color = sportColor, fullWidth = true)`
- Action secondaire → `AppButtonSecondary(color = sportColor)`
- Annuler / action neutre → `AppButtonGhost`
- Supprimer / danger → `AppButtonDanger`
- Hauteur fixe : primary = 52dp, ghost = 44dp (small = 36dp) — **ne pas modifier**

### `SectionTitle`
- Toujours utilisé entre les blocs d'une page, jamais dans une carte
- Padding horizontal = `screenPadding` (16dp)

### Spacing tokens (`Spacing.kt`)
```
xs = 4dp   → séparateurs, padding interne dense
sm = 8dp   → gap entre éléments dans une ligne
md = 16dp  → padding écran, gap entre cartes
lg = 24dp  → section gap, margin entre blocs
xl = 32dp  → espacement entre sections majeures
```
**Ne jamais coder de valeurs dp arbitraires** — utiliser les tokens ou `LocalPandaFitSpacing.current`.

---

## Patterns d'écrans

### Écran liste (ex. SeanceListScreen, HomeScreen)

```
TopBar [couleur sport, titre blanc]
└── LazyColumn
    ├── SectionTitle + [action secondaire]
    ├── PandaCard [bande gauche sport] × N
    └── Spacer(80.dp)  ← espace pour FAB ou bottom nav
```

### Écran détail (ex. SeanceDetailScreen, RunningWorkoutReportScreen)

```
TopBar [couleur sport] + scrollBehavior exitUntilCollapsed
└── LazyColumn
    ├── Card hero [fond teinté sport, métriques ExtraBold]
    ├── SectionTitle "Détail"
    ├── Rows / items
    └── Spacer(80.dp)
```

### Écran exécution (ex. InstanceExecuteScreen)

```
Fond sombre ou couleur sport profond
Grand affichage central [displayLarge Poppins blanc]
Tableau de séries [fond surface semi-transparent]
Bouton CTA [couleur sport]
```

### Header hero card (pattern recommandé pour stats/résumé)

```kotlin
PandaCard(modifier = Modifier.fillMaxWidth().padding(md)) {
    Box(Modifier.background(brush = Brush.verticalGradient(
        listOf(sportColor.copy(alpha = 0.08f), Color.Transparent)
    ))) {
        Row {
            Box(Modifier.width(4.dp).fillMaxHeight().background(sportColor))  // bande
            Column(Modifier.padding(start = 12.dp, top = 12.dp, end = 12.dp, bottom = 12.dp)) {
                Text(titre, style = titleMedium, color = sportColor, fontWeight = Bold)
                Text(valeur, style = displaySmall, fontWeight = ExtraBold)
                Text(sous-titre, style = bodySmall, color = PandaSubtext)
            }
        }
    }
}
```

---

## Identité par module — Cheat sheet

| Module       | TopBar color       | Carte bande | Chip fond          | Bouton CTA    |
|--------------|-------------------|-------------|--------------------|---------------|
| Renforcement | `PandaPurple`     | `PandaPurple` | `PandaPurpleLight` | `PandaPurple` |
| Running      | `PandaGreen`      | `PandaGreen`  | `PandaGreenLight`  | `PandaGreen`  |
| Vélo         | `PandaBlue`       | `PandaBlue`   | `PandaBlueLight`   | `PandaBlue`   |
| Calendrier   | `PandaOrange`     | `PandaOrange` | `PandaOrangeLight` | `PandaOrange` |
| Respiration  | `KalyptusGreen`   | `KalyptusGreen`| `KalyptusGreenLight`| `KalyptusGreen`|
| Home / Stats | surface (défaut)  | —            | `PandaPurpleLight` | `PandaPurple` |

---

## Do's & Don'ts

**✅ Faire**
- Header `PandaTopBar` coloré dans chaque module sport
- Bande gauche 4dp sur les cartes dans un module sport
- `fontWeight = FontWeight.ExtraBold` pour tous les chiffres-clés
- `PandaSubtext` pour les métadonnées / labels secondaires
- `contentPadding = PaddingValues(bottom = 80.dp)` sur toutes les LazyColumn
- `Spacer(Modifier.height(80.dp))` en fin de liste si pas de contentPadding

**❌ Éviter**
- `elevation = 0.dp` sur `PandaCard` (perd la profondeur sur fond blanc)
- Hardcoder des dp sans raison (`12.dp` → utiliser `spacing.sm + spacing.xs`)
- Couleur sport en `alpha < 0.04f` sur fond de carte (invisible, inutile)
- `Text` avec `color = Color.Black` (utiliser `PandaOnBackground` ou `MaterialTheme.colorScheme.onSurface`)
- Plusieurs `displayLarge` ou `headlineLarge` sur le même écran
- `modifier = Modifier.padding(8.dp)` asymétrique sans raison claire

---

## Checklist design avant commit

- [ ] TopBar de l'écran utilise la couleur sport du module
- [ ] Les cartes principales ont une bande gauche colorée OU un fond teinté (pas les deux à > 50%)
- [ ] Les chiffres-clés sont en `ExtraBold`, les labels secondaires en `PandaSubtext`
- [ ] Les boutons CTA utilisent `sportColor` (pas `PandaPurple` dans running/vélo)
- [ ] `contentPadding = PaddingValues(bottom = 80.dp)` présent sur les listes
- [ ] Aucune dp arbitraire non justifiée

---

## Fichiers clés design system

```
core/designsystem/src/main/java/com/pandafit/designsystem/
├── theme/
│   ├── Color.kt       ← palette complète, source de vérité
│   ├── Theme.kt       ← LightColorScheme + extendedColors par sport
│   ├── Typography.kt  ← PandaFitTypography (DM Sans + Poppins)
│   ├── Shape.kt       ← PandaFitShapes (xs=4 à xl=24dp)
│   └── Spacing.kt     ← PandaFitSpacing (xs à xxl)
└── components/
    ├── PandaCard.kt        ← carte de base
    ├── PandaTopBar.kt      ← top bar avec scroll behavior
    ├── AppButton.kt        ← Primary / Secondary / Ghost / Danger
    ├── PandaChip.kt        ← chips filtre / badge
    └── SectionTitle.kt     ← titre de section
```
