import { Image, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { M3akPalette } from '@/constants/theme';

import { heroImageLayout } from './hero-layout';

/** Photo du hero : Mercedes-AMG dans un showroom sombre, retournée (la voiture regarde vers la gauche) et lumières rouges passées au violet. */
export const HERO_IMAGE = require('../../../assets/images/hero-m3ak.jpg');

export const HERO_DARK = '#171126';
/** Fondu du bas du hero vers la couleur de la page : pas de bord net. */
export const HERO_FADE_HEIGHT = 26;
/** Parallaxe : décalage maximal de la photo (dp) sur 220 dp de défilement, dans le sens inverse du contenu. */
const PARALLAX_MAX = 14;
const PARALLAX_RANGE = 220;

/**
 * Décor du hero : la photo, calée à droite, et les voiles qui garantissent la lisibilité (gauche pour le texte, haut pour les
 * boutons, bas pour le sélecteur) puis le fondu vers la page. Utilisé par le hero ET par l'animation d'ouverture : les deux
 * affichent ainsi exactement la même scène.
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
  /** Fondu du bas vers la couleur de la page (désactivé pendant l'ouverture, où la page est encore sombre). */
  showFade?: boolean;
  /** La photo est chargée et affichée. */
  onReady?: () => void;
  /** La photo n'a pas pu être chargée. */
  onError?: () => void;
}) {
  const layout = heroImageLayout(width, height);
  // Très léger mouvement de profondeur : la photo descend un peu pendant que la page monte.
  const parallax = useAnimatedStyle(() => ({
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
  const topFade = Math.max(layout.top, 0);

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
          source={HERO_IMAGE}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height,
          }}
          accessible={false}
          onLoad={onReady}
          onError={onError}
        />
      </Animated.View>
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="hs-left" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={HERO_DARK} stopOpacity="0.97" />
            <Stop offset="0.3" stopColor={HERO_DARK} stopOpacity="0.86" />
            <Stop offset="0.52" stopColor={HERO_DARK} stopOpacity="0.4" />
            <Stop offset="0.8" stopColor={HERO_DARK} stopOpacity="0.05" />
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
          <LinearGradient id="hs-image-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={HERO_DARK} stopOpacity="1" />
            <Stop offset="1" stopColor={HERO_DARK} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="hs-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={M3akPalette.background} stopOpacity="0" />
            <Stop offset="1" stopColor={M3akPalette.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        {topFade > 0 ? (
          <Rect
            x={0}
            y={Math.max(topFade - 6, 0)}
            width="100%"
            height={46}
            fill="url(#hs-image-top)"
          />
        ) : null}
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
