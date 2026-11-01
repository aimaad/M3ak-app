import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';

import type { MonthlyPoint } from './kpis';

const CHART_HEIGHT = 90;

/** Couleurs sur la carte mauve profond (revenus) : barres lavande, dernière barre pleine. */
const ON_DEEP = {
  past: 'rgba(182,154,207,0.45)',
  current: '#B69ACF',
  empty: 'rgba(255,255,255,0.14)',
  label: '#CBB8E0',
};

type Granularity = 'month' | 'day';

function pointLabel(
  dateKey: string,
  locale: string,
  granularity: Granularity,
  total: number
): string {
  const date = new Date(`${dateKey}T00:00:00`);
  if (granularity === 'month') return date.toLocaleDateString(locale, { month: 'short' });
  // 7 barres : jour de la semaine ; 30 barres : numéro du jour (une étiquette sur cinq).
  return total <= 7
    ? date.toLocaleDateString(locale, { weekday: 'narrow' })
    : String(date.getDate());
}

/**
 * Barres d'encaissements : mois (6) ou jours (7 ou 30). La dernière barre (période en cours) est pleine. Sur fond mauve
 * profond (`onDeep`), les barres passent en lavande.
 */
export function PeriodChart({
  points,
  locale,
  granularity,
  onDeep = false,
}: {
  points: MonthlyPoint[];
  locale: string;
  granularity: Granularity;
  onDeep?: boolean;
}) {
  const max = Math.max(...points.map((p) => p.total), 1);
  const dense = points.length > 12;
  return (
    <View className="gap-2">
      <View className="flex-row items-end" style={{ height: CHART_HEIGHT, gap: dense ? 2 : 8 }}>
        {points.map((point, index) => {
          const barHeight = Math.max(
            (Math.max(point.total, 0) / max) * CHART_HEIGHT,
            point.total > 0 ? 4 : 2
          );
          const isCurrent = index === points.length - 1;
          const color = onDeep
            ? point.total > 0
              ? isCurrent
                ? ON_DEEP.current
                : ON_DEEP.past
              : ON_DEEP.empty
            : point.total > 0
              ? isCurrent
                ? M3akPalette.mauveDeep
                : M3akPalette.mauve
              : M3akPalette.border;
          return (
            <View
              key={point.date}
              className="flex-1 items-center justify-end"
              style={{ height: CHART_HEIGHT }}
            >
              <View
                className="w-full rounded-t-md"
                style={{ height: barHeight, backgroundColor: color }}
              />
            </View>
          );
        })}
      </View>
      <View className="flex-row" style={{ gap: dense ? 2 : 8 }}>
        {points.map((point, index) => {
          const showLabel = !dense || (points.length - 1 - index) % 5 === 0;
          return (
            <View key={point.date} className="flex-1 items-center">
              {showLabel ? (
                <ThemedText
                  type="small"
                  numberOfLines={1}
                  style={{
                    fontSize: 11,
                    width: 28,
                    textAlign: 'center',
                    color: onDeep ? ON_DEEP.label : M3akPalette.muted,
                  }}
                >
                  {pointLabel(point.date, locale, granularity, points.length)}
                </ThemedText>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
