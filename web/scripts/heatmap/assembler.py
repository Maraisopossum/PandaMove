"""Assemble les muscles : zones du dessin (etiq_*.npy) + classes Gemini (classes_*.json) + corrections manuelles.
Écrit zones_trace.json et trace_<v>_<vue>.png. Corrections : corrections.py -> CORRECTIONS = {('male','face'): {num_zone: 'GROUPE' ou None}},
LIMITES_Y (un groupe s'arrête à une ordonnée) et DECOUPES_X (les bords d'un groupe passent à un autre, ex. obliques).
Un groupe peut avoir un tracé sur les deux vues ; sa vue « principale » (liste sous la figure) est sa vue d'origine (VALIDES).
"""
import json, os
import cv2
import numpy as np
from PIL import Image

SP = os.path.dirname(os.path.abspath(__file__))
WEBP = os.environ['HEATMAP_WEBP']
H, L = 900, 600
# Vue d'origine de chaque groupe (et ordre de priorité quand deux muscles se disputent un pixel)
VALIDES = {
    'face': ['AVANT_BRAS', 'BICEPS', 'EPAULES', 'PECTORAUX', 'OBLIQUES', 'ABDOMINAUX', 'QUADRICEPS'],
    'dos': ['TRICEPS', 'TRAPEZES', 'DOS', 'LOMBAIRES', 'FESSIERS', 'ISCHIO', 'MOLLETS'],
}
TOUS = ['PECTORAUX', 'EPAULES', 'BICEPS', 'AVANT_BRAS', 'ABDOMINAUX', 'OBLIQUES', 'QUADRICEPS', 'TRAPEZES', 'TRICEPS', 'DOS',
        'LOMBAIRES', 'FESSIERS', 'ISCHIO', 'MOLLETS', 'ADDUCTEURS', 'AUTRE']
# Tout groupe dessiné peut aussi être tracé sur l'autre vue (ex. triceps vus de face) : il passe après ceux de la vue
DESSINES = VALIDES['face'] + VALIDES['dos']
# Libellés de classification ramenés à un groupe de l'application (Gemini distingue l'arrière des épaules en vue de dos)
ALIAS = {'EPAULES_ARRIERE': 'EPAULES'}
COUL = [(75, 25, 230), (75, 180, 60), (200, 99, 67), (49, 130, 245), (180, 30, 145), (128, 128, 0), (240, 50, 230), (36, 99, 154)]
CORRECTIONS = {}
LIMITES_Y = {}
DECOUPES_X = {}
try:
    exec(open(os.path.join(SP, 'corrections.py'), encoding='utf-8').read())
except FileNotFoundError:
    pass

final = {'male': {}, 'female': {}}
for v in ('male', 'female'):
    for vue in ('face', 'dos'):
        im = np.array(Image.open(WEBP.replace('{v}', v).replace('{vue}', vue)).convert('RGBA'))
        corps = (im[:, :, 3] > 20).astype(np.uint8) * 255
        etiq = np.load(os.path.join(SP, f'etiq_{v}_{vue}.npy'))
        classes = json.load(open(os.path.join(SP, f'classes_{v}_{vue}.json'), encoding='utf-8'))
        classes = {int(k): ALIAS.get(g, g) for k, g in classes.items()}
        classes.update({k: g for k, g in CORRECTIONS.get((v, vue), {}).items()})
        base = cv2.cvtColor(im[:, :, :3], cv2.COLOR_RGB2BGR)
        base[corps == 0] = 255
        calque = base.copy()
        ordre = VALIDES[vue] + [g for g in DESSINES if g not in VALIDES[vue]]
        masques = {g: np.zeros((H, L), np.uint8) for g in ordre}
        for i, g in classes.items():
            if g in masques:
                masques[g][etiq == i] = 255
        for g, ymax in LIMITES_Y.get((v, vue), {}).items():
            masques[g][ymax:, :] = 0
        # Bords d'un groupe attribués à un autre, hors de [xmin, xmax] (zone dessinée d'un seul tenant, ex. abdos + obliques)
        for g, (autre, xmin, xmax) in DECOUPES_X.get((v, vue), {}).items():
            bords = masques[g].copy()
            bords[:, xmin:xmax] = 0
            masques[autre] |= bords
            masques[g][bords > 0] = 0
        pris = np.zeros((H, L), bool)
        for k, g in enumerate(ordre):
            m = masques[g]
            # Comble les traits fins qui séparent les morceaux d'un même muscle, sans empiéter sur un autre muscle
            ferme = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
            autres = np.zeros((H, L), bool)
            for g2, m2 in masques.items():
                if g2 != g:
                    autres |= m2 > 0
            ferme[autres | pris] = 0
            ferme = cv2.bitwise_and(ferme, corps)
            pris |= ferme > 0
            chemins = []
            cs, _ = cv2.findContours(ferme, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
            for c in cs:
                if cv2.contourArea(c) < 80:
                    continue
                ap = cv2.approxPolyDP(c, 1.0, True)[:, 0, :]
                if len(ap) < 4:
                    continue
                chemins.append('M' + ' L'.join(f'{int(x)},{int(y)}' for x, y in ap) + ' Z')
                col = COUL[k % len(COUL)]
                surf = calque.copy()
                cv2.fillPoly(surf, [ap.astype(np.int32)], col)
                calque = cv2.addWeighted(surf, 0.5, calque, 0.5, 0)
                cv2.polylines(calque, [ap.astype(np.int32)], True, col, 1)
            if chemins:
                z = final[v].setdefault(g, {'vue': None, 'traces': {}})
                z['traces'][vue] = ' '.join(chemins)
                print(v, vue, g, len(chemins), 'morceau(x)')
        cv2.imwrite(os.path.join(SP, f'trace_{v}_{vue}.png'), calque)
    for g in TOUS:
        z = final[v].setdefault(g, {'vue': None, 'traces': {}})
        origine = 'face' if g in VALIDES['face'] else 'dos' if g in VALIDES['dos'] else None
        # Vue principale : la vue d'origine si le groupe y est tracé, sinon l'autre ; « liste » sans aucun tracé
        z['vue'] = origine if origine in z['traces'] else next(iter(z['traces']), 'liste')
json.dump(final, open(os.path.join(SP, 'zones_trace.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('ok')
