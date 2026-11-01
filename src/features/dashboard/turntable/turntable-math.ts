export type FractionBox = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

/** Emplacement en points (dp) de la vidéo dans le cadre de la photo, à partir de la zone en fractions de la photo. */
export function turntableLayout(imageWidth: number, imageHeight: number, box: FractionBox) {
  return {
    left: box.x * imageWidth,
    top: box.y * imageHeight,
    width: box.w * imageWidth,
    height: box.h * imageHeight,
  };
}

/** La vidéo n'est utilisée que si un fichier est fourni ; sinon (aujourd'hui) le hero garde la photo fixe. */
export function isTurntableAvailable(source: unknown): boolean {
  // Le `require` d'un fichier renvoie un numéro d'asset sur mobile, mais peut renvoyer une URL ou un objet sur le web.
  return source !== null && source !== undefined && source !== '' && source !== 0;
}

/**
 * La zone doit tenir dans la photo : sinon la vidéo déborderait ou serait mal placée. Les proportions de la zone (en pixels de
 * la photo) doivent aussi être celles de la vidéo, sinon l'image serait étirée.
 */
export function isBoxValid(
  box: FractionBox,
  photoWidth: number,
  photoHeight: number,
  videoWidth: number,
  videoHeight: number
): boolean {
  const inside =
    box.x >= 0 &&
    box.y >= 0 &&
    box.w > 0 &&
    box.h > 0 &&
    box.x + box.w <= 1.0001 &&
    box.y + box.h <= 1.0001;
  const boxRatio = (box.w * photoWidth) / (box.h * photoHeight);
  const videoRatio = videoWidth / videoHeight;
  return inside && Math.abs(boxRatio - videoRatio) / videoRatio < 0.02;
}
