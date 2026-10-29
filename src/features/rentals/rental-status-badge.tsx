import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { RentalStatus } from './types';
import { M3akPalette } from '@/constants/theme';

/** Couleurs des statuts, partagées avec le calendrier : même statut, même couleur partout. */
export const RENTAL_STATUS_STYLES: Record<RentalStatus, { background: string; text: string; dot: string }> = {
  en_attente_confirmation: { background: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
  confirmee: { background: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
  reservee: { background: '#DBEAFE', text: '#1D4ED8', dot: '#2563EB' },
  en_cours: { background: M3akPalette.mauveDeep, text: '#FFFFFF', dot: M3akPalette.emerald },
  terminee: { background: '#DCFCE7', text: '#166534', dot: '#16A34A' },
  annulee: { background: '#F1EEF7', text: M3akPalette.muted, dot: M3akPalette.muted },
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
