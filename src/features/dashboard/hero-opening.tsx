import { Image } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Mask, RadialGradient, Rect, Stop } from 'react-native-svg';

import { HERO_DARK, HERO_FADE_HEIGHT } from './hero-scene';
import { heroImageLayout, imagePointToHero } from './hero-layout';
import {
  easeInOut,
  easeOut,
  flightControl,
  OPENING_PHASES as P,
  quadraticPoint,
  windowProgress,
} from '@/features/opening/opening-timeline';
import { openingTime } from '@/features/opening/opening-store';

/** Repères sur la photo (pixels de l'image retournée 1040 × 655). */
const NEAR_HEADLIGHT = { x: 455, y: 326 };
const FRONT_EMBLEM = { x: 325, y: 345 };
const CAR_TOP = 150;
const CAR_BOTTOM = 460;

const VEIL = '#0D0916';
const MARK = require('../../../assets/images/logo-m3ak-ribbon-light.png');

export type MarkTarget = { x: number; y: number; width: number; height: number };

type Props = {
  width: number;
  height: number;
  /** Place exacte du vrai logo du hero (coordonnées du hero), où le logo volant doit atterrir. */
  markTarget: MarkTarget | null;
};

/**
 * Effets lumineux de l'ouverture, posés dans le hero entre la photo et le texte :
 * voile sombre, balayage de lumière violette, phares, lueur d'où naît le logo, puis logo volant.
 * Tout est piloté par l'horloge unique `openingTime` (transformations et opacité seulement).
 */
