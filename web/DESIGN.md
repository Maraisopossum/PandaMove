---
name: PandaMove System
colors:
  surface: '#fef7ff'
  surface-dim: '#ded8e1'
  surface-bright: '#fef7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f1fb'
  surface-container: '#f2ecf5'
  surface-container-high: '#ece6ef'
  surface-container-highest: '#e7e0e9'
  on-surface: '#1d1a21'
  on-surface-variant: '#494551'
  inverse-surface: '#322f36'
  inverse-on-surface: '#f5eef8'
  outline: '#7a7583'
  outline-variant: '#cbc4d3'
  surface-tint: '#6a4cad'
  primary: '#432385'
  on-primary: '#ffffff'
  primary-container: '#5b3d9e'
  on-primary-container: '#cdb8ff'
  inverse-primary: '#d1bcff'
  secondary: '#006c4a'
  on-secondary: '#ffffff'
  secondary-container: '#82f5c1'
  on-secondary-container: '#00714e'
  tertiary: '#523200'
  on-tertiary: '#ffffff'
  tertiary-container: '#714700'
  on-tertiary-container: '#f3b86b'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d1bcff'
  on-primary-fixed: '#23005b'
  on-primary-fixed-variant: '#513394'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffddb6'
  tertiary-fixed-dim: '#f7bb6f'
  on-tertiary-fixed: '#2a1800'
  on-tertiary-fixed-variant: '#643f00'
  background: '#fef7ff'
  on-background: '#1d1a21'
  surface-variant: '#e7e0e9'
  module-strength: '#5b3d9e'
  module-strength-hover: '#4b2e8c'
  module-strength-accent: '#7c5cbf'
  module-calendar: '#e65100'
  module-stats: '#bf360c'
  module-nutrition: '#059669'
  module-nutrition-tint: '#ecfdf5'
  module-import: '#1565c0'
  neutral-bg-light: '#f6f6f8'
  neutral-surface-light: '#ffffff'
  neutral-text-main-light: '#1e1e22'
  neutral-text-muted-light: '#5c5c66'
  neutral-border-light: '#dedee4'
  neutral-bg-dark: '#121214'
  neutral-surface-dark: '#1e1e22'
  neutral-text-main-dark: '#f2f2f5'
  neutral-text-muted-dark: '#a8a8b3'
  neutral-border-dark: '#34343c'
  focus-light: '#1565c0'
  focus-dark: '#90caf9'
typography:
  display-chrono:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  kpi-stat:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-tabular:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
  label-micro:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

> **Écarts d'implémentation** (valeurs ajustées pour l'accessibilité AA ; le reste du fichier est inchangé).
> - Barre du calendrier `#D24700` au lieu de `#E65100` (texte blanc : 4,5:1 au lieu de 3,8:1) ; `#E65100` reste l'accent non textuel (bordure du jour choisi, liseré).
> - Texte orange du calendrier `#B43C00` (clair) et `#FB923C` (sombre) ; bouton « Ouvrir » `#C2410C` ; pastilles « programmée » `#B45309` au lieu d'ambre 500.
> - Statistiques : pilule de période active `#C2410C` (conforme), bandes et texte `#FB923C` en thème sombre.
> - Violet et vert éclaircis en thème sombre (`#C9B6F2`, `#B8A1F0`, `#34D399`) ; icône Calendrier de l'accueil `#92400E`.
> - Barre du haut de 52 px (spec) au lieu de 56 px ; cellules tactiles de 44 px (jour du calendrier, boutons de carte, champs de série), contrôles de 48 px.
> - Profil : accent sauge `#A6BB90` en thème sombre ; fond de page conservé (`--fond`) au lieu de `#F4F5F1`.
> - Les jetons et couleurs vérifiés sont testés dans `src/app/contraste*.test.ts`.

---

# DESIGN SYSTEM — PANDAMOVE

