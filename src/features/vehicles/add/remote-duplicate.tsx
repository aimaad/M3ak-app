import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

/** Doublon dans une autre filiale : on ne peut pas ouvrir sa fiche (elle n'est pas visible), on dit seulement où il existe. */
export function RemoteDuplicateNotice({ branchName }: { branchName: string | null }) {
  const { t } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Palette.warningSoft, borderWidth: 1, borderColor: Palette.warning, borderRadius: 18, padding: 14 }} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={22} color={Palette.warning} />
      <View style={{ flex: 1, gap: 2 }}>
        <HText weight="bold" size={14} color={Palette.warning}>
          {t('vehicleAdd.exists.title')}
        </HText>
        <HText size={13} color={Palette.warning} style={{ lineHeight: 18 }}>
          {branchName ? t('vehicleAdd.exists.inBranch', { branch: branchName }) : t('vehicleAdd.exists.inAgency')}
        </HText>
        <HText size={12} color={Palette.warning} style={{ lineHeight: 17 }}>
          {t('vehicleAdd.exists.hint')}
        </HText>
      </View>
    </View>
  );
}
