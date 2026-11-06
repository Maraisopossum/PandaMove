import json, os
SP = os.path.dirname(os.path.abspath(__file__))
CIBLE = os.path.join(SP, '..', '..', 'src', 'features', 'stats', 'heatmapZones.ts')
zones = json.load(open(os.path.join(SP, 'zones_trace.json'), encoding='utf-8'))
ORDRE = ['PECTORAUX', 'EPAULES', 'BICEPS', 'AVANT_BRAS', 'ABDOMINAUX', 'OBLIQUES', 'QUADRICEPS', 'TRAPEZES', 'TRICEPS', 'DOS',
         'LOMBAIRES', 'FESSIERS', 'ISCHIO', 'MOLLETS', 'ADDUCTEURS', 'AUTRE']

src = open(CIBLE, encoding='utf-8').read()
debut = src.index('// Zones de la heatmap musculaire')
fin = src.index('export type VueHeatmap')
entete = '''// Zones de la heatmap musculaire, superposées aux fonds public/panda/heatmap-{variante}-{vue}.webp
// (600 × 900, générés par scripts/build-images.mjs depuis assets/11_Heatmaps ; taille unique, fixée par ces tracés).
// Tracés des muscles DESSINÉS : contours obtenus par segmentation de chaque image (Gemini), puis nettoyés (remplissage,
// lissage, découpe sur la silhouette du personnage, aucun chevauchement entre muscles) et simplifiés en chemins M / L / Z.
// Chaque variante a son propre tracé (silhouettes male et female différentes). Les muscles pairs ont leurs deux côtés dans
// le même chemin. Chaque groupe apparaît UNE fois : sur la vue où il se voit le mieux, ou dans la « liste » (barres sous
// la figure) quand aucune vue ne le montre (adducteurs couverts par le short, « Autre »).
// Pour refaire les tracés (nouvelle illustration) : segmenter à nouveau les quatre images et régénérer ce fichier.

'''
src = src[:debut] + entete + src[fin:]

a = src.index('const face = ')
b = src.index('export const HEATMAP_ZONES')
src = src[:a] + '''const face = (svgPath: string): ZoneHeatmap => ({ vue: 'face', svgPath })
const dos = (svgPath: string): ZoneHeatmap => ({ vue: 'dos', svgPath })
const LISTE: ZoneHeatmap = { vue: 'liste', svgPath: null }

''' + ''.join(
    f'const {nom}: Record<MuscleGroup, ZoneHeatmap> = {{\n' + ''.join(
        f"  {g}: " + ('LISTE' if zones[v][g]['svgPath'] is None else f"{zones[v][g]['vue']}('{zones[v][g]['svgPath']}')") + ',\n'
        for g in ORDRE) + '}\n\n'
    for nom, v in (('MALE', 'male'), ('FEMALE', 'female'))) + src[b:]
open(CIBLE, 'w', encoding='utf-8').write(src)
print('ok')
