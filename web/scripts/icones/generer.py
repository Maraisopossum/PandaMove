"""Génère les icônes de PandaMove à partir de deux illustrations : le disque du panda à casquette (icône de l'app) et la tête du
panda détourée (silhouette des notifications). À relancer à la main quand une illustration change ; rien ici ne tourne en CI.

  uv run --no-project --with pillow --with numpy --with opencv-python-headless python scripts/icones/generer.py

Sorties dans public/icons/ :
  icon-192.png, icon-512.png     icône « any » : disque sur carré arrondi à coins TRANSPARENTS (onglets, installation, notifications)
  icon-maskable-512.png          icône adaptative : fond plein jusqu'aux bords, disque dans la zone de sécurité (80 %) ; Android la
                                 découpe à la forme de son lanceur, sans plaque blanche ni coins sombres
  icon-monochrome-512.png        silhouette blanche du panda sur fond transparent : icône thématique d'Android
  apple-touch-icon.png           180 px, fond plein (iOS arrondit lui-même, et remplit en noir ce qui est transparent)
  badge-96.png                   petite icône de la barre d'état Android : blanc + transparence seulement (Android la teinte)
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw

RACINE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC_ICONE = os.path.join(RACINE, '..', 'assets', '09_UI_Formats', 'app_icon_v1.png')
SRC_TETE = os.path.join(RACINE, 'public', 'panda', 'pose-standing-male-lg.webp')
SORTIE = os.path.join(RACINE, 'public', 'icons')

# --- Icône colorée : le disque (anneau vert compris) de app_icon_v1, sur un fond de la couleur de l'illustration ----------------
icone = Image.open(SRC_ICONE).convert('RGB')
w = icone.size[0]
CENTRE = w // 2
RAYON = int(w * 0.468)  # bord extérieur de l'anneau vert
# Fond : le noir bleuté de l'illustration (la lueur verte autour de l'anneau déborde sur le bord du carré d'origine : ne pas l'échantillonner)
FOND = (19, 20, 22)
disque = icone.crop((CENTRE - RAYON, CENTRE - RAYON, CENTRE + RAYON, CENTRE + RAYON))
masque_disque = Image.new('L', disque.size, 0)
ImageDraw.Draw(masque_disque).ellipse((0, 0, disque.size[0] - 1, disque.size[1] - 1), fill=255)


def compose(taille, part_disque, arrondi=0.0):
    """Toile `taille`² : fond `FOND` (coins arrondis transparents si `arrondi` > 0) et le disque à `part_disque` de la largeur."""
    s = taille * 4  # dessin sur-échantillonné puis réduit : bords lisses
    toile = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    fond = Image.new('RGBA', (s, s), FOND + (255,))
    if arrondi > 0:
        m = Image.new('L', (s, s), 0)
        ImageDraw.Draw(m).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * arrondi), fill=255)
        toile.paste(fond, (0, 0), m)
    else:
        toile.paste(fond, (0, 0))
    d = int(s * part_disque)
    petit = disque.resize((d, d), Image.LANCZOS).convert('RGBA')
    mp = masque_disque.resize((d, d), Image.LANCZOS)
    toile.paste(petit, ((s - d) // 2, (s - d) // 2), mp)
    return toile.resize((taille, taille), Image.LANCZOS)


def enregistrer(img, nom):
    chemin = os.path.join(SORTIE, nom)
    # Palette (comme les icônes d'origine) : PNG léger ; le transparent est conservé
    img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(chemin, optimize=True)
    print(nom, os.path.getsize(chemin) // 1024, 'Ko')


os.makedirs(SORTIE, exist_ok=True)
enregistrer(compose(512, 0.92, arrondi=0.22), 'icon-512.png')
enregistrer(compose(192, 0.92, arrondi=0.22), 'icon-192.png')
enregistrer(compose(512, 0.80), 'icon-maskable-512.png')  # zone de sécurité des icônes adaptatives : disque de 80 % de large
enregistrer(compose(180, 0.88), 'apple-touch-icon.png')


# --- Silhouette : tête du panda détourée, yeux, nez et bouche en creux ---------------------------------------------------------
def silhouette_tete():
    """Masque 8 bits de la tête (oreilles comprises), plein, avec les taches des yeux, le nez et la bouche évidés."""
    im = np.array(Image.open(SRC_TETE).convert('RGBA'))
    alpha = im[:, :, 3] > 128
    lignes = np.where(alpha.any(axis=1))[0]
    haut = lignes[0]
    # Bas de la tête : la ligne la plus étroite sous les joues, c'est-à-dire entre le menton et les épaules
    largeur = np.array([np.ptp(np.where(alpha[y])[0]) if alpha[y].any() else 0 for y in range(haut, haut + int(im.shape[0] * 0.40))])
    debut, fin = int(len(largeur) * 0.60), int(len(largeur) * 0.80)
    bas = haut + debut + int(np.argmin(largeur[debut:fin]))
    tete = im[haut:bas]
    a = tete[:, :, 3] > 128
    colonnes = np.where(a.any(axis=0))[0]
    tete = tete[:, colonnes[0]:colonnes[-1] + 1]
    a = tete[:, :, 3] > 128
    luma = (0.299 * tete[:, :, 0] + 0.587 * tete[:, :, 1] + 0.114 * tete[:, :, 2])
    clair = (luma > 110) & a  # fourrure, casquette, reflets : tout ce qui n'est pas noir
    # Zone du visage : le plus gros bloc clair, bouché (les taches sombres des yeux y deviennent des trous à évider)
    n, etiq, stats, _ = cv2.connectedComponentsWithStats(clair.astype(np.uint8), connectivity=8)
    plus_gros = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    visage = (etiq == plus_gros).astype(np.uint8)
    visage = cv2.morphologyEx(visage, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    contours, _ = cv2.findContours(visage, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    plein = np.zeros_like(visage)
    cv2.drawContours(plein, contours, -1, 1, thickness=-1)
    # Creux = sombre à l'intérieur du visage, à distance du bord (le trait de contour reste plein)
    interieur = cv2.erode(plein, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    sombre = ((luma < 90) & a).astype(np.uint8)
    creux = sombre & interieur
    creux = cv2.morphologyEx(creux, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))  # traits fins : plein
    n, etiq, stats, _ = cv2.connectedComponentsWithStats(creux, connectivity=8)
    surface_min = a.sum() * 0.004
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < surface_min:
            creux[etiq == i] = 0
    # Silhouette = tête entière sans les creux ; le trait sombre extérieur des oreilles reste plein
    sil = a.astype(np.uint8)
    sil = cv2.morphologyEx(sil, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    sil[creux > 0] = 0
    return (sil * 255).astype(np.uint8)


def en_blanc(masque, taille, marge):
    """Masque -> RGBA blanc + transparence, centré dans une toile carrée avec `marge` (part de la largeur)."""
    h, l = masque.shape
    zone = int(taille * (1 - 2 * marge))
    echelle = zone / max(h, l)
    redim = cv2.resize(masque, (max(1, int(l * echelle)), max(1, int(h * echelle))), interpolation=cv2.INTER_AREA)
    toile = np.zeros((taille, taille), np.uint8)
    y0, x0 = (taille - redim.shape[0]) // 2, (taille - redim.shape[1]) // 2
    toile[y0:y0 + redim.shape[0], x0:x0 + redim.shape[1]] = redim
    rgba = np.zeros((taille, taille, 4), np.uint8)
    rgba[:, :, :3] = 255
    rgba[:, :, 3] = toile
    return Image.fromarray(rgba, 'RGBA')


sil = silhouette_tete()
# Petite icône de notification : 96 px, alpha seul (Android la teinte) ; icône thématique : 512 px, marge plus large (zone de sécurité)
for img, nom in ((en_blanc(sil, 96, 0.06), 'badge-96.png'), (en_blanc(sil, 512, 0.18), 'icon-monochrome-512.png')):
    chemin = os.path.join(SORTIE, nom)
    img.save(chemin, optimize=True)
    print(nom, os.path.getsize(chemin) // 1024, 'Ko')
print('ok', file=sys.stderr)
