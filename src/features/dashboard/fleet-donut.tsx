import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';
import { countByStatus } from '@/features/vehicles/filters';
import { statusStyle } from '@/features/vehicles/status-style';
import { VEHICLE_STATUSES, type Vehicle, type VehicleStatus } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

import { donutSegments } from './chart-path';
import { GlassCard } from './home-cards';

const SIZE = 128;
const STROKE = 16;
const RADIUS = (SIZE - STROKE) / 2;

/**
 * État du parc : anneau (une couleur par statut, les mêmes que partout dans l'app), total au centre, légende lisible
 * avec le nombre par statut. Chaque ligne de la légende ouvre la flotte filtrée sur ce statut. Parc vide : anneau neutre.
 */
export function FleetDonut({ vehicles }: { vehicles: Vehicle[] }) {
  const { t, language } = useLanguage();
  const counts = countByStatus(vehicles);
  const total = VEHICLE_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  const segments = donutSegments(
    VEHICLE_STATUSES.map((status) => ({ key: status, value: counts[status] })),
    RADIUS
  );
  const legend = VEHICLE_STATUSES.filter((status) => counts[status] > 0);
  const summary = `${t('accueil.fleet.title')} : ${legend.map((status) => `${counts[status]} ${t(`flotte.status.${status}`)}`).join(', ') || t('accueil.fleet.empty')}`;

  return (
    <GlassCard>
      <View
        accessible
        accessibilityLabel={summary}
        className="flex-row items-center"
        style={{ gap: 16, padding: 16 }}
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
              stroke={M3akPalette.mauveLight}
              strokeWidth={STROKE}
              fill="none"
            />
            {segments.map((segment) => (
              <Circle
                key={segment.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={statusStyle(segment.key as VehicleStatus).dot}
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
          {legend.length === 0 ? (
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
            legend.map((status) => (
              <Pressable
                key={status}
                onPress={() => router.push({ pathname: '/flotte', params: { statut: status } })}
                accessibilityRole="link"
                className="min-h-9 flex-row items-center"
                style={{ gap: 8 }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: statusStyle(status).dot,
                  }}
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
                  {t(`flotte.status.${status}`)}
                </ThemedText>
                <ThemedText
                  style={{
                    color: M3akPalette.ink,
                    fontSize: 14,
                    lineHeight: 18,
                    fontFamily: fontFamilyFor(language, 'extrabold'),
                  }}
                >
                  {String(counts[status])}
                </ThemedText>
              </Pressable>
            ))
          )}
        </View>
      </View>
    </GlassCard>
  );
}
