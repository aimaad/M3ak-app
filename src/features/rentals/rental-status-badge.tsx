import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { RentalStatus } from './types';

const STYLES: Record<RentalStatus, { background: string; text: string; dot: string }> = {
  en_attente_confirmation: { background: '#FEF3C7', text: '#B45309', dot: '#B45309' },
  confirmee: { background: '#DBEAFE', text: '#2563EB', dot: '#2563EB' },
  reservee: { background: '#DBEAFE', text: '#2563EB', dot: '#2563EB' },
  en_cours: { background: '#E0F2FE', text: '#0369A1', dot: '#0369A1' },
  terminee: { background: '#DCFCE7', text: '#15803D', dot: '#15803D' },
  annulee: { background: '#F1EEF7', text: '#81778F', dot: '#81778F' },
};

export function RentalStatusBadge({ status }: { status: RentalStatus }) {
  const { t } = useLanguage();
  const style = STYLES[status];

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
