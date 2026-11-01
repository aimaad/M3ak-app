import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { ContractStatus } from './types';
import { M3akPalette } from '@/constants/theme';

const STYLES: Record<ContractStatus, { background: string; text: string; dot: string }> = {
  preparation: { background: '#F1EEF7', text: M3akPalette.muted, dot: M3akPalette.muted },
  pret_a_signer: { background: '#FBF1DE', text: '#8A5A0B', dot: '#8A5A0B' },
  signe: { background: '#E8EEF9', text: '#5479C7', dot: '#5479C7' },
  en_cours: { background: '#E8EEF9', text: '#3F62AD', dot: '#3F62AD' },
  cloture: { background: '#E3F3EE', text: '#116B54', dot: '#116B54' },
  annule: { background: '#F8E6E9', text: '#C55461', dot: '#C55461' },
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const { t } = useLanguage();
  const style = STYLES[status];

  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full px-3 py-1" style={{ backgroundColor: style.background }}>
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      <ThemedText type="small" style={{ color: style.text }}>
        {t(`contract.status.${status}`)}
      </ThemedText>
    </View>
  );
}
