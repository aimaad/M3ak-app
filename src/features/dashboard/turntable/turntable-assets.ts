import type { VideoSource } from 'expo-video';

/**
 * Vidéo 360° de la Mercedes (plateau tournant) posée sur le hero de l'Accueil. TANT QUE `TURNTABLE_VIDEO` VAUT `null`, rien ne
 * change à l'écran : le hero garde sa photo fixe.
 *
 * La vidéo est produite par `.claude/skills/m3ak-car-360` (rendu Blender du vrai modèle 3D, puis `encode_video.sh`) : c'est un
 * MP4 opaque qui contient déjà le décor du hero (la photo SANS voiture, `assets/images/showroom/hero-no-car.jpg`) et la voiture
 * qui tourne. Elle recouvre donc exactement la zone de la photo indiquée par `TURNTABLE_BOX`.
 *
 * Pour l'activer : `export const TURNTABLE_VIDEO = require('../../../../assets/images/showroom/car-turntable.mp4');`
 * (le `require` doit rester littéral : Metro le résout à la compilation).
 */
export const TURNTABLE_VIDEO: VideoSource | null = require('../../../../assets/images/showroom/car-turntable.mp4');

/**
 * Zone de la photo reprise par la vidéo, en fractions de la photo (0 à 1). DOIT être identique au `CROP` utilisé à l'encodage
 * (`encode_video.sh`, variable CROP, par défaut « 0.18,0.28,0.82,0.5 ») : la zone couvre toute l'ancienne voiture.
 */
export const TURNTABLE_BOX = { x: 0.18, y: 0.28, w: 0.82, h: 0.5 } as const;
