import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

import type { DailyRevenuePoint } from './metrics';

const CHART_HEIGHT = 80;

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'narrow' });
}

export function RevenueChart({ points }: { points: DailyRevenuePoint[] }) {
  const max = Math.max(...points.map((p) => p.total), 1);

  return (
    <View className="gap-2">
      <View className="flex-row items-end gap-2" style={{ height: CHART_HEIGHT }}>
        {points.map((point) => {
          const heightRatio = point.total / max;
          const barHeight = Math.max(heightRatio * CHART_HEIGHT, point.total > 0 ? 4 : 2);
          return (
            <View key={point.date} className="flex-1 items-center justify-end" style={{ height: CHART_HEIGHT }}>
              <View
                className="w-full rounded-t-md"
                style={{
                  height: barHeight,
                  backgroundColor: point.total > 0 ? '#1f5eff' : '#e1e5f0',
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
              {formatDayLabel(point.date)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}
