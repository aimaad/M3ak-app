/** Dimensions de l'image du hero (`assets/images/hero-m3ak.jpg`), en pixels. */
export const HERO_IMAGE_SIZE = { width: 1040, height: 655 } as const;

/**
 * Voiture dans l'image, en pixels (mesurés sur l'image finale, déjà retournée : la voiture regarde vers la gauche) : bord gauche
 * (pare-chocs avant), bord droit (arrière) et bas des roues.
 */
export const CAR_IN_IMAGE = { left: 259, right: 753, wheelsBottom: 450 } as const;

export type HeroImageLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
};

/**
 * Place l'image dans le hero : la voiture occupe `carWidthFraction` de la largeur, son arrière est à `rightMargin` du bord droit
 * et le bas de ses roues à `wheelsBottomInset` du bas du hero (au-dessus du sélecteur de période). La partie gauche de l'image
 * (cloison sombre) passe derrière le texte ; ce qui dépasse à droite ou en haut est rogné par le hero.
 */
export function heroImageLayout(
  width: number,
  height: number,
  options: { carWidthFraction?: number; rightMargin?: number; wheelsBottomInset?: number } = {}
): HeroImageLayout {
  const { carWidthFraction = 0.58, rightMargin = 10, wheelsBottomInset = 96 } = options;
  const scale = (carWidthFraction * width) / (CAR_IN_IMAGE.right - CAR_IN_IMAGE.left);
  return {
    scale,
    width: HERO_IMAGE_SIZE.width * scale,
    height: HERO_IMAGE_SIZE.height * scale,
    left: width - rightMargin - CAR_IN_IMAGE.right * scale,
    top: height - wheelsBottomInset - CAR_IN_IMAGE.wheelsBottom * scale,
  };
}

/** Convertit un point de l'image (pixels) en point du hero (dp), pour y poser lueurs et logo au bon endroit. */
export function imagePointToHero(
  layout: HeroImageLayout,
  x: number,
  y: number
): { x: number; y: number } {
  return { x: layout.left + x * layout.scale, y: layout.top + y * layout.scale };
}
