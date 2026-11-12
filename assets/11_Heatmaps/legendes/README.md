# Légendes de la heatmap musculaire

Documentation des zones de la heatmap (`web/src/features/stats/heatmapZones.ts`). Les tracés suivent les contours **déjà dessinés** dans les illustrations (`heatmap-{male,female}-{face,dos}`) : chaque trait sombre délimite une zone fermée, numérotée, et chaque zone est affectée à un muscle.

| Fichier | Contenu |
|---|---|
| `legende_<variante>_<vue>.png` | Planche de légende : zones colorées par muscle, numéro de chaque zone, liste « muscle → zones » à droite. |
| `zones_<variante>_<vue>.png` | Les mêmes zones numérotées avant affectation (une couleur au hasard par zone), pour retrouver un numéro. |
| `classes_<variante>_<vue>.json` | Affectation brute (Gemini) : numéro de zone → groupe musculaire (`AUCUN` : pas un muscle). |
| `legendes.json` | Résumé final : image → muscle → numéros de zones. |

Variantes : `male` / `female`. Vues : `face` / `dos`.

## Corriger une affectation

1. Repérer le numéro de la zone sur `zones_*.png` ou `legende_*.png`.
2. L'ajouter dans `web/scripts/heatmap/corrections.py` (`CORRECTIONS[(variante, vue)] = {numéro: 'GROUPE'}`, `None` pour « aucun muscle »), limiter un muscle en hauteur avec `LIMITES_Y` (exemple : cuisses arrêtées au genou), ou donner les bords d'une zone à un autre muscle avec `DECOUPES_X` (exemple : obliques de la femme, de chaque côté des abdominaux).
3. Régénérer (voir `web/scripts/heatmap/README.md`).

Vue d'origine des groupes : PECTORAUX, EPAULES, BICEPS, AVANT_BRAS, ABDOMINAUX, OBLIQUES, QUADRICEPS (face) ; TRAPEZES, TRICEPS, DOS, LOMBAIRES, FESSIERS, ISCHIO, MOLLETS (dos). Un groupe peut aussi être placé sur l'autre vue (exemple : triceps vus de face, avant-bras et épaules vus de dos) : il y est tracé en plus. L'arrière des épaules (`EPAULES_ARRIERE` chez Gemini) compte comme EPAULES. ADDUCTEURS et AUTRE restent dans la liste sous la figure (aucune zone dessinée).

## Limites connues

- Les numéros de zones dépendent de la détection des traits (seuil sombre 95 en vue de face, 140 en vue de dos) : une nouvelle illustration donne une nouvelle numérotation, donc de nouveaux fichiers de classes.
- Vue femme de face : abdos et obliques forment une seule zone dessinée ; les obliques en sont les bords (`DECOUPES_X`, hors de x 255 à 345). Le buste (soutien-gorge) sert de zone pectoraux.
- Mollets : seuls les faisceaux dessinés sont couverts (le bas de jambe reste sans zone).
