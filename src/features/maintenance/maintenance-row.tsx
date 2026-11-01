import { View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { computeMaintenanceUrgency, type MaintenanceUrgency } from './urgency';
import type { MaintenanceItem } from './types';
import { M3akPalette } from '@/constants/theme';

const URGENCY_STYLE: Record<MaintenanceUrgency, { background: string; text: string }> = {
  a_venir: { background: '#F1EEF7', text: M3akPalette.muted },
  due: { background: '#FBF1DE', text: '#8A5A0B' },
  en_retard: { background: '#F8E6E9', text: '#C55461' },
};

export function MaintenanceRow({
  item,
  vehicleLabel,
  currentKm,
  onPress,
}: {
  item: MaintenanceItem;
  vehicleLabel?: string;
  currentKm: number | null;
  onPress?: () => void;
}) {
  const { t } = useLanguage();
  const isDone = item.statut === 'effectuee';
  const isInProgress = item.statut === 'en_cours';
  const urgency = computeMaintenanceUrgency(item, currentKm);
  const style = URGENCY_STYLE[urgency];
  const badge = isDone
    ? { background: '#E3F3EE', text: '#116B54', label: t('maintenance.done') }
    : isInProgress
      ? { background: '#E8EEF9', text: '#3F62AD', label: t('maintenance.status.en_cours') }
      : { background: style.background, text: style.text, label: t(`maintenance.urgency.${urgency}`) };

  return (
    <PressableCard
      onPress={onPress}
      disabled={!onPress}
      padded={false}
      className="flex-row items-center justify-between px-4 py-3"
    >
      <View className="flex-1 gap-0.5">
        <ThemedText type="smallBold">{t(`maintenance.types.${item.type}`)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {vehicleLabel ?? '—'}
          {item.echeanceDate ? ` • ${item.echeanceDate}` : ''}
          {item.echeanceKm != null ? ` • ${item.echeanceKm.toLocaleString('fr-FR')} km` : ''}
          {isDone && item.cout != null ? ` • ${item.cout.toLocaleString('fr-FR')} MAD` : ''}
        </ThemedText>
      </View>
      <View className="rounded-full px-3 py-1" style={{ backgroundColor: badge.background }}>
        <ThemedText type="small" style={{ color: badge.text }}>
          {badge.label}
        </ThemedText>
      </View>
    </PressableCard>
  );
}
