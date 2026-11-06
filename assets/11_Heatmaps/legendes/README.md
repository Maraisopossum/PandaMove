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
2. L'ajouter dans `web/scripts/heatmap/corrections.py` (`CORRECTIONS[(variante, vue)] = {numéro: 'GROUPE'}`), ou limiter un muscle en hauteur avec `LIMITES_Y` (exemple : cuisses arrêtées au genou).
3. Régénérer (voir `web/scripts/heatmap/README.md`).

Les groupes utilisés : PECTORAUX, EPAULES, BICEPS, AVANT_BRAS, ABDOMINAUX, OBLIQUES, QUADRICEPS (vue de face) ; TRAPEZES, TRICEPS, DOS, LOMBAIRES, FESSIERS, ISCHIO, MOLLETS (vue de dos). ADDUCTEURS et AUTRE restent dans la liste sous la figure (aucune zone dessinée).

## Limites connues

- Les numéros de zones dépendent de la détection des traits (seuil sombre 95 en vue de face, 140 en vue de dos) : une nouvelle illustration donne une nouvelle numérotation, donc de nouveaux fichiers de classes.
- Vue femme de face : les obliques ne sont pas tracées (zone non séparée par un trait) ; le buste (soutien-gorge) sert de zone pectoraux.
- Mollets : seuls les faisceaux dessinés sont couverts (le bas de jambe reste sans zone).
