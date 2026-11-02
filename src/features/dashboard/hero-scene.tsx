import { Image, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { M3akPalette } from '@/constants/theme';
import { markAssetReady, openingTime } from '@/features/opening/opening-store';
import { FIRST, type OpeningMode } from '@/features/opening/opening-timeline';

import { CarLights } from './car-lights';
import { carRect, showroomLayout } from './hero-layout';

/** Showroom violet sombre, sans voiture (la voiture est un calque séparé : voir `HeroCar`). */
const SHOWROOM = require('../../../assets/images/ignition/showroom.webp');

export const HERO_DARK = '#171126';
/** Fondu du bas du hero vers la couleur de la page : pas de bord net. */
export const HERO_FADE_HEIGHT = 26;
/** Parallaxe : décalage maximal du décor (dp) sur 220 dp de défilement, dans le sens inverse du contenu. */
const PARALLAX_MAX = 14;
const PARALLAX_RANGE = 220;

function useParallax(scrollY: SharedValue<number> | undefined, reduceMotion: boolean) {
  return useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          reduceMotion || !scrollY
            ? 0
            : interpolate(
                scrollY.value,
                [0, PARALLAX_RANGE],
                [0, PARALLAX_MAX],
                Extrapolation.CLAMP
              ),
      },
    ],
  }));
}

/**
 * Décor du hero : le showroom et les voiles qui garantissent la lisibilité (gauche pour le texte, haut pour les boutons, bas
 * pour le sélecteur) puis le fondu vers la page. La voiture se pose par-dessus (`HeroCar`), hors des voiles : elle est donc
 * strictement identique à celle de l'animation d'ouverture.
 */
export function HeroScene({
  width,
  height,
  scrollY,
  reduceMotion = false,
  showFade = true,
  onReady,
  onError,
}: {
  width: number;
  height: number;
  scrollY?: SharedValue<number>;
  reduceMotion?: boolean;
  showFade?: boolean;
  /** Le showroom est chargé et affiché. */
  onReady?: () => void;
  /** Le showroom n'a pas pu être chargé. */
  onError?: () => void;
}) {
  const layout = showroomLayout(width, height);
  const parallax = useParallax(scrollY, reduceMotion);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        start: 0,
        end: 0,
        backgroundColor: HERO_DARK,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }, parallax]}
      >
        <Image
          source={SHOWROOM}
          resizeMode="stretch"
          fadeDuration={0}
          style={{
            position: 'absolute',
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
          }}
          accessible={false}
          onLoad={() => {
            markAssetReady('showroom');
            onReady?.();
          }}
          onError={onError}
        />
      </Animated.View>
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="hs-left" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={HERO_DARK} stopOpacity="0.78" />
            <Stop offset="0.3" stopColor={HERO_DARK} stopOpacity="0.62" />
            <Stop offset="0.52" stopColor={HERO_DARK} stopOpacity="0.28" />
            <Stop offset="0.8" stopColor={HERO_DARK} stopOpacity="0" />
            <Stop offset="1" stopColor={HERO_DARK} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="hs-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={HERO_DARK} stopOpacity="0.96" />
            <Stop offset="0.2" stopColor={HERO_DARK} stopOpacity="0.72" />
            <Stop offset="0.5" stopColor={HERO_DARK} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="hs-bottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.6" stopColor={HERO_DARK} stopOpacity="0" />
            <Stop offset="1" stopColor={HERO_DARK} stopOpacity="0.6" />
          </LinearGradient>
          <LinearGradient id="hs-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={M3akPalette.background} stopOpacity="0" />
            <Stop offset="1" stopColor={M3akPalette.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#hs-left)" />
        <Rect width="100%" height="100%" fill="url(#hs-top)" />
        <Rect width="100%" height="100%" fill="url(#hs-bottom)" />
        {showFade ? (
          <Rect
            y={Math.max(height - HERO_FADE_HEIGHT, 0)}
            width="100%"
            height={HERO_FADE_HEIGHT}
            fill="url(#hs-fade)"
          />
        ) : null}
      </Svg>
    </View>
  );
}

/**
 * La voiture dans le hero, à sa place définitive. Premier lancement : elle n'apparaît qu'à l'arrivée du calque d'animation
 * (même image, même position : aucun saut). Lancement suivant : c'est elle qui s'allume.
 */
export function HeroCar({
  width,
  height,
  scrollY,
  reduceMotion = false,
  mode,
  animating,
}: {
  width: number;
  height: number;
  scrollY?: SharedValue<number>;
  reduceMotion?: boolean;
  mode: OpeningMode;
  /** Une ouverture est en cours. */
  animating: boolean;
}) {
  const rect = carRect(width, height);
  const parallax = useParallax(scrollY, reduceMotion);
  const hideUntilArrival = animating && mode === 'first';
  const visibility = useAnimatedStyle(() => ({
    opacity: hideUntilArrival && openingTime.value < FIRST.arrivalEnd ? 0 : 1,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }, parallax]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
          visibility,
        ]}
      >
        <CarLights
          width={rect.width}
          height={rect.height}
          mode={mode}
          effects={animating && mode === 'instant'}
          preloadUnlit={animating && mode === 'first'}
        />
      </Animated.View>
    </Animated.View>
  );
}
