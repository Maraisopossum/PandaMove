"""Planches de légende : chaque zone fermée du dessin est colorée selon son muscle et porte son numéro ; la légende liste
muscle -> numéros de zones. Écrit legende_<variante>_<vue>.png et legendes.json (muscle -> numéros, par image)."""
import json, os, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SP = os.path.dirname(os.path.abspath(__file__))
SORTIE = sys.argv[1]
WEBP = os.environ['HEATMAP_WEBP']
exec(open(os.path.join(SP, 'corrections.py'), encoding='utf-8').read())

LIBELLES = {
    'PECTORAUX': 'Pectoraux', 'EPAULES': 'Épaules', 'BICEPS': 'Biceps', 'AVANT_BRAS': 'Avant-bras', 'ABDOMINAUX': 'Abdominaux',
    'OBLIQUES': 'Obliques', 'QUADRICEPS': 'Quadriceps', 'TRAPEZES': 'Trapèzes', 'TRICEPS': 'Triceps', 'DOS': 'Dos (dorsaux)',
    'LOMBAIRES': 'Lombaires', 'FESSIERS': 'Fessiers', 'ISCHIO': 'Ischio-jambiers', 'MOLLETS': 'Mollets',
}
COULEURS = {
    'PECTORAUX': (239, 108, 0), 'EPAULES': (63, 81, 181), 'BICEPS': (46, 160, 67), 'AVANT_BRAS': (216, 27, 96), 'ABDOMINAUX': (0, 137, 123),
    'OBLIQUES': (123, 31, 162), 'QUADRICEPS': (200, 70, 200), 'TRAPEZES': (46, 160, 67), 'TRICEPS': (216, 27, 96), 'DOS': (63, 81, 181),
    'LOMBAIRES': (239, 108, 0), 'FESSIERS': (123, 31, 162), 'ISCHIO': (0, 137, 123), 'MOLLETS': (200, 70, 200),
}
police = lambda t: ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', t)
police_n = lambda t: ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', t)
TITRES = {('male', 'face'): 'Homme, de face', ('male', 'dos'): 'Homme, de dos', ('female', 'face'): 'Femme, de face', ('female', 'dos'): 'Femme, de dos'}
resume = {}
for v in ('male', 'female'):
    for vue in ('face', 'dos'):
        im = Image.open(WEBP.replace('{v}', v).replace('{vue}', vue)).convert('RGBA')
        fond = Image.new('RGBA', im.size, (255, 255, 255, 255))
        fond.alpha_composite(im)
        base = np.array(fond.convert('RGB'))
        etiq = np.load(os.path.join(SP, f'etiq_{v}_{vue}.npy'))
        # Même alias que assembler.py : l'arrière des épaules (vue de dos) compte comme épaules
        classes = {int(k): {'EPAULES_ARRIERE': 'EPAULES'}.get(g, g)
                   for k, g in json.load(open(os.path.join(SP, f'classes_{v}_{vue}.json'), encoding='utf-8')).items()}
        classes.update(CORRECTIONS.get((v, vue), {}))
        ymax = LIMITES_Y.get((v, vue), {})
        calque = base.copy()
        par_groupe = {}
        for i, g in classes.items():
            if g not in COULEURS:
                continue
            reg = etiq == i
            if g in ymax:
                reg = reg.copy(); reg[ymax[g]:, :] = False
            if reg.sum() < 40:
                continue
            par_groupe.setdefault(g, []).append(i)
            calque[reg] = (0.35 * base[reg] + 0.65 * np.array(COULEURS[g])).astype(np.uint8)
        calque_pil = Image.fromarray(calque)
        dr = ImageDraw.Draw(calque_pil)
        for g, nums in par_groupe.items():
            for i in nums:
                reg = (etiq == i).astype(np.uint8)
                d = cv2.distanceTransform(reg, cv2.DIST_L2, 3)
                y, x = np.unravel_index(np.argmax(d), d.shape)
                if g in ymax:
                    y = min(y, ymax[g] - 8)
                t = str(i)
                w = dr.textlength(t, font=police(15))
                dr.rounded_rectangle((x - w / 2 - 3, y - 11, x + w / 2 + 3, y + 10), radius=5, fill=(255, 255, 255), outline=COULEURS[g])
                dr.text((x - w / 2, y - 10), t, fill=(20, 20, 20), font=police(15))
        # Planche : image à gauche, légende à droite
        L, H = 600, 900
        feuille = Image.new('RGB', (L + 380, H), (255, 255, 255))
        feuille.paste(calque_pil, (0, 0))
        d2 = ImageDraw.Draw(feuille)
        d2.text((L + 24, 24), TITRES[(v, vue)], fill=(20, 20, 20), font=police(26))
        d2.text((L + 24, 62), 'Zones du dessin numérotées, colorées par muscle', fill=(90, 90, 100), font=police_n(14))
        y = 110
        for g in LIBELLES:
            if g not in par_groupe:
                continue
            d2.rounded_rectangle((L + 24, y + 2, L + 52, y + 30), radius=7, fill=COULEURS[g])
            d2.text((L + 64, y), LIBELLES[g], fill=(20, 20, 20), font=police(18))
            texte = 'zones ' + ', '.join(str(n) for n in sorted(par_groupe[g]))
            lignes, cour = [], ''
            for mot in texte.split(' '):
                essai = (cour + ' ' + mot).strip()
                if d2.textlength(essai, font=police_n(13)) > 290 and cour:
                    lignes.append(cour); cour = mot
                else:
                    cour = essai
            lignes.append(cour)
            for k, l in enumerate(lignes):
                d2.text((L + 64, y + 24 + 17 * k), l, fill=(90, 90, 100), font=police_n(13))
            y += 40 + 17 * len(lignes)
        feuille.save(os.path.join(SORTIE, f'legende_{v}_{vue}.png'))
        resume[f'{v}_{vue}'] = {LIBELLES[g]: sorted(n) for g, n in par_groupe.items()}
json.dump(resume, open(os.path.join(SORTIE, 'legendes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', {k: len(v) for k, v in resume.items()})
