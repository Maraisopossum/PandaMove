"""Détoure les images brutes (fond blanc) : plage de tolérance FIXE autour du blanc, depuis les quatre coins."""
import glob, os, sys
import cv2
import numpy as np
from PIL import Image
SP = os.path.dirname(os.path.abspath(__file__))
for chemin in sorted(glob.glob(os.path.join(SP, 'brut_*.png'))):
    nom = os.path.basename(chemin)[5:-4]
    arr = np.array(Image.open(chemin).convert('RGB'))
    h, w = arr.shape[:2]
    # Pixels « presque blancs » (fond) reliés aux bords : composantes connexes du masque blanc qui touchent un bord
    blanc = (arr.min(axis=2) >= 238).astype(np.uint8)
    n, etiq = cv2.connectedComponents(blanc, connectivity=4)
    bords = set(np.unique(np.concatenate([etiq[0, :], etiq[-1, :], etiq[:, 0], etiq[:, -1]]))) - {0}
    fondmask = np.isin(etiq, list(bords))
    fondmask = cv2.dilate(fondmask.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
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
    print(nom, 'ok')
