"""Numérote les zones fermées du dessin et demande à Gemini à quel muscle correspond chaque numéro.
Usage : classer.py <variante> <vue> [modèle]  -> ids_<v>_<vue>.png, classes_<v>_<vue>.json (appel journalisé)
"""
import base64, io, json, os, sys, time, urllib.request, urllib.error
import cv2
import numpy as np
from PIL import Image
sys.path.insert(0, r'C:\Users\benoi\Documents\Claude\suivi_api')
from gemini_suivi import log_usage, API

SP = os.path.dirname(os.path.abspath(__file__))
v, vue = sys.argv[1], sys.argv[2]
modele = sys.argv[3] if len(sys.argv) > 3 else 'gemini-3.8-flash'
SEUIL, AIRE_MIN = (140, 110) if vue == 'dos' else (95, 90)

im = np.array(Image.open(os.environ['HEATMAP_WEBP'].replace('{v}', v).replace('{vue}', vue)).convert('RGBA'))
gris = cv2.cvtColor(im[:, :, :3], cv2.COLOR_RGB2GRAY)
corps = im[:, :, 3] > 20
trait = cv2.dilate(((gris < SEUIL) & corps).astype(np.uint8) * 255, np.ones((2, 2), np.uint8))
libre = ((trait == 0) & corps).astype(np.uint8)
n, etiq, stats, _ = cv2.connectedComponentsWithStats(libre, connectivity=4)
np.save(os.path.join(SP, f'etiq_{v}_{vue}.npy'), etiq)

# Image annotée : fond blanc, zones en couleurs franches, numéro au point le plus « central » de chaque zone
rng = np.random.default_rng(7)
fond = cv2.cvtColor(im[:, :, :3], cv2.COLOR_RGB2BGR)
fond[~corps] = 255
annot = fond.copy()
ids = []
for i in range(1, n):
    if stats[i, cv2.CC_STAT_AREA] < AIRE_MIN:
        continue
    reg = (etiq == i)
    annot[reg] = (0.55 * annot[reg] + 0.45 * rng.integers(60, 255, 3)).astype(np.uint8)
    d = cv2.distanceTransform(reg.astype(np.uint8), cv2.DIST_L2, 3)
    y, x = np.unravel_index(np.argmax(d), d.shape)
    ids.append((i, int(x), int(y)))
annot[trait > 0] = (0, 0, 0)
for i, x, y in ids:
    t = str(i)
    (w, h), _ = cv2.getTextSize(t, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
    cv2.rectangle(annot, (x - w // 2 - 1, y - h // 2 - 2), (x + w // 2 + 1, y + h // 2 + 2), (255, 255, 255), -1)
    cv2.putText(annot, t, (x - w // 2, y + h // 2), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)
cv2.imwrite(os.path.join(SP, f'ids_{v}_{vue}.png'), annot)

def png(arr_bgr):
    ok, buf = cv2.imencode('.png', arr_bgr)
    return base64.b64encode(buf.tobytes()).decode()

GROUPES = {
    'face': (
        'PECTORAUX (chest muscles, both sides), EPAULES (deltoids: the rounded shoulder caps only), BICEPS (the big flexed muscle '
        'mound on the front of the upper arm), AVANT_BRAS (forearm: between the elbow and the fist), ABDOMINAUX (the six-pack blocks '
        'in the middle of the belly), OBLIQUES (the muscles on the sides of the waist), QUADRICEPS (front thigh muscles)'
    ),
    'dos': (
        'TRAPEZES (trapezius: the leaf-shaped muscles around the neck, the top of the shoulders and the upper spine, down to the middle '
        'of the shoulder blades), EPAULES_ARRIERE (rear deltoids: the rounded muscles at the back of each shoulder joint), TRICEPS (the '
        'muscle bundles on the back of the upper arm, between the shoulder and the elbow), DOS (the wide muscles of the mid back below '
        'the shoulder blades: lats, rhomboids, infraspinatus/teres, on both sides of the spine), LOMBAIRES (lower back: the narrow '
        'muscle strip on each side of the spine just above the waist/shorts), FESSIERS (glutes: the buttocks, i.e. the region inside the '
        'shorts), ISCHIO (hamstrings: the muscles of the back of the thigh, between the shorts and the knee), MOLLETS (calves: the '
        'muscles of the back of the lower leg, from the knee down to the heel)'
    ),
}
consigne = (
    'Image 1 is a cartoon panda bodybuilder seen from the ' + ('front' if vue == 'face' else 'back') + '. '
    'Image 2 is the same picture split into numbered regions bounded by the drawn muscle outlines. '
    'For each numbered region of image 2, say which muscle group it is part of, or "AUCUN" if it is not a muscle '
    '(head, fur, ears, hands/fists, feet, shorts, bra, belt, skin between muscles, background). '
    'Allowed groups: ' + GROUPES[vue] + '. A muscle group usually consists of several regions (left and right sides, sub-parts). '
    'Output a JSON object mapping every region number (as a string) to one group name or "AUCUN". '
    'Include ALL the numbers visible in image 2: ' + ', '.join(str(i) for i, _, _ in ids) + '.'
)
corps_req = {
    'contents': [{'parts': [
        {'inline_data': {'mime_type': 'image/png', 'data': png(fond)}},
        {'inline_data': {'mime_type': 'image/png', 'data': png(annot)}},
        {'text': consigne},
    ]}],
    'generationConfig': {'responseMimeType': 'application/json', 'temperature': 0.1, 'maxOutputTokens': 8000,
                         'thinkingConfig': {'thinkingBudget': 0}},
}
req = urllib.request.Request(API.format(model=modele), json.dumps(corps_req).encode(),
                             {'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']})
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=280) as r:
        data = json.load(r)
except Exception as e:
    log_usage(modele, status='erreur', latency=time.time() - t0, note=str(e)[:200])
    raise SystemExit(f'Erreur : {e}')
u = data.get('usageMetadata', {})
log_usage(modele, u.get('promptTokenCount', 0), u.get('candidatesTokenCount', 0), latency=time.time() - t0, note='heatmap classification des zones')
cand = (data.get('candidates') or [{}])[0]
parts = (cand.get('content') or {}).get('parts') or []
if not parts:
    raise SystemExit('Réponse vide : ' + json.dumps(data, ensure_ascii=False)[:500])
res = json.loads(parts[0].get('text', '{}'))
json.dump(res, open(os.path.join(SP, f'classes_{v}_{vue}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
from collections import Counter
print(v, vue, len(ids), 'zones,', dict(Counter(res.values())), f'{time.time() - t0:.0f}s')
