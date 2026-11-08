import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { Brand, Palette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { ArrowLink, HText, MicroLabel } from './home-ui';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Arc de 180° de rayon 56 : sa longueur (≈ 176) sert à tracer la part d'occupation. */
const ARC = 'M10 70 A56 56 0 0 1 122 70';
const ARC_LENGTH = 176;
const CENTER = { x: 66, y: 70 };
const NEEDLE = 38;
const TICKS = [
  [24, 70, 19, 70],
  [26.06, 57.02, 21.3, 55.48],
  [32.02, 45.3, 27.98, 42.36],
  [41.3, 36.02, 38.36, 31.98],
  [53.02, 30.06, 51.48, 25.3],
  [66, 28, 66, 23],
  [78.98, 30.06, 80.52, 25.3],
  [90.7, 36.02, 93.64, 31.98],
  [99.98, 45.3, 104.02, 42.36],
  [105.94, 57.02, 110.7, 55.48],
  [108, 70, 113, 70],
] as const;

/** Compte-tours : arc de fond, arc orange (taux d'occupation), 11 graduations, aiguille animée de 0 au taux (600 ms). */
export function OccupancyGauge({ rate, label }: { rate: number; label: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const target = Math.max(0, Math.min(1, rate));
  useEffect(() => {
    progress.value = reduceMotion ? target : withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [target, reduceMotion, progress]);

  const needle = useAnimatedProps(() => {
    const angle = Math.PI * (1 - progress.value);
    return { x2: CENTER.x + NEEDLE * Math.cos(angle), y2: CENTER.y - NEEDLE * Math.sin(angle) };
  });
  const arc = useAnimatedProps(() => ({
    strokeDasharray: [progress.value * ARC_LENGTH, ARC_LENGTH],
    strokeOpacity: progress.value > 0.001 ? 1 : 0,
  }));

  return (
    <Svg width={132} height={80} viewBox="0 0 132 80" accessibilityRole="image" accessibilityLabel={label}>
      <Path d={ARC} fill="none" stroke={Brand.gaugeTrack} strokeWidth={8} strokeLinecap="round" />
      <AnimatedPath d={ARC} fill="none" stroke={Brand.orange} strokeWidth={8} strokeLinecap="round" animatedProps={arc} />
      <G stroke={Brand.mutedOnDark} strokeWidth={1.5} strokeLinecap="round">
        {TICKS.map(([x1, y1, x2, y2]) => (
          <Line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </G>
      <AnimatedLine x1={CENTER.x} y1={CENTER.y} stroke={Brand.graphite} strokeWidth={3} strokeLinecap="round" animatedProps={needle} />
      <Circle cx={CENTER.x} cy={CENTER.y} r={6} fill={Brand.graphite} />
      <Circle cx={CENTER.x} cy={CENTER.y} r={2.5} fill={Brand.orange} />
    </Svg>
  );
}

/**
 * « Parc » : jauge d'occupation, taux, et répartition d'AUJOURD'HUI calculée comme le bloc Disponibilités (`parcCounts`) :
 * Disponibles = libres ; En location = louées, en retard et à confirmer ; À inspecter = inspection, entretien et indisponibles.
 */
export function ParcSection({ counts, occupancyPct }: { counts: { free: number; rented: number; toInspect: number; total: number }; occupancyPct: number }) {
  const { t } = useLanguage();
  const rows = [
    { key: 'available', color: Palette.success, value: counts.free },
    { key: 'rented', color: Brand.graphite, value: counts.rented },
    { key: 'toInspect', color: Brand.parcInspect, value: counts.toInspect },
  ] as const;
  return (
    <View style={{ gap: 14, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
          <MicroLabel size={11} track={0.16}>
            {t('accueil.home.parc.title')}
          </MicroLabel>
          <HText size={12} color={Palette.textSecondary} numberOfLines={1}>
            {t('accueil.home.parc.count', { count: counts.total })}
          </HText>
        </View>
        <ArrowLink label={t('accueil.home.parc.see')} onPress={() => router.push('/flotte')} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: Palette.border, borderRadius: 22, paddingVertical: 18, paddingHorizontal: 16, backgroundColor: Palette.card }}>
        <OccupancyGauge rate={occupancyPct / 100} label={t('accueil.home.parc.gauge', { pct: occupancyPct })} />
        <View style={{ flex: 1, gap: 10, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <HText font="display" weight="semibold" size={28} track={-0.02} style={{ lineHeight: 30 }}>
              {`${occupancyPct} %`}
            </HText>
            <HText size={12} color={Palette.textSecondary} numberOfLines={1}>
              {t('accueil.home.parc.occupancy')}
            </HText>
          </View>
          <View style={{ gap: 6 }}>
            {rows.map((row) => (
              <View key={row.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: row.color }} />
                  <HText size={13} color={Palette.textSecondary} numberOfLines={1}>
                    {t(`accueil.home.parc.${row.key}`)}
                  </HText>
                </View>
                <HText weight="semibold" size={14}>
                  {String(row.value)}
                </HText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
