#!/usr/bin/env python3
"""
Génère les icônes de la marque BIBIP à partir de la géométrie du symbole (celle de `assets/images/bibip-symbole-*.svg`) :
un « b » (trait + cercle) et deux ondes sonores orange, dans un cadre de 124 × 124 (viewBox « -0.25 -7.3 124 124 »).

  - icon.png                    : fond graphite #202527, « b » blanc, ondes orange, symbole ≈ 60 % de la largeur ;
  - android-icon-foreground.png : même symbole sur fond transparent (zone de sécurité adaptative) ;
  - android-icon-background.png : aplat graphite #202527 ;
  - android-icon-monochrome.png : symbole entier en une seule couleur (Android 13, icône thématique) ;
  - splash-icon.png             : petit symbole blanc + ondes orange sur fond transparent ;
  - favicon.png                 : symbole sur fond graphite.

Usage (depuis la racine du projet) :  python3 scripts/build-brand-assets.py      Dépendances : Pillow.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/images'
GRAPHITE = (32, 37, 39, 255)  # #202527
ORANGE = (202, 83, 29, 255)  # #CA531D
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

# Géométrie du symbole (unités du viewBox). Boîte englobante du dessin, traits compris.
BBOX = (11.5, 1.5, 112.0, 107.9)
CX, CY = 46.0, 64.0
SS = 4  # suréchantillonnage


def draw_symbol(canvas: int, width_fraction: float, body, waves, background) -> Image.Image:
    """Dessine le symbole centré, sa largeur occupant `width_fraction` de la toile."""
    big = canvas * SS
    k = big * width_fraction / (BBOX[2] - BBOX[0])  # pixels par unité
    ox = big / 2 - k * (BBOX[0] + BBOX[2]) / 2
    oy = big / 2 - k * (BBOX[1] + BBOX[3]) / 2
    img = Image.new('RGBA', (big, big), background)
    d = ImageDraw.Draw(img)

    def p(x, y):
        return ox + k * x, oy + k * y

    def disc(x, y, r, fill):
        px, py = p(x, y)
        d.ellipse((px - r * k, py - r * k, px + r * k, py + r * k), fill=fill)

    # « b » : trait vertical à bouts ronds + cercle (anneau).
    d.line((*p(18, 8), *p(18, 92)), fill=body, width=round(13 * k))
    disc(18, 8, 6.5, body)
    disc(18, 92, 6.5, body)
    r_out, r_in = 26 + 6.5, 26 - 6.5
    px, py = p(46, 64)
    d.ellipse((px - r_out * k, py - r_out * k, px + r_out * k, py + r_out * k), fill=body)
    d.ellipse((px - r_in * k, py - r_in * k, px + r_in * k, py + r_in * k), fill=background)
    # Deux ondes : arcs de ±40° autour du centre du cercle, bouts ronds.
    for radius in (46, 62):
        box = (*p(CX - radius, CY - radius), *p(CX + radius, CY + radius))
        d.arc(box, -40, 40, fill=waves, width=round(8 * k))
        for sign in (-1, 1):
            a = math.radians(40 * sign)
            disc(CX + radius * math.cos(a), CY + radius * math.sin(a), 4, waves)
    return img.resize((canvas, canvas), Image.LANCZOS)


def main() -> None:
    draw_symbol(1024, 0.60, WHITE, ORANGE, GRAPHITE).convert('RGB').save(OUT / 'icon.png', optimize=True)
    draw_symbol(1024, 0.40, WHITE, ORANGE, CLEAR).save(OUT / 'android-icon-foreground.png', optimize=True)
    Image.new('RGB', (1024, 1024), GRAPHITE[:3]).save(OUT / 'android-icon-background.png', optimize=True)
    draw_symbol(432, 0.40, WHITE, WHITE, CLEAR).save(OUT / 'android-icon-monochrome.png', optimize=True)
    draw_symbol(1024, 0.80, WHITE, ORANGE, CLEAR).save(OUT / 'splash-icon.png', optimize=True)
    draw_symbol(192, 0.80, WHITE, ORANGE, GRAPHITE).convert('RGB').save(OUT / 'favicon.png', optimize=True)
    print('Icônes écrites dans', OUT)


if __name__ == '__main__':
    main()
