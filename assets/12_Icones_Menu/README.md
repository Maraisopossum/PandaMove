# Pastilles de menu

Treize pastilles illustrées (style des pandas : trait épais, brillance, couleurs saturées), générées avec Gemini (`gemini-3.1-flash-image`) à partir d'un panda de référence. Elles servent au menu, aux tuiles de l'accueil et, plus tard, aux listes et au profil.

| Dossier / fichier | Contenu |
|---|---|
| `sources/<nom>.webp` | Image d'origine (1024 px, fond blanc). |
| `web/public/icons/menu/<nom>.webp` | Version utilisée par l'application : détourée, 192 px. Précachée par le service worker. |
| `icone.py` | Génère une pastille (écrit `brut_<nom>.png` à côté du script) (`icone.py <nom> "<sujet>" "<couleur>"`) ; variables `REF_PANDA` (panda de référence) et `GEMINI_API_KEY`. |
| `detourer.py` | Détoure les `brut_*.png` du dossier (fond blanc relié aux bords) et écrit les versions 192 px. |

Noms : `accueil`, `halteres` (renforcement), `course`, `velo`, `calendrier`, `stats`, `souffle` (respiration), `profil`, `import`, `catalogue`, `lune` (mode sombre), `cle` (mot de passe), `materiel`.

Associer une pastille à un module : champ `icone` de `MODULES` (`web/src/app/modules.ts`). Un test vérifie que chaque fichier référencé existe.

Pour en refaire une : relancer `icone.py` avec la même consigne de style, puis `detourer.py`, et copier le résultat dans `web/public/icons/menu/`.