> Système de conception unifié pour l'application mobile et web **PandaMove** : entraînement au renforcement musculaire, planification calendaire, statistiques d'efforts & heatmap musculaire, et suivi de nutrition au quotidien.

---

## 🧭 1. Principes Directeurs & Architecture Ergonomique

1. **Architecture sans barre inférieure (No Bottom Tab Bar)** :
   - L'ensemble de la navigation globale s'appuie sur la barre supérieure (**Top Bar**) et le menu tiroir latéral escamotable (**Drawer**).
   - Maximise la surface utile verticale sur smartphone et élimine les barres encombrantes.
   - Sur grand écran (Desktop / >1024px), le drawer devient un panneau latéral permanent.

2. **Cibles tactiles adaptées à l'effort (Thumb-friendly & Workout-ready)** :
   - Hauteur minimale standard de commande : `48px` (`--hauteur-controle: 48px`).
   - Cellules de saisie et grilles de données : `44px` (`--hauteur-cellule: 44px`).
   - Steppers d'incrémentation rapide (`-`, `+`, `-5`, `+5`, `-10g`, `+10g`) pour ajuster les répétitions, charges, temps de repos et grammages sans ouvrir le clavier système.

3. **Chiffres tabulaires & Lisibilité immédiate** :
   - Utilisation systématique de `font-variant-numeric: tabular-nums` pour éviter les sauts visuels lors du chronométrage ou de la modification de valeurs.
   - Hiérarchie typographique tranchée avec un contraste optimal (standards WCAG AA minimum).

4. **Identité modulaire chromatique** :
   - Chaque grand domaine de l'application possède une couleur sémantique dédiée appliquée sur la barre supérieure, les liserés de cartes et les badges.

---

## 🎨 2. Palette Chromatique & Modules Sémantiques

### Couleurs des Modules Métier
- **Renforcement Musculaire** : `#5b3d9e` (Violet athlétique) / Survol : `#4b2e8c` / Accent : `#7c5cbf`
- **Calendrier & Planification** : `#e65100` (Orange vif dynamique)
- **Statistiques & Heatmap** : `#bf360c` (Terre cuite / Rouge brique athlétique)
- **Nutrition & Hydratation** : `#059669` (Vert émeraude vitalité) / Fond teinté : `#ecfdf5`
- **Import & Données** : `#1565c0` (Bleu cobalt technique)

### Surfaces Neutres (Thème Clair — Base)
- `fond` : `#f6f6f8`
- `surface` : `#ffffff`
- `surface-elevated` : `#ffffff` (avec ombre portée subtile)
- `texte-principal` : `#1e1e22`
- `texte-secondaire` : `#5c5c66`
- `bordure` : `#dedee4`
- `focus` : `#1565c0`

### Surfaces Neutres (Thème Sombre — Dark Mode)
- `fond` : `#121214`
- `surface` : `#1e1e22`
- `texte-principal` : `#f2f2f5`
- `texte-secondaire` : `#a8a8b3`
- `bordure` : `#34343c`
- `focus` : `#90caf9`

---

## 📐 3. Échelle Ergonomique & Variables CSS (`:root`)

