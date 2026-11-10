import { Pressable, View } from 'react-native';

import { BibipSymbol } from '@/components/logo';
import { Brand } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import type { Advice } from './fleet-advice';

/**
 * Carte « Conseil BIBIP » (propriétaire seulement) : un seul conseil, calculé localement. « Créer l'offre » ou « Inspecter » selon
 * le conseil, et « Plus tard » qui le masque 24 h.
 */
export function AdviceCard({ advice, onAct, onLater }: { advice: Advice; onAct: () => void; onLater: () => void }) {
  const { t } = useLanguage();
  const prefix = t(advice.kind === 'noBooking' ? 'flotte.advice.noBookingPrefix' : 'flotte.advice.waitingPrefix');
  const suffix = t(advice.kind === 'noBooking' ? 'flotte.advice.noBookingSuffix' : 'flotte.advice.waitingSuffix', { days: advice.kind === 'waitingInspection' ? advice.days : 0 });
  const actLabel = t(advice.kind === 'noBooking' ? 'flotte.advice.createOffer' : 'flotte.advice.inspect');
  const pill = { height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <View style={{ backgroundColor: Brand.orangeDeep, borderWidth: 1, borderColor: Brand.orangeDeepBorder, borderRadius: 20, padding: 14, gap: 12 }}>
      <View accessible accessibilityLabel={`${t('flotte.advice.label')}. ${prefix}${advice.vehicleName}${suffix}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center', shadowColor: Brand.orange, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }}>
          <BibipSymbol size={22} tone="light" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <MicroLabel size={10} track={0.16} color={Brand.orangeLight}>
            {t('flotte.advice.label')}
          </MicroLabel>
          <HText size={14} color={Brand.textOnDark} style={{ lineHeight: 20 }}>
            {prefix}
            <HText size={14} weight="semibold" color={Brand.white} style={{ lineHeight: 20 }}>
              {advice.vehicleName}
            </HText>
            {suffix}
          </HText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingStart: 48 }}>
        <Pressable onPress={onAct} accessibilityRole="button" style={[pill, { backgroundColor: Brand.orange, shadowColor: Brand.orange, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }]}>
          <HText weight="semibold" size={13} color={Brand.white}>
            {actLabel}
          </HText>
        </Pressable>
        <Pressable onPress={onLater} accessibilityRole="button" style={[pill, { borderWidth: 1, borderColor: Brand.orangeDeepBorder }]}>
          <HText weight="semibold" size={13} color={Brand.textOnDark}>
            {t('flotte.advice.later')}
          </HText>
        </Pressable>
      </View>
    </View>
  );
}
