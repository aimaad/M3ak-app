import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';
import { countByStatus } from '@/features/vehicles/filters';
import type { Vehicle } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

import { donutSegments } from './chart-path';
import { fleetShares, OTHERS_COLOR, sharePercent } from './fleet-shares';
import { GlassCard } from './home-cards';

const SIZE = 132;
const STROKE = 17;
const RADIUS = (SIZE - STROKE) / 2;

/**
 * État du parc : anneau violet (une nuance par statut), total au centre, légende lisible avec le nombre et le pourcentage
 * par statut. Chaque ligne ouvre la flotte filtrée sur ce statut. Parc vide : anneau neutre et message. Données réelles seulement.
 */
export function FleetDonut({ vehicles }: { vehicles: Vehicle[] }) {
  const { t, language } = useLanguage();
  const counts = countByStatus(vehicles);
  const shares = fleetShares(counts);
  const total = shares.reduce((sum, share) => sum + share.value, 0);
  const segments = donutSegments(
    shares.map(({ key, value }) => ({ key, value })),
    RADIUS
  );
  const labelOf = (key: string) =>
    key === 'others' ? t('accueil.fleet.others') : t(`flotte.status.${key}`);
  const rows = shares.filter((share) => share.value > 0);
  const summary = `${t('accueil.fleet.title')} : ${rows.map((row) => `${row.value} ${labelOf(row.key)} (${sharePercent(row.value, total)} %)`).join(', ') || t('accueil.fleet.empty')}`;

  return (
    <GlassCard>
      <View
        accessible
        accessibilityLabel={summary}
        className="flex-row items-center"
        style={{ gap: 14, padding: 16 }}
      >
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            style={{ transform: [{ rotate: '-90deg' }] }}
          >
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke="#F0DDFB"
              strokeWidth={STROKE}
              fill="none"
            />
            {segments.map((segment) => (
              <Circle
                key={segment.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={shares.find((share) => share.key === segment.key)?.color ?? OTHERS_COLOR}
                strokeWidth={STROKE}
                strokeDasharray={`${segment.dash} ${segment.rest}`}
                strokeDashoffset={segment.offset}
                fill="none"
              />
            ))}
          </Svg>
          <View
            pointerEvents="none"
            className="items-center justify-center"
            style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}
          >
            <ThemedText
              style={{
                color: M3akPalette.ink,
                fontSize: 30,
                lineHeight: 34,
                fontFamily: fontFamilyFor(language, 'extrabold'),
              }}
            >
              {String(total)}
            </ThemedText>
            <ThemedText
              style={{
                color: M3akPalette.muted,
                fontSize: 11.5,
                lineHeight: 15,
                fontFamily: fontFamilyFor(language, 'semibold'),
              }}
            >
              {t('accueil.fleet.vehicles')}
            </ThemedText>
          </View>
        </View>

        <View className="flex-1" style={{ gap: 2 }}>
          {rows.length === 0 ? (
            <ThemedText
              style={{
                color: M3akPalette.muted,
                fontSize: 13,
                lineHeight: 18,
                fontFamily: fontFamilyFor(language, 'medium'),
              }}
            >
              {t('accueil.fleet.empty')}
            </ThemedText>
          ) : (
            rows.map((row) => (
              <Pressable
                key={row.key}
                onPress={() =>
                  router.push(
                    row.key === 'others'
                      ? '/flotte'
                      : { pathname: '/flotte', params: { statut: row.key } }
                  )
                }
                accessibilityRole="link"
                className="min-h-9 flex-row items-center"
                style={{ gap: 8 }}
              >
                <View
                  style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: row.color }}
                />
                <ThemedText
                  numberOfLines={1}
                  className="flex-1"
                  style={{
                    color: M3akPalette.ink,
                    fontSize: 13,
                    lineHeight: 18,
                    fontFamily: fontFamilyFor(language, 'medium'),
                  }}
                >
                  {labelOf(row.key)}
                </ThemedText>
                <ThemedText
                  style={{
                    color: M3akPalette.ink,
                    fontSize: 14,
                    lineHeight: 18,
                    fontFamily: fontFamilyFor(language, 'extrabold'),
                  }}
                >
                  {String(row.value)}
                </ThemedText>
                <ThemedText
                  style={{
                    color: M3akPalette.muted,
                    fontSize: 11.5,
                    lineHeight: 18,
                    minWidth: 34,
                    textAlign: 'right',
                    fontFamily: fontFamilyFor(language, 'medium'),
                  }}
                >
                  {sharePercent(row.value, total)} %
                </ThemedText>
              </Pressable>
            ))
          )}
        </View>
      </View>
    </GlassCard>
  );
}