```css
:root {
  /* Échelle tactile mobile & géométrie */
  --hauteur-controle: 48px;       /* Cibles tactiles standards (48px min) */
  --hauteur-cellule: 44px;        /* Hauteur des cellules de tableau / inputs */
  --hauteur-barre: 52px;          /* Barre d'en-tête (hors safe-area) */
  --radius-carte: 16px;           /* Arrondi moderne des cartes */
  --radius-bouton: 12px;          /* Arrondi des boutons */
  --radius-pilule: 999px;         /* Arrondi complet pour badges & chips */

  /* Typographie */
  --police-principale: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --taille-micro: 0.8rem;
  --taille-petit: 0.875rem;
  --taille-corps: 1rem;
  --taille-titre-3: 1.1rem;
  --taille-titre-2: 1.25rem;
  --taille-titre-1: clamp(1.35rem, 1.1rem + 1vw, 1.75rem);
  --taille-kpi: 1.6rem;
  --taille-chrono: 2.5rem;

  /* Palette sémantique des modules */
  --couleur-renforcement: #5b3d9e;
  --couleur-renforcement-hover: #4b2e8c;
  --couleur-renforcement-accent: #7c5cbf;
  --couleur-calendrier: #e65100;
  --couleur-stats: #bf360c;
  --couleur-nutrition: #059669;
  --couleur-import: #1565c0;
  --couleur-succes: #059669;
  --couleur-succes-fond: #ecfdf5;

  /* Steppers du tableau de séries & contrôles de grammage */
  --stepper-btn-largeur: 24px;
  --stepper-btn-couleur: #7c5cbf;
  --stepper-btn-fond-survol: rgba(124, 92, 191, 0.08);

  /* Ombres subtiles */
  --ombre-carte: 0 2px 8px -2px rgba(0, 0, 0, 0.05), 0 1px 4px -1px rgba(0, 0, 0, 0.03);
  --ombre-flottante: 0 -4px 16px rgba(0, 0, 0, 0.08);
}
```

---

## 🧩 4. Composants Clés & Motifs d'Interface (Patterns)

### A. Tableau des Séries & Steppers Rapides (`.tableau-series`)
- **Structure en grille compacte** : `[# Série] [Reps ±] [Kg ±] [Repos ±] [Valider]`
- **Cellules Stepper** :
  - Encadrement à 10px de rayon avec bouton `-` à gauche et `+` à droite.
  - Saisie centrale tabulaire (`font-variant-numeric: tabular-nums; text-align: center; font-weight: 700`).
  - Repos avec micro-steppers delta (`-5s` / `+5s`).
- **Bouton de validation compact (32px)** :
  - Diamètre 32px (`w-8 h-8`), centré verticalement, avec icône coche de 16px.
  - État validé : fond vert émeraude `#059669` avec coche blanche.
- **Série en cours** : bordure gauche épaisse de 4px (`--couleur-renforcement`) et fond subtilement teinté.

### B. Barre de Progression Supérieure des Exercices (`.navex`)
- **Regroupement par blocs d'exercices** :
  - Les exercices d'un même ensemble (ex. *Échauffement*, *Mobilité*, *Bloc Principal*) sont ceinturés dans un conteneur cadre dédié (`.navex__groupe--cadre`).
  - Défilement horizontal fluide avec scroll tactile (`scrollbar-width: thin`).
  - L'exercice actif affiche sa pastille colorée, son liseré d'accent et son groupe musculaire.
  - Les exercices achevés reçoivent une pastille coche verte.

### C. Module Nutrition : Journal & Ajout d'Aliment
- **Dashboard Journal** :
  - Anneau ou barre circulaire de progression calorique du jour (Consommé / Objectif / Reste).
  - 3 jauges horizontales de macronutriments (Protéines, Glucides, Lipides) avec ratios clairs.
  - Bloc d'hydratation avec ajouts rapides d'eau (`+ 250 ml`, `+ 500 ml`).
  - Cartes de repas modulaires (Petit-déjeuner, Déjeuner, Collation, Dîner).
- **Ajout d'aliment** :
  - Steppers de grammage rapide (`-10g`, `-5g`, `+5g`, `+10g`, `-50g`, `+50g`) pour une saisie ultra-rapide sans pavé tactile système.
  - Recalcul direct en temps réel de l'apport énergétique et des macros.
  - Liste des aliments fréquents avec bouton `+` en un clic.

### D. Barre d'Actions Inférieure Flottante (`.execution__actions-flottantes`)
- Fixée en bas de l'écran avec intégration de la zone sécurisée (`env(safe-area-inset-bottom)`).
- Bouton secondaire (Pause / Repos) et bouton principal plein largeur (Terminer la séance / Enregistrer l'aliment).
