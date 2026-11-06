# Scripts de la heatmap musculaire

Régénèrent `src/features/stats/heatmapZones.ts` et les légendes (`assets/11_Heatmaps/legendes/`) à partir des quatre illustrations `public/panda/heatmap-*.webp`. À lancer à la main quand une illustration change ; rien ici ne tourne en CI ni dans l'application.

## Principe

1. `classer.py <variante> <vue>` : détecte les traits sombres de l'image, en tire les zones fermées (`etiq_*.npy`), les numérote (`ids_*.png`) puis demande à Gemini à quel muscle correspond chaque numéro (`classes_*.json`).
2. `corrections.py` : corrections manuelles (numéro de zone → groupe, limites en hauteur).
3. `assembler.py` : réunit les zones d'un même muscle et écrit les contours (`zones_trace.json`, `trace_*.png` de contrôle).
4. `ecrire_ts.py` : réécrit `heatmapZones.ts` depuis `zones_trace.json`.
5. `legendes.py <dossier>` : produit les planches de légende numérotées.

## Dépendances

- Python avec `numpy`, `opencv-python-headless`, `pillow` (un venv suffit).
- Variable d'environnement `GEMINI_API_KEY` (jamais commitée) et le module de suivi `gemini_suivi.py` (chemin ajouté en tête de `classer.py`, à adapter à votre poste).
- Variable `HEATMAP_WEBP` : modèle de chemin des images, par exemple `HEATMAP_WEBP=".../web/public/panda/heatmap-{v}-{vue}.webp"`.

Seuils de détection des traits : 95 en vue de face, 140 en vue de dos (traits intérieurs plus clairs).

Les fichiers générés (`etiq_*.npy`, `*.png`, `zones_trace.json`) sont écrits à côté des scripts et ne sont pas versionnés (voir `.gitignore`).
