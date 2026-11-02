import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { openingTime } from '@/features/opening/opening-store';
import { carCurves, FIRST, type OpeningMode } from '@/features/opening/opening-timeline';

import { BLEND } from './car-lights';
import { HERO_FADE_HEIGHT } from './hero-scene';

const NIGHT = '#100B19';

/**
 * Voile aubergine posé sur le showroom (entre le décor et la voiture) : premier lancement = nuit complète puis le showroom
 * apparaît derrière la voiture ; lancement suivant = hero seulement assombri, qui retrouve son éclairage normal.
 */
export function HeroVeil({ mode }: { mode: OpeningMode }) {
  const style = useAnimatedStyle(() => ({ opacity: carCurves(mode, openingTime.value).veil }));
  // Le fondu du bas du hero vers la page claire reste sombre jusqu'au réveil : il se raccorde au rideau posé sous le hero.
  const strip = useAnimatedStyle(() => ({
    opacity:
      mode === 'first'
        ? 1 - Math.min(1, Math.max(0, (openingTime.value - FIRST.awakeningStart - 50) / 370))
        : 0,
  }));
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: NIGHT },
          style,
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
            backgroundColor: NIGHT,
          },
          strip,
        ]}
      />
    </>
  );
}

/** Lueur discrète autour du logo M3ak (lancements suivants) : dégradé radial, jamais un rectangle. */
export function LogoGlow({ mode }: { mode: OpeningMode }) {
  const style = useAnimatedStyle(() => ({
    opacity: mode === 'instant' ? carCurves(mode, openingTime.value).logoGlow : 0,
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: -26,
          right: -26,
          top: -26,
          bottom: -26,
          mixBlendMode: BLEND,
        },
        style,
      ]}
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="lg-glow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#CB83F5" stopOpacity="0.6" />
            <Stop offset="0.5" stopColor="#8D31CC" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#8D31CC" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#lg-glow)" />
      </Svg>
    </Animated.View>
  );
}
