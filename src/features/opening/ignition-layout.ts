/** Les deux photos de l'ouverture (paysage, mêmes dimensions et même cadrage : seule la lumière change). */
export const IGNITION_IMAGE = { width: 1671, height: 941 } as const;

/** Partie utile de la photo (en pixels de la photo) : la voiture et ses faisceaux ; le reste est du noir. */
const CROP = { x0: 230, x1: 1441 } as const;
/** Centre de la voiture dans la photo (fraction de la hauteur) et sa position à l'écran (fraction de la hauteur de l'écran). */
const CAR_CENTER_Y = 0.52;
const SCREEN_CENTER_Y = 0.46;

export type IgnitionLayout = {
  /** Emplacement de la photo entière (déborde de l'écran à gauche et à droite : c'est du noir). */
  frame: { left: number; top: number; width: number; height: number };
  /** Fondus vers le noir en haut et en bas de la photo (pas de bord net). */
  topFade: { top: number; height: number };
  bottomFade: { top: number; height: number };
};

/**
 * Photo paysage dans un écran portrait : la partie utile est ajustée à la largeur de l'écran, centrée sur la voiture, sur fond
 * noir ; le haut et le bas de la photo se fondent dans le noir.
 */
export function ignitionLayout(width: number, height: number): IgnitionLayout {
  const scale = Math.min(width / (CROP.x1 - CROP.x0), (height * 0.9) / IGNITION_IMAGE.height);
  const w = IGNITION_IMAGE.width * scale;
  const h = IGNITION_IMAGE.height * scale;
  // La partie utile est centrée horizontalement.
  const left = (width - (CROP.x1 - CROP.x0) * scale) / 2 - CROP.x0 * scale;
  const top = height * SCREEN_CENTER_Y - CAR_CENTER_Y * h;
  return {
    frame: { left, top, width: w, height: h },
    // Les fondus débordent de 2 px de chaque côté : aucune ligne de la photo ne reste visible au bord.
    topFade: { top: top - 2, height: h * 0.12 + 2 },
    bottomFade: { top: top + h * 0.7, height: h * 0.3 + 2 },
  };
}
