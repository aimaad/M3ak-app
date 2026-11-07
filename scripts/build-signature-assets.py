#!/usr/bin/env python3
"""
Prépare les images du scénario d'ouverture « Signature Ignition » à partir des fichiers fournis (voiture noire de face
phares allumés / éteints, voiture en trois-quarts phares allumés, showroom) et le tracé vectoriel du logo BIBIP.

- Voiture de face : les deux fichiers fournis sont deux rendus légèrement différents. La version « phares éteints » est
  recalée sur la version « phares allumés » (alignement affine), puis seules les zones des phares sont reprises : les deux
  images sont ainsi identiques partout sauf sur les phares (aucun « changement de voiture » pendant le fondu).
- Tracé du B : contour exact du logo fourni (masque de transparence), pour l'animation « la lumière dessine le B ».
  Le logo lui-même n'est pas modifié.

Usage : python3 scripts/build-signature-assets.py <dossier des images fournies>
  attend : front-lit.webp, front-unlit.webp, three-quarter-lit.webp, showroom.webp
Dépendances : Pillow, NumPy, opencv-python-headless.
"""
import base64
import io
import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets/images/signature'
SVG = ROOT / 'assets/branding/BIBIP_logo_exact.svg'


def premult_resize(image: Image.Image, width: int) -> Image.Image:
    size = (width, round(image.height * width / image.width))
    return image.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


def crop_box(alpha: np.ndarray, margin: int):
    ys, xs = np.where(alpha > 8)
    return xs.min() - margin, ys.min() - margin, xs.max() + 1 + margin, ys.max() + 1 + margin


def edges(array: np.ndarray, cap: float = 0.5) -> np.ndarray:
    gray = cv2.cvtColor(array[..., :3].astype(np.float32) / 255, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(np.minimum(gray, cap), (0, 0), 1.5)
    return cv2.magnitude(cv2.Sobel(gray, cv2.CV_32F, 1, 0), cv2.Sobel(gray, cv2.CV_32F, 0, 1))


def register_unlit(lit: np.ndarray, unlit: np.ndarray) -> np.ndarray:
    def bbox(a):
        ys, xs = np.where(a[..., 3] > 20)
        return xs.min(), ys.min(), xs.max(), ys.max()
    bl, bu = bbox(lit), bbox(unlit)
    sx = (bl[2] - bl[0]) / (bu[2] - bu[0])
    sy = (bl[3] - bl[1]) / (bu[3] - bu[1])
    warp = np.array([[1 / sx, 0, bu[0] - bl[0] / sx], [0, 1 / sy, bu[1] - bl[1] / sy]], np.float32)
    _, warp = cv2.findTransformECC(edges(lit), edges(unlit), warp, cv2.MOTION_AFFINE,
                                   (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7), None, 7)
    h, w = lit.shape[:2]
    return cv2.warpAffine(unlit, warp, (w, h), flags=cv2.INTER_LANCZOS4 + cv2.WARP_INVERSE_MAP,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))


