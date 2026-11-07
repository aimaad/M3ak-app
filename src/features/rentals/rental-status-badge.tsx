import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { RentalStatus } from './types';
import { BibipPalette } from '@/constants/theme';

/** Couleurs des statuts, partagées avec le calendrier : même statut, même couleur partout. */
export const RENTAL_STATUS_STYLES: Record<RentalStatus, { background: string; text: string; dot: string }> = {
  en_attente_confirmation: { background: BibipPalette.warningLight, text: BibipPalette.warningText, dot: BibipPalette.warning },
  confirmee: { background: BibipPalette.primaryLight, text: BibipPalette.primaryDeep, dot: BibipPalette.primary },
  reservee: { background: BibipPalette.primaryLight, text: BibipPalette.primaryDeep, dot: BibipPalette.primary },
  en_cours: { background: BibipPalette.infoLight, text: BibipPalette.infoText, dot: BibipPalette.info },
  terminee: { background: BibipPalette.successLight, text: BibipPalette.successText, dot: BibipPalette.success },
  annulee: { background: BibipPalette.neutralLight, text: BibipPalette.neutralText, dot: BibipPalette.neutral },
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
