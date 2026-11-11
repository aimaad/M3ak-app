import { Pressable, View } from 'react-native';

import { BibipSymbol } from '@/components/logo';
import { Brand } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import type { Advice } from './fleet-advice';
import { formatDayLabel } from './fleet-card';
import { lateDurationText } from './fleet-card-text';

/**
 * Carte « Conseil BIBIP » (propriétaire seulement) : un seul conseil, calculé localement. « Créer l'offre » ou « Inspecter » selon
 * le conseil, et « Plus tard » qui le masque 24 h.
 */
export function AdviceCard({ advice, onAct, onLater, now }: { advice: Advice; onAct: () => void; onLater: () => void; now: Date }) {
  const { t, language } = useLanguage();
  const isLate = advice.kind === 'late';
  const prefix = t(isLate ? 'flotte.advice.latePrefix' : advice.kind === 'noBooking' ? 'flotte.advice.noBookingPrefix' : 'flotte.advice.waitingPrefix');
  let suffix: string;
  let actLabel: string;
  if (advice.kind === 'late') {
    // « La Dacia Sandero devait revenir mer. 28 oct. : 13 jours de retard. Fouad B. ne l'a pas rendue. »
    suffix =
      t('flotte.advice.lateSuffix', { date: formatDayLabel(advice.dueDay, language, 'short', now), duration: lateDurationText(advice.late, t) }) +
      (advice.customerName ? t('flotte.advice.lateClient', { name: advice.customerName }) : '');
    actLabel = !advice.phone ? t('flotte.advice.openRental') : advice.customerName ? t('flotte.advice.callClient', { name: advice.customerName }) : t('flotte.advice.callClientNoName');
  } else {
    suffix = t(advice.kind === 'noBooking' ? 'flotte.advice.noBookingSuffix' : 'flotte.advice.waitingSuffix', { days: advice.kind === 'waitingInspection' ? advice.days : 0 });
    actLabel = t(advice.kind === 'noBooking' ? 'flotte.advice.createOffer' : 'flotte.advice.inspect');
  }
  const label = t(isLate ? 'flotte.advice.lateLabel' : 'flotte.advice.label');
  const pill = { height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: 'center' as const, justifyContent: 'center' as const };

  return (
    <View style={{ backgroundColor: Brand.orangeDeep, borderWidth: 1, borderColor: Brand.orangeDeepBorder, borderRadius: 20, padding: 14, gap: 12 }}>
      <View accessible accessibilityLabel={`${label}. ${prefix}${advice.vehicleName}${suffix}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center', shadowColor: Brand.orange, shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } }}>
          <BibipSymbol size={22} tone="light" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <MicroLabel size={10} track={0.16} color={isLate ? Brand.errorOnDark : Brand.orangeLight}>
            {label}
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingStart: 48 }}>
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
