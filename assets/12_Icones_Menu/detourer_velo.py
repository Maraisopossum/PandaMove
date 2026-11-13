"""Régénère la pastille du vélo : fond extérieur ET blanc enclavé « vide » (cadre, guidon) transparents ; cellules des roues et reflets peints restent blancs."""
import sys
import cv2
import numpy as np
from PIL import Image

src, sortie, apercu = sys.argv[1:4]
arr = np.array(Image.open(src).convert('RGB'))
luma = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
blanc = (arr.min(axis=2) >= 238).astype(np.uint8)
n, etiq, stats, cent = cv2.connectedComponentsWithStats(blanc, connectivity=4)
bords = set(np.unique(np.concatenate([etiq[0, :], etiq[-1, :], etiq[:, 0], etiq[:, -1]]))) - {0}
enclaves = [i for i in range(1, n) if i not in bords and stats[i, cv2.CC_STAT_AREA] >= 150]
cellules = [i for i in enclaves if 2000 <= stats[i, cv2.CC_STAT_AREA] <= 4200]


def cercle(ids):
    ys, xs = np.where(np.isin(etiq, ids))
    (cx, cy), r = cv2.minEnclosingCircle(np.stack([xs, ys], 1).astype(np.float32))
    return cx, cy, r


roues = [cercle([i for i in cellules if cent[i][0] < 512]), cercle([i for i in cellules if cent[i][0] >= 512])]
PEDALIER = (473, 690)  # centre du plateau sur la source 1024 px
COINS_TUBE_DE_SELLE = [(389, 503), (359, 428)]
vide = np.isin(etiq, list(bords))
for i in enclaves:
    cx, cy = cent[i]
    coin_selle = any(((cx - x) ** 2 + (cy - y) ** 2) ** 0.5 < 15 for x, y in COINS_TUBE_DE_SELLE)
    if i in cellules and not coin_selle:
        continue
    # Pédalier : ses ajours restent blancs (on voit la roue derrière)
    if ((cx - PEDALIER[0]) ** 2 + (cy - PEDALIER[1]) ** 2) ** 0.5 < 90:
        continue
    # Intérieur d'une roue (entre les rayons, jusqu'au pneu) : blanc, sauf les deux coins entre le tube de selle et le pneu arrière
    # (centroïdes relevés sur la source 1024 px) : transparents
    dans_roue = any(((cx - c[0]) ** 2 + (cy - c[1]) ** 2) ** 0.5 < c[2] * 0.97 for c in roues)
    if dans_roue and not coin_selle:
        continue
    m = (etiq == i).astype(np.uint8)
    anneau = cv2.dilate(m, np.ones((7, 7), np.uint8)) & (1 - m)
    if (luma[anneau > 0] < 95).mean() >= 0.75:
        vide |= m > 0
fond = cv2.dilate(vide.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
alpha = np.where(fond, 0, 255).astype(np.uint8)
alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
ys, xs = np.where(alpha > 20)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
cote = max(x1 - x0, y1 - y0)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
rgba = np.dstack([arr, alpha])
toile = np.zeros((cote, cote, 4), np.uint8)
h, w = rgba.shape[:2]
ox, oy = cote // 2 - cx, cote // 2 - cy
for (dy0, dy1) in [(max(0, oy), min(cote, h + oy))]:
    for (dx0, dx1) in [(max(0, ox), min(cote, w + ox))]:
        toile[dy0:dy1, dx0:dx1] = rgba[dy0 - oy:dy1 - oy, dx0 - ox:dx1 - ox]
img = Image.fromarray(toile, 'RGBA').resize((192, 192), Image.LANCZOS)
img.save(sortie, quality=90, method=6)
# Aperçu sur fond teinté et fond sombre
fonds = [(255, 255, 255), (2, 119, 189), (20, 20, 22)]
bande = Image.new('RGB', (192 * 3, 192))
for k, c in enumerate(fonds):
    f = Image.new('RGBA', (192, 192), c + (255,))
    f.alpha_composite(img)
    bande.paste(f.convert('RGB'), (192 * k, 0))
bande.resize((192 * 3 * 2, 384), Image.NEAREST).save(apercu)
print('ok', len([1 for _ in enclaves]))
