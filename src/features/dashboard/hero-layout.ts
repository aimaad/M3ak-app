/** Dimensions des images du hero (voiture détourée et showroom). */
export const CAR_IMAGE_SIZE = { width: 1100, height: 512 } as const;
export const SHOWROOM_IMAGE_SIZE = { width: 1672, height: 941 } as const;

/** Position des phares dans l'image de la voiture (fractions de sa largeur / hauteur). */
export const CAR_LAMPS = {
  near: { x: 0.481, y: 0.497 },
  far: { x: 0.061, y: 0.51 },
} as const;

export type Rect = { left: number; top: number; width: number; height: number };

/**
 * Showroom : couvre tout le hero, aligné à gauche (le trait de lumière en diagonale passe derrière le message de bienvenue)
 * et en bas (le sol reste visible).
 */
export function showroomLayout(width: number, height: number): Rect {
  const scale = Math.max(width / SHOWROOM_IMAGE_SIZE.width, height / SHOWROOM_IMAGE_SIZE.height);
  const w = SHOWROOM_IMAGE_SIZE.width * scale;
  const h = SHOWROOM_IMAGE_SIZE.height * scale;
  return { left: 0, top: height - h, width: w, height: h };
}

/** Position définitive de la voiture dans le hero : à droite, posée au-dessus du sélecteur de période. */
export function carRect(
  width: number,
  height: number,
  { widthFraction = 0.6, maxWidth = 300, rightMargin = 6, bottomInset = 88 } = {}
): Rect {
  // Sur tablette, la voiture garde une taille raisonnable (elle ne passe pas sous les boutons du haut).
  const w = Math.min(width * widthFraction, maxWidth);
  const h = (w * CAR_IMAGE_SIZE.height) / CAR_IMAGE_SIZE.width;
  return {
    left: width - rightMargin - w,
    top: Math.max(0, height - bottomInset - h),
    width: w,
    height: h,
  };
}

/** Position de départ du premier lancement : voiture centrée à l'écran, plus grande que sa place finale. */
export function carStartRect(screenWidth: number, screenHeight: number): Rect {
  const w = Math.min(screenWidth * 0.9, 560);
  const h = (w * CAR_IMAGE_SIZE.height) / CAR_IMAGE_SIZE.width;
  return { left: (screenWidth - w) / 2, top: (screenHeight - h) / 2, width: w, height: h };
}

export function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
