import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { ContractStatus } from './types';

const STYLES: Record<ContractStatus, { background: string; text: string; dot: string }> = {
  preparation: { background: '#f1f2f5', text: '#5b6478', dot: '#5b6478' },
  pret_a_signer: { background: '#fef3c7', text: '#b45309', dot: '#b45309' },
  signe: { background: '#e5ebfd', text: '#1f5eff', dot: '#1f5eff' },
  en_cours: { background: '#f3e8ff', text: '#7c3aed', dot: '#7c3aed' },
  cloture: { background: '#e7f7ec', text: '#15803d', dot: '#15803d' },
  annule: { background: '#fee2e2', text: '#dc2626', dot: '#dc2626' },
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
