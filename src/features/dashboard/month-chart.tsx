import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';

import type { MonthlyPoint } from './kpis';

const CHART_HEIGHT = 90;

function monthLabel(dateKey: string, locale: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(locale, { month: 'short' });
}

/** Barres mensuelles (le dernier mois, en cours, est en mauve foncé). */
export function MonthChart({ points, locale }: { points: MonthlyPoint[]; locale: string }) {
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
                  backgroundColor: point.total > 0 ? (isCurrent ? M3akPalette.mauveDeep : M3akPalette.mauve) : '#E4DCF5',
                }}
              />
            </View>
          );
        })}
      </View>
      <View className="flex-row gap-2">
        {points.map((point) => (
          <View key={point.date} className="flex-1 items-center">
            <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
              {monthLabel(point.date, locale)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}
