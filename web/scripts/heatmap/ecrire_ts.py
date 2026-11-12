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
// Tracés repassés sur les contours DESSINÉS : les traits sombres de l'image délimitent des zones fermées, numérotées ; chaque
// zone est affectée à un groupe (classification Gemini, corrigée à la main dans scripts/heatmap/corrections.py), puis les zones
// d'un même muscle sont réunies et simplifiées en chemins M / L / Z (aucun chevauchement entre muscles).
// Chaque variante a son propre tracé (silhouettes male et female différentes). Les muscles pairs ont leurs deux côtés dans
// le même chemin. Un groupe peut être tracé sur les deux vues (ex. triceps vus de face) ; sa vue « principale » sert à la
// liste sous la figure. Sans aucun tracé, il est seulement dans la « liste » (adducteurs couverts par le short, « Autre »).
// Pour corriger ou refaire les tracés : scripts/heatmap/README.md (ce fichier est régénéré par ecrire_ts.py).

'''
src = src[:debut] + entete + src[fin:]

a = src.index('const zone = ') if 'const zone = ' in src else src.index('const face = ')
b = src.index('export const HEATMAP_ZONES')
def zone(z):
    if z['vue'] == 'liste':
        return 'LISTE'
    traces = ', '.join(f"{vue}: '{z['traces'][vue]}'" for vue in ('face', 'dos') if vue in z['traces'])
    return f"zone('{z['vue']}', {{ {traces} }})"


src = src[:a] + '''const zone = (vue: VueHeatmap, traces: Partial<Record<VueHeatmap, string>>): ZoneHeatmap => ({ vue, traces })
const LISTE: ZoneHeatmap = { vue: 'liste', traces: {} }

''' + ''.join(
    f'const {nom}: Record<MuscleGroup, ZoneHeatmap> = {{\n' + ''.join(f"  {g}: {zone(zones[v][g])},\n" for g in ORDRE) + '}\n\n'
    for nom, v in (('MALE', 'male'), ('FEMALE', 'female'))) + src[b:]
open(CIBLE, 'w', encoding='utf-8').write(src)
print('ok')
