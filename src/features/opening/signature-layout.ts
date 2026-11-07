import { CAR_IMAGE_SIZE, carRect, rectCenter, type Rect } from '@/features/dashboard/hero-layout';

import { LOGO_VIEWBOX } from './logo-path';

/** Voiture de face (image rognée 1000 × 695). */
export const FRONT_IMAGE_SIZE = { width: 1000, height: 695 } as const;

type Point = { x: number; y: number };

function quadLength(p0: Point, p1: Point, p2: Point): number {
  let length = 0;
  let previous = p0;
  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const q = 1 - t;
    const point = {
      x: q * q * p0.x + 2 * q * t * p1.x + t * t * p2.x,
      y: q * q * p0.y + 2 * q * t * p1.y + t * t * p2.y,
    };
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function cubicLength(p0: Point, p1: Point, p2: Point, p3: Point): number {
  let length = 0;
  let previous = p0;
  for (let i = 1; i <= 40; i++) {
    const t = i / 40;
    const q = 1 - t;
    const point = {
      x: q * q * q * p0.x + 3 * q * q * t * p1.x + 3 * q * t * t * p2.x + t * t * t * p3.x,
      y: q * q * q * p0.y + 3 * q * q * t * p1.y + 3 * q * t * t * p2.y + t * t * t * p3.y,
    };
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

export type SignatureGeometry = {
  /** Scène 1 : deux moitiés d'arc (du centre vers chaque extrémité) et leur longueur. */
  line: { left: { d: string; length: number }; right: { d: string; length: number } };
  /** Scène 2 : voiture de face, centrée. */
  front: Rect;
  /** Scène 3 : emplacement du B (même proportions que le logo) et traînée lumineuse. */
  logo: Rect;
  trail: { d: string; length: number };
  wordmark: { centerX: number; top: number; fontSize: number };
  /** Scène 4 : la voiture en trois-quarts part du centre (même emplacement que la voiture de face) vers le hero. */
  three: { start: Rect; end: Rect };
};

/**
 * Composition de l'introduction aux dimensions réelles de l'écran (repères relevés sur le storyboard : ligne à 57 % de la
 * hauteur, voiture de face entre 51 % et 72 %, B derrière elle à partir de 28 %, traînée qui contourne la voiture vers le sol).
 */
export function signatureGeometry(
  width: number,
  height: number,
  heroHeight: number
): SignatureGeometry {
  const cx = width / 2;
  const lineY = height * 0.57;
  const lineEndY = lineY + height * 0.04;
  const leftEnd = { x: -width * 0.02, y: lineEndY };
  const leftControl = { x: cx - width * 0.28, y: lineY };
  const rightEnd = { x: width * 1.02, y: lineEndY };
  const rightControl = { x: cx + width * 0.28, y: lineY };
  const start = { x: cx, y: lineY };

  const frontWidth = Math.min(width * 0.8, 520);
  const frontHeight = (frontWidth * FRONT_IMAGE_SIZE.height) / FRONT_IMAGE_SIZE.width;
  const frontBottom = height * 0.72;
  const front: Rect = {
    left: cx - frontWidth / 2,
    top: frontBottom - frontHeight,
    width: frontWidth,
    height: frontHeight,
  };

  const logoWidth = Math.min(width * 0.6, 420);
  const logoHeight = (logoWidth * LOGO_VIEWBOX.height) / LOGO_VIEWBOX.width;
  const logo: Rect = {
    left: cx - logoWidth / 2,
    top: height * 0.27,
    width: logoWidth,
    height: logoHeight,
  };

  const trailStart = { x: width * 0.84, y: height * 0.5 };
  const trailC1 = { x: width * 1.0, y: height * 0.62 };
  const trailC2 = { x: width * 0.92, y: height * 0.82 };
  const trailEnd = { x: width * 0.42, y: height * 0.97 };

  const threeStartWidth = Math.min(width * 0.92, 560);
  const threeStartHeight = (threeStartWidth * CAR_IMAGE_SIZE.height) / CAR_IMAGE_SIZE.width;
  const frontCenter = rectCenter(front);
  const threeStart: Rect = {
    left: cx - threeStartWidth / 2,
    top: frontCenter.y - threeStartHeight / 2 + frontHeight * 0.05,
    width: threeStartWidth,
    height: threeStartHeight,
  };

  return {
    line: {
      left: {
        d: `M ${start.x} ${start.y} Q ${leftControl.x} ${leftControl.y} ${leftEnd.x} ${leftEnd.y}`,
        length: quadLength(start, leftControl, leftEnd),
      },
      right: {
        d: `M ${start.x} ${start.y} Q ${rightControl.x} ${rightControl.y} ${rightEnd.x} ${rightEnd.y}`,
        length: quadLength(start, rightControl, rightEnd),
      },
    },
    front,
    logo,
    trail: {
      d: `M ${trailStart.x} ${trailStart.y} C ${trailC1.x} ${trailC1.y} ${trailC2.x} ${trailC2.y} ${trailEnd.x} ${trailEnd.y}`,
      length: cubicLength(trailStart, trailC1, trailC2, trailEnd),
    },
    wordmark: {
      centerX: cx,
      top: logo.top + logoHeight + 14,
      fontSize: Math.round(Math.min(width * 0.1, 44)),
    },
    three: { start: threeStart, end: carRect(width, heroHeight) },
  };
}
