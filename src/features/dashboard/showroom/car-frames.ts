import type { ImageSourcePropType } from 'react-native';

/**
 * Ressources de l'animation « showroom » de la voiture du hero. TANT QUE CES DEUX CONSTANTES SONT VIDES, l'animation est
 * désactivée et le hero garde sa photo fixe actuelle (rien ne change à l'écran).
 *
 * Fichiers à fournir (voir docs/SHOWROOM.md pour le détail) :
 *  - `assets/images/showroom/car-00.webp` … `car-24.webp` : la même voiture photographiée (ou rendue) sous 25 angles, de −8° à
 *    +8° (la 13e image, `car-12`, est à 0°), fond transparent, mêmes cadrage et lumière que la photo actuelle ;
 *  - `assets/images/showroom/hero-no-car.jpg` : la photo actuelle (bâtiment + coucher de soleil + sol) SANS la voiture, aux
 *    mêmes dimensions (1000 × 1094) que `hero-dashboard.jpg`.
 *
 * Une fois les fichiers ajoutés, remplacer les valeurs ci-dessous. Les `require` doivent rester littéraux (Metro les résout à
 * la compilation), d'où la liste écrite en toutes lettres :
 *
 *   export const CAR_FRAMES = [require('../../../../assets/images/showroom/car-00.webp'), …, require('…/car-24.webp')];
 *   export const HERO_BACKGROUND_NO_CAR = require('../../../../assets/images/showroom/hero-no-car.jpg');
 */
export const CAR_FRAMES: ImageSourcePropType[] = [];

export const HERO_BACKGROUND_NO_CAR: ImageSourcePropType | null = null;

/**
 * Emplacement de la voiture dans la photo, en fractions de la photo (0 à 1) : à ajuster quand les vraies images arrivent.
 * Valeurs mesurées sur la photo actuelle ; le rapport largeur/hauteur des images de la séquence doit valoir
 * `(w × largeur) / (h × hauteur)` de la photo, soit environ 2,4 (par exemple 720 × 300 px).
 */
export const CAR_BOX = { x: 0.29, y: 0.4116, w: 0.6755, h: 0.2591 } as const;
