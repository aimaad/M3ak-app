import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { RentalStatus } from './types';
import { M3akPalette } from '@/constants/theme';

/** Couleurs des statuts, partagées avec le calendrier : même statut, même couleur partout. */
export const RENTAL_STATUS_STYLES: Record<RentalStatus, { background: string; text: string; dot: string }> = {
  en_attente_confirmation: { background: M3akPalette.warningLight, text: M3akPalette.warningText, dot: M3akPalette.warning },
  confirmee: { background: M3akPalette.mauveLight, text: M3akPalette.mauveDeep, dot: M3akPalette.mauve },
  reservee: { background: M3akPalette.mauveLight, text: M3akPalette.mauveDeep, dot: M3akPalette.mauve },
  en_cours: { background: M3akPalette.infoLight, text: M3akPalette.infoText, dot: M3akPalette.info },
  terminee: { background: M3akPalette.successLight, text: M3akPalette.successText, dot: M3akPalette.success },
  annulee: { background: M3akPalette.neutralLight, text: M3akPalette.neutralText, dot: M3akPalette.neutral },
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
