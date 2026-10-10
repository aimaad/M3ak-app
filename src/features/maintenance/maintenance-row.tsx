import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { computeMaintenanceUrgency, type MaintenanceUrgency } from './urgency';
import type { MaintenanceItem } from './types';

const URGENCY_STYLE: Record<MaintenanceUrgency, { background: string; text: string }> = {
  a_venir: { background: '#EDE9FE', text: '#7C3AED' },
  due: { background: '#FEF3C7', text: '#B45309' },
  en_retard: { background: '#FEE2E2', text: '#DC2626' },
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
  const urgency = computeMaintenanceUrgency(item, currentKm);
  const style = URGENCY_STYLE[urgency];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-row items-center justify-between rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3">
      <View className="flex-1 gap-0.5">
        <ThemedText type="smallBold">{t(`maintenance.types.${item.type}`)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {vehicleLabel ?? '—'}
          {item.echeanceDate ? ` • ${item.echeanceDate}` : ''}
          {item.echeanceKm != null ? ` • ${item.echeanceKm.toLocaleString('fr-FR')} km` : ''}
        </ThemedText>
      </View>
      <View
        className="rounded-full px-3 py-1"
        style={{ backgroundColor: isDone ? '#DCFCE7' : style.background }}
      >
        <ThemedText type="small" style={{ color: isDone ? '#15803D' : style.text }}>
          {isDone ? t('maintenance.done') : t(`maintenance.urgency.${urgency}`)}
        </ThemedText>
      </View>
    </Pressable>
  );
}
