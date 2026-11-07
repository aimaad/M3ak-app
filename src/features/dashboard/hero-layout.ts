/** Dimensions des images du hero : voiture en trois-quarts (rognée) et showroom. */
export const CAR_IMAGE_SIZE = { width: 1100, height: 634 } as const;
export const SHOWROOM_IMAGE_SIZE = { width: 1774, height: 887 } as const;

export type Rect = { left: number; top: number; width: number; height: number };

/**
 * Showroom : couvre tout le hero, calé en bas (le sol et ses reflets restent visibles). `alignX` (0 = bord gauche,
 * 1 = bord droit) choisit la partie de l'image qui reste visible quand le hero est plus étroit que l'image.
 */
export function showroomLayout(width: number, height: number, alignX = 0.42): Rect {
  const scale = Math.max(width / SHOWROOM_IMAGE_SIZE.width, height / SHOWROOM_IMAGE_SIZE.height);
  const w = SHOWROOM_IMAGE_SIZE.width * scale;
  const h = SHOWROOM_IMAGE_SIZE.height * scale;
  return { left: -(w - width) * alignX, top: height - h, width: w, height: h };
}

/** Position définitive de la voiture (trois-quarts) dans le hero : à droite, posée au-dessus du sélecteur de période. */
export function carRect(
  width: number,
  height: number,
  { widthFraction = 0.5, maxWidth = 300, rightMargin = 6, bottomInset = 84 } = {}
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

export function rectCenter(rect: Rect): { x: number; y: number } {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
