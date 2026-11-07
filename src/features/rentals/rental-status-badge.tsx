import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { RentalStatus } from './types';
import { Brand, Palette } from '@/constants/theme';

/** Couleurs des statuts, partagées avec le calendrier : même statut, même couleur partout. */
export const RENTAL_STATUS_STYLES: Record<RentalStatus, { background: string; text: string; dot: string }> = {
  en_attente_confirmation: { background: Palette.warningSoft, text: Palette.warning, dot: Palette.warning },
  confirmee: { background: Palette.primarySoft, text: Brand.graphite, dot: Palette.primary },
  reservee: { background: Palette.primarySoft, text: Brand.graphite, dot: Palette.primary },
  en_cours: { background: Palette.infoSoft, text: Palette.info, dot: Palette.info },
  terminee: { background: Palette.successSoft, text: Palette.success, dot: Palette.success },
  annulee: { background: Palette.surfaceAlt, text: Palette.textSecondary, dot: Palette.textMuted },
};

export function RentalStatusBadge({ status }: { status: RentalStatus }) {
  const { t } = useLanguage();
  const style = RENTAL_STATUS_STYLES[status];

  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1"
      style={{ backgroundColor: style.background }}
    >
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      <ThemedText type="small" style={{ color: style.text }}>
        {t(`locations.status.${status}`)}
      </ThemedText>
    </View>
  );
}
