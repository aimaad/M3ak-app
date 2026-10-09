import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { RentalStatus } from './types';

const STYLES: Record<RentalStatus, { background: string; text: string; dot: string }> = {
  en_attente_confirmation: { background: '#fef3c7', text: '#b45309', dot: '#b45309' },
  confirmee: { background: '#e5ebfd', text: '#1f5eff', dot: '#1f5eff' },
  reservee: { background: '#e5ebfd', text: '#1f5eff', dot: '#1f5eff' },
  en_cours: { background: '#f3e8ff', text: '#7c3aed', dot: '#7c3aed' },
  terminee: { background: '#e7f7ec', text: '#15803d', dot: '#15803d' },
  annulee: { background: '#f1f2f5', text: '#5b6478', dot: '#5b6478' },
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
