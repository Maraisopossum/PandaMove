# Guide — Images des bannières "Mes entraînements"

## Où apparaissent ces images ?

Sur l'écran d'accueil de PandaFit, la section **"MES ENTRAÎNEMENTS"** affiche une liste de cartes.
Chaque carte représente un sport ou une fonctionnalité (Course, Vélo, Renforcement…).

L'image s'affiche **à droite** de chaque carte, entre le titre et la flèche de navigation.
Elle remplit toute la hauteur de la carte sans en dépasser.

**Structure actuelle d'une carte (les descriptions ont été supprimées) :**

```
┌─────────────────────────────────────────────┐
│  [🔵]  Renforcement          [IMAGE]  ›     │
└─────────────────────────────────────────────┘
```

---

## État actuel des images

| Section        | Fichier attendu           | Présent ? |
|----------------|---------------------------|-----------|
| Course à pieds | `img_panda_running.png`   | ✅ Oui    |
| Vélo           | `img_panda_cycling.png`   | ✅ Oui    |
| Renforcement   | `img_panda_strength.png`  | ✅ Oui    |
| Calendrier     | `img_panda_calendar.png`  | ✅ Oui    |
| Minuteur       | `img_panda_timer.png`     | ❌ Manque |
| Stats          | `img_panda_stats.png`     | ❌ Manque |
| Profil         | `img_panda_profile.png`   | ❌ Manque |

Les sections sans image affichent simplement un espace vide à droite — aucun bug ne se produit.

---

## Où placer les fichiers

```
PandaFit/
└── feature/
    └── home/
        └── src/
            └── main/
                └── res/
                    └── drawable/        ← ICI
                            img_panda_running.png
                            img_panda_cycling.png
                            img_panda_strength.png
                            img_panda_calendar.png
                            img_panda_timer.png      ← à créer
                            img_panda_stats.png      ← à créer
                            img_panda_profile.png    ← à créer
```

> **Important :** le nom du fichier doit être exactement celui indiqué (minuscules, underscores, `.png`).
> Android ne tolère pas les majuscules ni les tirets dans les noms de ressources.

---

## Format et dimensions recommandés

### Format
- **PNG** avec **fond transparent** (couche alpha)
- Fond transparent = le fond de la carte apparaît derrière l'illustration
- Alternative acceptable : fond de la même couleur que la carte (légèrement teinté de la couleur du sport)

### Zone d'affichage dans la carte

Depuis la suppression des descriptions, les cartes n'affichent plus qu'**une seule ligne de texte** (le titre).
La carte est donc **plus basse** qu'avant.

| Dimension | Valeur |
|-----------|--------|
| **Largeur de la zone image** | 80 dp |
| **Hauteur de la carte** | ≈ 46 dp (une seule ligne de titre) |

À titre de comparaison : sur un téléphone standard (densité xxhdpi = 3×) :
- 80 dp = **240 px** de large
- 46 dp = **138 px** de haut

La zone image est donc **plus large que haute** — elle est presque rectangulaire en mode paysage.

### Taille recommandée de l'image exportée

L'image est recadrée automatiquement (`ContentScale.Crop`), donc une image carrée fonctionne très bien.
Le personnage doit être **placé dans la moitié droite** du document pour rester visible.

| Densité  | Multiplicateur | Taille min. recommandée |
|----------|----------------|--------------------------|
| mdpi     | 1×             | 80 × 50 px               |
| hdpi     | 1,5×           | 120 × 75 px              |
| xhdpi    | 2×             | 160 × 100 px             |
| xxhdpi   | 3×             | 240 × 138 px             |
| xxxhdpi  | 4×             | 320 × 184 px             |

**Recommandation simple (un seul fichier) :**
Exporte en **400 × 400 px** (carré) et place-le dans `drawable/`.
Android le recadre automatiquement — seule la moitié droite de l'image sera visible dans la carte.

> Pour une qualité optimale sur les écrans haute résolution, exporte en **800 × 800 px**.

---

## Composition visuelle de l'illustration

### Orientation
L'image est **ancrée à droite** de la carte. Le recadrage se fait depuis la gauche :
la partie **droite** de l'image est toujours conservée, la partie gauche peut être coupée.

```
Image brute (400×400)          →   Zone visible dans la carte (~80×46 dp)
┌──────────────────────┐           ┌──────────┐
│                      │           │          │
│      🐼 →            │  →  crop  │   🐼 →   │
│                      │           │          │
└──────────────────────┘           └──────────┘
    ← côté coupé        →           côté conservé →
```

Place le personnage dans la **moitié droite** du document pour qu'il soit toujours visible,
quelle que soit la taille de l'écran.

