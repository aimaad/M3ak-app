import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';

import type { MonthlyPoint } from './kpis';

const CHART_HEIGHT = 90;

function monthLabel(dateKey: string, locale: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(locale, { month: 'short' });
}

/** Couleurs sur carte vert forêt (revenus) : barres claires, mois en cours en émeraude lumineux. */
const ON_FOREST = { past: 'rgba(167,243,208,0.38)', current: '#6EE7B7', empty: 'rgba(255,255,255,0.14)', label: '#A7F3D0' };

/** Barres mensuelles (le dernier mois, en cours, est en vert forêt ; sur fond forêt : émeraude clair). */
export function MonthChart({ points, locale, onForest = false }: { points: MonthlyPoint[]; locale: string; onForest?: boolean }) {
  const max = Math.max(...points.map((p) => p.total), 1);
  return (
    <View className="gap-2">
      <View className="flex-row items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {points.map((point, index) => {
          const barHeight = Math.max((Math.max(point.total, 0) / max) * CHART_HEIGHT, point.total > 0 ? 4 : 2);
          const isCurrent = index === points.length - 1;
          return (
            <View key={point.date} className="flex-1 items-center justify-end" style={{ height: CHART_HEIGHT }}>
              <View
                className="w-full rounded-t-md"
                style={{
                  height: barHeight,
                  backgroundColor: onForest
                    ? point.total > 0
                      ? isCurrent
                        ? ON_FOREST.current
                        : ON_FOREST.past
                      : ON_FOREST.empty
                    : point.total > 0
                      ? isCurrent
                        ? M3akPalette.mauveDeep
                        : M3akPalette.mauve
                      : M3akPalette.border,
                }}
              />
            </View>
          );
        })}
      </View>
      <View className="flex-row gap-2">
        {points.map((point) => (
          <View key={point.date} className="flex-1 items-center">
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11, ...(onForest ? { color: ON_FOREST.label } : null) }}>
              {monthLabel(point.date, locale)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}
