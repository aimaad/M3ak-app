import { View } from 'react-native';

import { PressableCard } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import { computeMaintenanceUrgency, type MaintenanceUrgency } from './urgency';
import type { MaintenanceItem } from './types';
import { Palette } from '@/constants/theme';

const URGENCY_STYLE: Record<MaintenanceUrgency, { background: string; text: string }> = {
  a_venir: { background: Palette.surfaceAlt, text: Palette.textSecondary },
  due: { background: Palette.warningSoft, text: Palette.warning },
  en_retard: { background: Palette.errorSoft, text: Palette.error },
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
    ? { background: Palette.successSoft, text: Palette.success, label: t('maintenance.done') }
    : isInProgress
      ? { background: Palette.infoSoft, text: Palette.info, label: t('maintenance.status.en_cours') }
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