### Style recommandé
- Illustration de style **cartoon/flat design**, cohérente avec le panda mascotte existant
- Personnage ou objet **orienté vers la droite** (regardant vers l'intérieur de la carte)
- Couleurs qui s'accordent avec la teinte du sport :

| Section        | Couleur principale  |
|----------------|---------------------|
| Course à pieds | Rouge/corail        |
| Vélo           | Bleu                |
| Renforcement   | Violet              |
| Calendrier     | Orange              |
| Minuteur       | Vert                |
| Stats          | Bleu                |
| Profil         | Gris                |

### Idées par section manquante
| Section  | Idée d'illustration                           |
|----------|-----------------------------------------------|
| Minuteur | Panda regardant un chronomètre ou une montre  |
| Stats    | Panda devant un graphique ou un podium        |
| Profil   | Panda en portrait / selfie / médaillon        |

---

## Comment l'image est affichée techniquement (pour référence)

Dans le code Compose (`HomeScreen.kt`, composable `SectionBarCard`) :

```kotlin
Image(
    painter = painterResource(id = section.imageRes),
    contentDescription = null,
    contentScale = ContentScale.Crop,      // recadrage automatique
    alignment = Alignment.CenterEnd,       // ancrage à droite
    modifier = Modifier
        .fillMaxHeight()                   // remplit la hauteur de la carte
        .width(80.dp),                     // largeur fixe
)
```

- **`ContentScale.Crop`** : l'image est agrandie pour remplir la zone ; les bords qui dépassent sont coupés.
- **`Alignment.CenterEnd`** : le côté **droit** de l'image est conservé en priorité.
- **`fillMaxHeight()`** : l'image s'étire sur toute la hauteur de la carte sans jamais en dépasser.
- La carte (`RoundedCornerShape(16.dp)`) arrondit automatiquement les coins de l'image.

---

## Supprimer l'icône circulaire à gauche (ex : l'haltère de Renforcement)

Chaque bannière affiche actuellement un **cercle coloré avec une icône** à gauche du titre
(haltère pour Renforcement, vélo pour Vélo, etc.).

```
┌─────────────────────────────────────────────┐
│  [🔵]  Renforcement          [IMAGE]  ›     │
│   ↑ c'est ça                                 │
└─────────────────────────────────────────────┘
```

### Pour supprimer cet élément

Ouvre le fichier :
```
PandaFit/feature/home/src/main/java/com/pandafit/feature/home/ui/HomeScreen.kt
```

Dans la fonction `SectionBarCard`, cherche ce bloc (lignes ~415–427) :

```kotlin
Spacer(Modifier.width(12.dp))

// Icône circulaire
Box(
    modifier = Modifier
        .size(42.dp)
        .clip(CircleShape)
        .background(section.color.copy(alpha = 0.18f)),
    contentAlignment = Alignment.Center,
) {
    Icon(section.icon, contentDescription = null, tint = section.color, modifier = Modifier.size(22.dp))
}

Spacer(Modifier.width(12.dp))
```

**Supprime tout ce bloc** (les deux `Spacer` inclus). La carte devient :

```
┌───────────────────────────────────────────┐
│  Renforcement                [IMAGE]  ›   │
└───────────────────────────────────────────┘
```

### Ajuster le padding gauche du titre (optionnel)

Après suppression, si le titre colle trop au bord gauche, augmente le premier `Spacer` initial du Row.
Cherche juste après `Row(...) {` :

```kotlin
Spacer(Modifier.width(12.dp))
```

Et remplace `12.dp` par `16.dp` pour aérer :

```kotlin
Spacer(Modifier.width(16.dp))
```

### Supprimer aussi le champ `icon` (optionnel — nettoyage du code)

Si tu n'en as plus besoin du tout, tu peux aussi supprimer le champ `icon` de `SectionItem`.
Cherche dans le même fichier :

```kotlin
private data class SectionItem(
    val label: String,
    val color: Color,
    val icon: ImageVector,      // ← supprimer cette ligne
    val onClick: () -> Unit,
    val tag: String,
    val imageRes: Int? = null,
)
```

Et dans `allSections`, retire `Icons.AutoMirrored.Filled.DirectionsRun` (et ses équivalents) de chaque ligne.

> **Note :** si tu supprimes le champ `icon` et qu'Android Studio affiche une erreur rouge,
> c'est probablement parce que l'import `import androidx.compose.ui.graphics.vector.ImageVector`
> devient inutile. Tu peux le supprimer aussi.

---

## Étapes pour ajouter une image manquante

### Étape 1 — Créer l'illustration
1. Crée un document **400 × 400 px** (carré, fond transparent)
2. Place le personnage dans la **moitié droite** du document
3. Exporte en **PNG**

### Étape 2 — Nommer le fichier
Format : `img_panda_[nom].png` — uniquement minuscules et underscores.

| Section  | Nom du fichier          |
|----------|-------------------------|
| Minuteur | `img_panda_timer.png`   |
| Stats    | `img_panda_stats.png`   |
| Profil   | `img_panda_profile.png` |

### Étape 3 — Placer le fichier
```
PandaFit/feature/home/src/main/res/drawable/
```

### Étape 4 — Ajouter la référence dans le code
Dans `allSections` (`HomeScreen.kt`), remplace `null` par la ressource :

```kotlin
// AVANT
SectionItem("Minuteur", ..., imageRes = null),

// APRÈS
SectionItem("Minuteur", ..., imageRes = R.drawable.img_panda_timer),
```

### Étape 5 — Recompiler
Lance un build dans Android Studio (`Ctrl+F9` ou triangle vert ▶).

---

## Vérification rapide

- [ ] Fichier en `.png` (pas `.PNG`, `.jpg`)
- [ ] Nom en minuscules avec underscores uniquement
- [ ] Fichier dans `feature/home/src/main/res/drawable/`
- [ ] Référence `R.drawable.img_panda_xxx` ajoutée dans `allSections`
- [ ] Personnage placé dans la moitié droite de l'image
