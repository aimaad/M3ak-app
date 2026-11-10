import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { rentedPercent, type FleetCounts } from './fleet-model';
import { RING_CIRCUMFERENCE, RING_RADIUS, RING_SIZE, RING_STROKE, ringSegments, type RingSegment } from './ring-geometry';
import { GROUP_ON_DARK } from './fleet-style';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Segment({ segment, progress }: { segment: RingSegment; progress: { value: number } }) {
  const animatedProps = useAnimatedProps(() => ({ strokeDasharray: [Math.max(segment.length * progress.value, 0.01), RING_CIRCUMFERENCE] }));
  return (
    <AnimatedCircle
      cx={RING_SIZE / 2}
      cy={RING_SIZE / 2}
      r={RING_RADIUS}
      fill="none"
      stroke={GROUP_ON_DARK[segment.key]}
      strokeWidth={RING_STROKE}
      strokeLinecap="round"
      strokeDashoffset={-segment.offset}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Anneau de répartition de la flotte : un segment par groupe (disponibles, en location, immobilisés), proportionnel. Au centre :
 * le pourcentage de véhicules en location. Les segments se tracent en 600 ms (sans animation si « réduire les animations »).
 */
export function FleetRing({ counts }: { counts: FleetCounts }) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    progress.value = reduceMotion ? 1 : withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [progress, reduceMotion]);
  const segments = ringSegments(counts);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('flotte.header.ringA11y', { free: counts.free, rented: counts.rented, immobilized: counts.immobilized })}
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="rgba(32,37,39,0.75)" stroke={Brand.borderOnDark} strokeWidth={RING_STROKE} />
        {segments.map((segment) => (
          <Segment key={segment.key} segment={segment} progress={progress} />
        ))}
      </Svg>
      <View style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <HText font="display" weight="bold" size={22} color={Brand.white} style={{ lineHeight: 22 }}>
          {`${rentedPercent(counts)}%`}
        </HText>
        <HText weight="semibold" size={9} track={0.12} color={Brand.mutedOnDark} style={{ lineHeight: 12 }}>
          {t('flotte.header.enRoute').toLocaleUpperCase()}
        </HText>
      </View>
    </View>
  );
}
