import { Image, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { BibipPalette } from '@/constants/theme';
import { markAssetReady } from '@/features/opening/opening-store';

import { carRect, showroomLayout } from './hero-layout';

/** Showroom au coucher du soleil (image fournie). La voiture est un calque séparé : voir `HeroCar`. */
const SHOWROOM = require('../../../assets/images/signature/showroom.webp');
/** La Mercedes noire en trois-quarts (image fournie), la même que celle de l'introduction. */
const THREE_QUARTER = require('../../../assets/images/signature/three-quarter.webp');

export const HERO_DARK = BibipPalette.primaryDeep;
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
  onError,
}: {
  width: number;
  height: number;
  scrollY?: SharedValue<number>;
  reduceMotion?: boolean;
  showFade?: boolean;
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
          onLoad={() => markAssetReady('showroom')}
          onError={onError}
        />
      </Animated.View>
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="hs-left" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={HERO_DARK} stopOpacity="0.88" />
            <Stop offset="0.3" stopColor={HERO_DARK} stopOpacity="0.72" />
            <Stop offset="0.55" stopColor={HERO_DARK} stopOpacity="0.3" />
            <Stop offset="0.85" stopColor={HERO_DARK} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="hs-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={HERO_DARK} stopOpacity="0.9" />
            <Stop offset="0.2" stopColor={HERO_DARK} stopOpacity="0.6" />
            <Stop offset="0.5" stopColor={HERO_DARK} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="hs-bottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={HERO_DARK} stopOpacity="0" />
            <Stop offset="1" stopColor={HERO_DARK} stopOpacity="0.65" />
          </LinearGradient>
          <LinearGradient id="hs-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={BibipPalette.background} stopOpacity="0" />
            <Stop offset="1" stopColor={BibipPalette.background} stopOpacity="1" />
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

/** La voiture (Mercedes noire en trois-quarts) dans le hero, à sa place définitive, à droite du texte. */
export function HeroCar({
  width,
  height,
  scrollY,
  reduceMotion = false,
}: {
  width: number;
  height: number;
  scrollY?: SharedValue<number>;
  reduceMotion?: boolean;
}) {
  const rect = carRect(width, height);
  const parallax = useParallax(scrollY, reduceMotion);
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }, parallax]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        }}
      >
        <Image
          source={THREE_QUARTER}
          resizeMode="stretch"
          fadeDuration={0}
          style={{ width: rect.width, height: rect.height }}
          onLoad={() => markAssetReady('three-quarter')}
          accessible={false}
        />
      </View>
    </Animated.View>
  );
}