def lamps_off(lit: np.ndarray, reg: np.ndarray) -> np.ndarray:
    """Version « phares éteints » : base = voiture phares allumés, avec les phares repris de l'autre rendu."""
    out = lit.astype(np.float32).copy()
    lamps = {'L': ((130, 520, 420, 700), ((250, 612), (250, 110), 12)),
             'R': ((890, 520, 1180, 700), ((1040, 612), (250, 110), -12))}
    for box, ellipse in lamps.values():
        x0, y0, x1, y1 = box
        a = cv2.magnitude(*(cv2.Sobel(np.minimum(cv2.cvtColor(lit[y0:y1, x0:x1, :3].astype(np.float32) / 255, cv2.COLOR_RGB2GRAY), 0.45), cv2.CV_32F, d, 1 - d) for d in (1, 0)))
        b = cv2.magnitude(*(cv2.Sobel(np.minimum(cv2.cvtColor(reg[y0:y1, x0:x1, :3].astype(np.float32) / 255, cv2.COLOR_RGB2GRAY), 0.45), cv2.CV_32F, d, 1 - d) for d in (1, 0)))
        warp = np.eye(2, 3, dtype=np.float32)
        _, warp = cv2.findTransformECC(a, b, warp, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 300, 1e-7), None, 5)
        patch = cv2.warpAffine(reg[y0:y1, x0:x1].astype(np.float32), warp, (x1 - x0, y1 - y0),
                               flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REPLICATE)
        block = lit[y0:y1, x0:x1, :3].astype(np.float32)
        lum = (0.3 * block[..., 0] + 0.59 * block[..., 1] + 0.11 * block[..., 2]) / 255
        mask = cv2.morphologyEx((lum > 0.38).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        mask = cv2.dilate(mask, np.ones((7, 7), np.uint8))
        zone = np.zeros_like(mask)
        (cx, cy), axes, angle = ellipse
        cv2.ellipse(zone, ((cx - x0, cy - y0), axes, angle), 1, -1)
        soft = cv2.GaussianBlur((mask * zone).astype(np.float32), (0, 0), 3.0)[..., None]
        out[y0:y1, x0:x1, :3] = block * (1 - soft) + patch[..., :3] * soft
    return np.clip(out, 0, 255).astype(np.uint8)


def logo_paths():
    """Contours exacts du logo (coordonnées du logo rogné, mêmes que logo-bibip.png) + longueurs, en TypeScript."""
    png = base64.b64decode(re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)', SVG.read_text(encoding='utf8')).group(1))
    original = Image.open(io.BytesIO(png)).convert('RGBA')
    alpha = np.array(original)[..., 3]
    ys, xs = np.where(alpha > 8)
    margin = 16
    x0, y0 = max(xs.min() - margin, 0), max(ys.min() - margin, 0)
    x1, y1 = min(xs.max() + 1 + margin, original.width), min(ys.max() + 1 + margin, original.height)
    mask = (alpha[y0:y1, x0:x1] > 128).astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    paths = []
    for contour in sorted(contours, key=cv2.contourArea, reverse=True):
        if cv2.contourArea(contour) < 400:
            continue
        points = cv2.approxPolyDP(contour, 0.7, True)[:, 0, :].astype(float)
        closed = np.vstack([points, points[:1]])
        length = float(np.sum(np.hypot(*(np.diff(closed, axis=0).T))))
        d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in points) + ' Z'
        paths.append({'d': d, 'length': round(length, 1)})
    return (x1 - x0, y1 - y0), paths


def main(src: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lit = np.array(Image.open(src / 'front-lit.webp').convert('RGBA'))
    unlit = np.array(Image.open(src / 'front-unlit.webp').convert('RGBA'))
    off = lamps_off(lit, register_unlit(lit, unlit))
    box = crop_box(lit[..., 3], 6)
    for name, array in (('front-lit', lit), ('front-unlit', off)):
        image = Image.fromarray(array, 'RGBA').crop(box)
        image = premult_resize(image, 1000)
        image.save(OUT / f'{name}.webp', 'WEBP', quality=90, method=6)
        print(name, image.size)
    three = Image.open(src / 'three-quarter-lit.webp').convert('RGBA')
    three = three.crop(crop_box(np.array(three)[..., 3], 6))
    three = premult_resize(three, 1100)
    three.save(OUT / 'three-quarter.webp', 'WEBP', quality=90, method=6)
    print('three-quarter', three.size)
    Image.open(src / 'showroom.webp').convert('RGB').save(OUT / 'showroom.webp', 'WEBP', quality=82, method=6)
    size, paths = logo_paths()
    ts = ['// Généré par scripts/build-signature-assets.py : contours exacts du logo BIBIP fourni (ne pas modifier à la main).',
          f'export const LOGO_VIEWBOX = {{ width: {size[0]}, height: {size[1]} }} as const;',
          'export const LOGO_PATHS: readonly { d: string; length: number }[] = ' + json.dumps(paths, ensure_ascii=False) + ';', '']
    (ROOT / 'src/features/opening/logo-path.ts').write_text('\n'.join(ts), encoding='utf8')
    print('tracé du logo :', size, [(len(p['d']), p['length']) for p in paths])


if __name__ == '__main__':
    main(Path(sys.argv[1]))
