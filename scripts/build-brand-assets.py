#!/usr/bin/env python3
"""
Génère les fichiers image de la marque BIBIP à partir du logo officiel `assets/branding/BIBIP_logo_exact.svg`.

Règle absolue : le logo n'est JAMAIS modifié (formes, couleurs, dégradés, transparence). Ce script ne fait que :
  - extraire le PNG intégré dans le SVG (octets identiques) ;
  - rogner les marges totalement transparentes (aucun pixel modifié) ;
  - redimensionner (mêmes couleurs, rendu plus petit) pour les usages de l'app, l'icône, l'écran de démarrage, le favicon ;
  - poser le logo sur le fond ivoire (icône iOS, qui n'a pas de transparence) ou sur fond transparent (Android, splash).
La silhouette « monochrome » d'Android 13 est exigée par le système (icône thématique) : c'est le masque de transparence du
logo, pas une version recolorée du logo affichée dans l'app.

Usage (depuis la racine du projet) :  python3 scripts/build-brand-assets.py
Dépendances : Pillow, NumPy.
"""
import base64
import hashlib
import re
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / 'assets/branding/BIBIP_logo_exact.svg'
OUT = ROOT / 'assets/images'
IVORY = (250, 248, 241, 255)  # #FAF8F1


def extract_png() -> bytes:
    match = re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)', SVG.read_text(encoding='utf8'))
    if not match:
        raise SystemExit('Aucun PNG intégré dans le SVG du logo.')
    return base64.b64decode(match.group(1))


def resize_premultiplied(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Redimensionne sans frange sombre sur les bords transparents."""
    return image.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def fit(image: Image.Image, width: int) -> Image.Image:
    return resize_premultiplied(image, (width, round(image.height * width / image.width)))


def on_canvas(logo: Image.Image, canvas: int, fraction: float, background) -> Image.Image:
    """Centre le logo (largeur = fraction de la toile) sur un fond uni ou transparent."""
    sized = fit(logo, round(canvas * fraction))
    sized = sized if sized.height <= canvas * fraction else resize_premultiplied(
        logo, (round(logo.width * canvas * fraction / logo.height), round(canvas * fraction))
    )
    layer = Image.new('RGBA', (canvas, canvas), background)
    layer.alpha_composite(sized, ((canvas - sized.width) // 2, (canvas - sized.height) // 2))
    return layer


def main() -> None:
    png = extract_png()
    print('PNG du logo :', len(png), 'octets, sha256', hashlib.sha256(png).hexdigest())
    original = Image.open(__import__('io').BytesIO(png)).convert('RGBA')
    alpha = np.array(original)[..., 3]
    # Le PNG contient quelques pixels quasi invisibles (opacité ≤ 3 %) jusque dans les coins : on rogne autour du logo visible,
    # avec une marge, sans modifier aucun pixel conservé.
    ys, xs = np.where(alpha > 8)
    margin = 16
    box = (max(xs.min() - margin, 0), max(ys.min() - margin, 0), min(xs.max() + 1 + margin, original.width), min(ys.max() + 1 + margin, original.height))
    logo = original.crop(box)
    print('Logo rogné :', logo.size)

    fit(logo, 640).save(OUT / 'logo-bibip.png', optimize=True)

    # Icône de l'app (iOS : pas de transparence → fond ivoire).
    on_canvas(logo, 1024, 0.72, IVORY).convert('RGB').save(OUT / 'icon.png', optimize=True)
    # Android adaptatif : premier plan transparent (zone de sécurité ≈ 66 %), fond ivoire uni.
    on_canvas(logo, 1024, 0.60, (0, 0, 0, 0)).save(OUT / 'android-icon-foreground.png', optimize=True)
    Image.new('RGB', (1024, 1024), IVORY[:3]).save(OUT / 'android-icon-background.png', optimize=True)
    # Android 13 « icône thématique » : silhouette (masque de transparence) exigée par le système.
    foreground = on_canvas(logo, 432, 0.60, (0, 0, 0, 0))
    mask = np.array(foreground)[..., 3]
    mono = np.zeros((432, 432, 4), dtype=np.uint8)
    mono[..., :3] = 255
    mono[..., 3] = mask
    Image.fromarray(mono, 'RGBA').save(OUT / 'android-icon-monochrome.png', optimize=True)
    # Écran de démarrage (fond ivoire posé par app.json) et favicon : logo sur fond transparent.
    fit(logo, 1024).save(OUT / 'splash-icon.png', optimize=True)
    on_canvas(logo, 192, 0.96, (0, 0, 0, 0)).save(OUT / 'favicon.png', optimize=True)
    print('Fichiers écrits dans', OUT)


if __name__ == '__main__':
    main()
