import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { ContractStatus } from './types';

const STYLES: Record<ContractStatus, { background: string; text: string; dot: string }> = {
  preparation: { background: '#F1EEF7', text: '#5E5575', dot: '#5E5575' },
  pret_a_signer: { background: '#FEF3C7', text: '#B45309', dot: '#B45309' },
  signe: { background: '#DBEAFE', text: '#2563EB', dot: '#2563EB' },
  en_cours: { background: '#E0F2FE', text: '#0369A1', dot: '#0369A1' },
  cloture: { background: '#DCFCE7', text: '#15803D', dot: '#15803D' },
  annule: { background: '#FEE2E2', text: '#DC2626', dot: '#DC2626' },
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
