"""Génère une pastille de menu avec Gemini (image), style calé sur un panda de référence, fond détouré.
Usage : icone.py <nom> "<description du sujet>" <couleur dominante> [modèle]   (appel journalisé par gemini_suivi)
"""
import base64, io, json, os, sys, time, urllib.request, urllib.error
import cv2
import numpy as np
from PIL import Image
sys.path.insert(0, r'C:\Users\benoi\Documents\Claude\suivi_api')
from gemini_suivi import log_usage, API

SP = os.path.dirname(os.path.abspath(__file__))
nom, sujet, couleur = sys.argv[1:4]
modele = sys.argv[4] if len(sys.argv) > 4 else 'gemini-3.1-flash-image'
REF = os.environ['REF_PANDA']

ref = Image.open(REF).convert('RGBA')
fond = Image.new('RGBA', ref.size, (255, 255, 255, 255))
fond.alpha_composite(ref)
buf = io.BytesIO(); fond.convert('RGB').save(buf, 'PNG')

consigne = (
    'Image 1 is the mascot of a fitness app (a cartoon panda): look closely at its art style (thick dark outline, glossy cartoon shading, '
    'rich saturated colours, friendly look). Create ONE app menu icon in exactly the same art style, showing: ' + sujet + '. '
    'Dominant colour: ' + couleur + ' (with white and dark outline accents). Single centered object, slightly rounded 3D-cartoon look, '
    'no text, no letters, no numbers, no frame, no shadow on the ground. Plain pure white background (#FFFFFF), square 1:1 composition with a small margin.'
)
corps = {
    'contents': [{'parts': [
        {'inline_data': {'mime_type': 'image/png', 'data': base64.b64encode(buf.getvalue()).decode()}},
        {'text': consigne},
    ]}],
    'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'], 'temperature': 0.7},
}
req = urllib.request.Request(API.format(model=modele), json.dumps(corps).encode(),
                             {'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']})
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=280) as r:
        data = json.load(r)
except urllib.error.HTTPError as e:
    detail = e.read().decode('utf-8', 'replace')[:300].replace('\n', ' ')
    log_usage(modele, status=f'http_{e.code}', latency=time.time() - t0, note=detail)
    raise SystemExit(f'Erreur {e.code}: {detail}')
except Exception as e:
    log_usage(modele, status='erreur', latency=time.time() - t0, note=str(e)[:200])
    raise SystemExit(f'Erreur : {e}')
u = data.get('usageMetadata', {})
log_usage(modele, u.get('promptTokenCount', 0), u.get('candidatesTokenCount', 0), latency=time.time() - t0, note='icone menu ' + nom)
parts = ((data.get('candidates') or [{}])[0].get('content') or {}).get('parts') or []
octets = None
for p in parts:
    d = p.get('inlineData') or p.get('inline_data')
    if d:
        octets = base64.b64decode(d['data']); break
if octets is None:
    raise SystemExit('Pas d\'image : ' + json.dumps(data, ensure_ascii=False)[:500])
brut = Image.open(io.BytesIO(octets)).convert('RGB')
brut.save(os.path.join(SP, f'brut_{nom}.png'))

# Détourage : le fond blanc relié aux bords devient transparent (le blanc à l'intérieur du motif reste)
arr = np.array(brut)
h, w = arr.shape[:2]
masque = np.zeros((h + 2, w + 2), np.uint8)
copie = arr.copy()
for (x, y) in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    cv2.floodFill(copie, masque, (x, y), (255, 0, 255), (12, 12, 12), (12, 12, 12), cv2.FLOODFILL_MASK_ONLY | (255 << 8))
fondmask = masque[1:-1, 1:-1] > 0
fondmask = cv2.dilate(fondmask.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0  # mange le liseré blanc
alpha = np.where(fondmask, 0, 255).astype(np.uint8)
alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
rgba = np.dstack([arr, alpha])
ys, xs = np.where(alpha > 20)
rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
im = Image.fromarray(rgba)
cote = max(im.size)
carre = Image.new('RGBA', (cote, cote), (0, 0, 0, 0))
carre.paste(im, ((cote - im.size[0]) // 2, (cote - im.size[1]) // 2))
carre = carre.resize((192, 192), Image.LANCZOS)
carre.save(os.path.join(SP, f'{nom}.png'))
carre.save(os.path.join(SP, f'{nom}.webp'), quality=90, method=6)
print(nom, 'ok', f'{time.time() - t0:.0f}s', 'tokens sortie', u.get('candidatesTokenCount'))
