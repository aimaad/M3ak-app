import { CAPTURE_ANGLES, type PhotoAngle } from './types';

export type AngleProgress = {
  capturedAngles: PhotoAngle[];
  remainingAngles: PhotoAngle[];
  nextAngle: PhotoAngle | null;
  isComplete: boolean;
};

/**
 * Calcule l'avancement du guide de capture à partir des angles déjà couverts
 * (photos envoyées + photos en attente d'envoi), dans l'ordre du guide.
 */
export function computeAngleProgress(coveredAngles: PhotoAngle[]): AngleProgress {
  const covered = new Set(coveredAngles);
  const capturedAngles = CAPTURE_ANGLES.filter((angle) => covered.has(angle));
  const remainingAngles = CAPTURE_ANGLES.filter((angle) => !covered.has(angle));

  return {
    capturedAngles,
    remainingAngles,
    nextAngle: remainingAngles[0] ?? null,
    isComplete: remainingAngles.length === 0,
  };
}