export function HeroOpening({ width, height, markTarget }: Props) {
  const layout = heroImageLayout(width, height);
  const carTopLeft = imagePointToHero(layout, 259, CAR_TOP);
  const carBottomRight = imagePointToHero(layout, 753, CAR_BOTTOM);
  const carLeft = carTopLeft.x;
  const carRight = carBottomRight.x;
  const carTop = carTopLeft.y;
  const carHeight = carBottomRight.y - carTopLeft.y;
  const carWidth = carRight - carLeft;

  const headlight = imagePointToHero(layout, NEAR_HEADLIGHT.x, NEAR_HEADLIGHT.y);
  const emblem = imagePointToHero(layout, FRONT_EMBLEM.x, FRONT_EMBLEM.y);

  // --- Voile : presque noir au départ, puis la salle s'éclaire jusqu'à disparaître en phase 5.
  const veil = useAnimatedStyle(() => ({
    opacity: interpolate(
      openingTime.value,
      [0, P.darknessEnd, P.sweepEnd, P.headlightsEnd, P.flightEnd, P.end],
      [0.95, 0.95, 0.62, 0.55, 0.45, 0],
      Extrapolation.CLAMP
    ),
  }));

  // Le fondu du bas du hero vers la page claire reste sombre jusqu'au réveil : il se raccorde au rideau posé sous le hero.
  const bottomStrip = useAnimatedStyle(() => ({
    opacity: interpolate(
      openingTime.value,
      [P.flightEnd, P.flightEnd + 450],
      [1, 0],
      Extrapolation.CLAMP
    ),
  }));

  // --- Balayage : une bande de lumière qui glisse de la droite vers la gauche sur la carrosserie.
  const bandWidth = Math.max(120, carWidth * 0.34);
  const sweep = useAnimatedStyle(() => {
    const p = easeInOut(windowProgress(openingTime.value, P.sweepStart, P.sweepEnd));
    const from = carRight + bandWidth * 0.2;
    const to = carLeft - bandWidth * 0.8;
    return {
      opacity: interpolate(
        openingTime.value,
        [P.sweepStart, P.sweepStart + 220, P.sweepEnd - 260, P.sweepEnd],
        [0, 1, 1, 0],
        Extrapolation.CLAMP
      ),
      transform: [{ translateX: from + (to - from) * p }, { skewX: '-16deg' }],
    };
  });

  // --- Phares : lueur lavande-blanc progressive, qui se pose sans flash.
  const headlightSize = Math.max(54, carWidth * 0.2);
  const headlightGlow = useAnimatedStyle(() => ({
    opacity: interpolate(
      openingTime.value,
      [P.headlightsStart, P.headlightsEnd, P.flightEnd, P.end],
      [0, 0.8, 0.65, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale:
          0.7 +
          0.3 * easeOut(windowProgress(openingTime.value, P.headlightsStart, P.headlightsEnd)),
      },
    ],
  }));

  // --- Lueur violette d'où naît le logo, à l'avant de la voiture.
  const emergenceSize = Math.max(46, carWidth * 0.16);
  const emergenceGlow = useAnimatedStyle(() => ({
    opacity: interpolate(
      openingTime.value,
      [P.emergenceStart, P.emergenceStart + 220, P.emergenceEnd + 300, P.flightEnd],
      [0, 1, 0.85, 0],
      Extrapolation.CLAMP
    ),
    transform: [
      {
        scale:
          0.3 + 0.7 * easeOut(windowProgress(openingTime.value, P.emergenceStart, P.emergenceEnd)),
      },
    ],
  }));

  // --- Logo volant : naît à l'avant, grandit, puis suit un arc doux jusqu'à la place exacte du vrai logo.
  const target = markTarget;
  const flyingLogo = useAnimatedStyle(() => {
    if (!target) return { opacity: 0 };
    const t = openingTime.value;
    const start = { x: emblem.x, y: emblem.y };
    const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const flight = easeInOut(windowProgress(t, P.emergenceEnd, P.flightEnd));
    const point = quadraticPoint(start, flightControl(start, end), end, flight);
    const grow = easeOut(windowProgress(t, P.emergenceStart, P.emergenceEnd));
    const scale = (0.28 + 0.3 * grow) * (1 - flight) + flight;
    return {
      // Le vrai logo prend le relais à l'instant exact de l'arrivée : un seul logo visible.
      opacity:
        t >= P.flightEnd
          ? 0
          : interpolate(t, [P.emergenceStart + 60, P.emergenceEnd], [0, 1], Extrapolation.CLAMP),
      transform: [
        { translateX: point.x - target.width / 2 },
        { translateY: point.y - target.height / 2 },
        { scale },
      ],
    };
  });

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: VEIL },
          veil,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: HERO_FADE_HEIGHT + 2,
            backgroundColor: HERO_DARK,
          },
          bottomStrip,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: carTop - carHeight * 0.15,
            left: 0,
            width: bandWidth,
            height: carHeight * 1.3,
            mixBlendMode: 'screen',
          },
          sweep,
        ]}
      >
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="op-band" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#8D31CC" stopOpacity="0" />
              <Stop offset="0.38" stopColor="#8D31CC" stopOpacity="0.3" />
              <Stop offset="0.5" stopColor="#F8F3FC" stopOpacity="0.5" />
              <Stop offset="0.62" stopColor="#CB83F5" stopOpacity="0.38" />
              <Stop offset="1" stopColor="#CB83F5" stopOpacity="0" />
            </LinearGradient>
            {/* Fondu vertical : la lumière s'éteint en douceur en haut et en bas, sans bord net. */}
            <LinearGradient id="op-band-v" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            <Mask id="op-band-mask" x="0" y="0" width="100%" height="100%">
              <Rect width="100%" height="100%" fill="url(#op-band-v)" />
            </Mask>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#op-band)" mask="url(#op-band-mask)" />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: headlight.x - headlightSize / 2,
            top: headlight.y - headlightSize / 2,
            width: headlightSize,
            height: headlightSize,
            mixBlendMode: 'screen',
          },
          headlightGlow,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="op-head" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#F8F3FC" stopOpacity="0.9" />
              <Stop offset="0.35" stopColor="#CB83F5" stopOpacity="0.45" />
              <Stop offset="1" stopColor="#8D31CC" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#op-head)" />
        </Svg>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: emblem.x - emergenceSize / 2,
            top: emblem.y - emergenceSize / 2,
            width: emergenceSize,
            height: emergenceSize,
            mixBlendMode: 'screen',
          },
          emergenceGlow,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="op-emerge" cx="0.5" cy="0.5" r="0.5">
              <Stop offset="0" stopColor="#F8F3FC" stopOpacity="0.85" />
              <Stop offset="0.3" stopColor="#CB83F5" stopOpacity="0.6" />
              <Stop offset="1" stopColor="#8D31CC" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#op-emerge)" />
        </Svg>
      </Animated.View>
      {target ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 0, left: 0, width: target.width, height: target.height },
            flyingLogo,
          ]}
        >
          <Image
            source={MARK}
            resizeMode="contain"
            style={{ width: target.width, height: target.height }}
          />
        </Animated.View>
      ) : null}
    </>
  );
}
