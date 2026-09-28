import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { statusStyle } from './status-style';
import type { VehicleStatus } from './types';

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const { t } = useLanguage();
  const style = statusStyle(status);

  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1"
      style={{ backgroundColor: style.background }}
    >
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      <ThemedText type="small" style={{ color: style.text }}>
        {t(`flotte.status.${status}`)}
      </ThemedText>
    </View>
  );
}
