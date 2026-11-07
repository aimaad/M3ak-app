import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

import type { ContractStatus } from './types';
import { Palette } from '@/constants/theme';

const STYLES: Record<ContractStatus, { background: string; text: string; dot: string }> = {
  preparation: { background: Palette.surfaceAlt, text: Palette.textSecondary, dot: Palette.textSecondary },
  pret_a_signer: { background: Palette.warningSoft, text: Palette.warning, dot: Palette.warning },
  signe: { background: Palette.infoSoft, text: Palette.info, dot: Palette.info },
  en_cours: { background: Palette.infoSoft, text: Palette.info, dot: Palette.info },
  cloture: { background: Palette.successSoft, text: Palette.success, dot: Palette.success },
  annule: { background: Palette.errorSoft, text: Palette.error, dot: Palette.error },
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
