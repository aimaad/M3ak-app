import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { ContractStatus } from './types';
import { BibipPalette } from '@/constants/theme';

const STYLES: Record<ContractStatus, { background: string; text: string; dot: string }> = {
  preparation: { background: '#F0EEE5', text: BibipPalette.muted, dot: BibipPalette.muted },
  pret_a_signer: { background: '#FBF1DE', text: '#8A5A0B', dot: '#8A5A0B' },
  signe: { background: '#E8EEF9', text: '#5479C7', dot: '#5479C7' },
  en_cours: { background: '#E8EEF9', text: '#3F62AD', dot: '#3F62AD' },
  cloture: { background: '#E3F3E8', text: '#1E6B3A', dot: '#1E6B3A' },
  annule: { background: '#FBE8E6', text: '#C8443B', dot: '#C8443B' },
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
