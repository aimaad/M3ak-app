import { router } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Logo } from '@/components/logo';
import { Brand } from '@/constants/theme';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { useLanguage } from '@/i18n/use-language';

import { ArrowLink, DiagonalArrow, formatAmount, HText, MicroLabel, Skeleton, useCompactWidth } from './home-ui';
import type { DashboardMetrics, DashboardPeriod, RentalFocus } from './kpis';
import { DASHBOARD_PERIODS } from './kpis';

const CAR = require('../../../assets/images/home-hero-car.jpg');

const PERIOD_KEY: Record<DashboardPeriod, string> = { today: 'accueil.period.tabs.today', '7d': 'accueil.period.tabs.days7', '30d': 'accueil.period.tabs.days30' };

/** « Bonjour » avant 18 h, « Bonsoir » ensuite. */
export function isEvening(now: Date): boolean {
  return now.getHours() >= 18;
}

type Props = {
  prenom: string;
  initials: string;
  agencyName: string | undefined;
  avatarPath: string | null | undefined;
  availableNow: number;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  metrics: DashboardMetrics;
  showMoney: boolean;
  loading: boolean;
  onOpenProfile: () => void;
  onOpenFocus: (focus: RentalFocus) => void;
};

/**
 * En-tête graphite de l'accueil (fond #202527, de la barre d'état au lien « Voir tous les rapports ») : logo, notifications,
 * avatar, salutation, voiture de l'ouverture, onglets de période, montants (propriétaire) et trois chiffres de la période.
 */
export function HomeHeader({
  prenom,
  initials,
  agencyName,
  avatarPath,
  availableNow,
  period,
  onPeriodChange,
  metrics,
  showMoney,
  loading,
  onOpenProfile,
  onOpenFocus,
}: Props) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const compact = useCompactWidth();
  const now = new Date();
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const dateLabel = now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const microLine = [agencyName?.trim(), dateLabel].filter(Boolean).join(' · ');
  const greeting = prenom
    ? t(isEvening(now) ? 'accueil.home.greeting.evening' : 'accueil.home.greeting.morning', { name: '' }).split('')
    : [t(isEvening(now) ? 'accueil.home.greeting.eveningNoName' : 'accueil.home.greeting.morningNoName')];
  const amountSize = compact ? 24 : 28;
  const suffix = t(`accueil.home.stats.${period}`).toLocaleUpperCase();
  const act = metrics.periodActivity;
  const value = (n: number) => (loading ? '—' : String(n));

  return (
    <View style={{ backgroundColor: Brand.graphite, paddingTop: insets.top + 14, paddingBottom: 58, paddingHorizontal: 20, gap: 20 }}>
      {/* Ligne du haut */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo size={32} tone="light" wordSize={20} gap={8} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <NotificationBell tone="onForest" />
          <Pressable
            onPress={onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel={t('accueil.header.profile')}
            style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.orange, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          >
            <Avatar path={avatarPath} size={42} initials={initials} tone="onDark" />
          </Pressable>
        </View>
      </View>

      {/* Salutation */}
      <View style={{ gap: 6 }}>
        <MicroLabel color={Brand.mutedOnDark} size={11} track={0.16} numberOfLines={1}>
          {microLine}
        </MicroLabel>
        <HText font="display" weight="regular" size={30} color={Brand.white} track={-0.01} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} accessibilityRole="header">
          {greeting[0]}
          {greeting.length > 1 ? (
            <>
              <HText font="display" weight="bold" size={30} color={Brand.white} track={-0.01}>
                {prenom}
              </HText>
              {greeting[1]}
            </>
          ) : null}
        </HText>
      </View>

      {/* Voiture de l'ouverture + pastille */}
      <View style={{ marginHorizontal: -20, marginVertical: -6, height: 150 }}>
        <Image source={CAR} style={{ width: '100%', height: 150 }} resizeMode="cover" accessibilityIgnoresInvertColors accessible={false} />
        <View
          style={{
            position: 'absolute',
            start: 20,
            bottom: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'rgba(32,37,39,0.9)',
            borderWidth: 1,
            borderColor: Brand.strokeOnDark,
            borderRadius: 20,
            paddingVertical: 6,
            paddingStart: 10,
            paddingEnd: 12,
          }}
        >
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: availableNow > 0 ? Brand.successOnDark : Brand.mutedOnDark }} />
          <HText weight="medium" size={12} color={Brand.textOnDark}>
            {availableNow > 0 ? t('accueil.home.available', { count: availableNow }) : t('accueil.home.noneAvailable')}
          </HText>
        </View>
      </View>

      {/* Onglets de période */}
      <View
        accessibilityRole="tablist"
        accessibilityLabel={t('accueil.home.periodLabel')}
        style={{ flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderBottomColor: Brand.borderOnDark }}
      >
        {DASHBOARD_PERIODS.map((key) => {
          const selected = key === period;
          return (
            <Pressable
              key={key}
              onPress={() => onPeriodChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={{ height: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: selected ? Brand.orange : 'transparent', marginBottom: -1 }}
            >
              <HText weight={selected ? 'semibold' : 'medium'} size={14} color={selected ? Brand.white : Brand.mutedOnDark}>
                {t(PERIOD_KEY[key])}
              </HText>
            </Pressable>
          );
        })}
      </View>

      {/* Montants (propriétaire) */}
      {showMoney ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, borderWidth: 1, borderColor: Brand.borderOnDark, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 14, gap: 8 }}>
            <MicroLabel color={Brand.mutedOnDark} size={10} track={0.14} numberOfLines={1}>
              {t('accueil.home.money.collected')}
            </MicroLabel>
            {loading ? (
              <Skeleton height={28} radius={6} width="70%" />
            ) : (
              <Amount value={metrics.revenue.current} size={amountSize} unitColor={Brand.mutedOnDark} unit={t('accueil.home.money.currency')} />
            )}
            <HText size={12} color={Brand.mutedOnDark} numberOfLines={2}>
              {metrics.revenue.current === 0
                ? t('accueil.home.money.none')
                : metrics.revenue.changePct === null
                  ? t('accueil.home.money.noComparison')
                  : t('accueil.home.money.vsPrevious', { pct: `${metrics.revenue.changePct > 0 ? '+' : ''}${metrics.revenue.changePct}` })}
            </HText>
          </View>
          <Pressable
            onPress={() => router.push('/accueil/impayes')}
            accessibilityRole="button"
            accessibilityLabel={`${t('accueil.home.money.remaining')} : ${formatAmount(metrics.outstanding.total)} ${t('accueil.home.money.currency')}`}
            style={{ flex: 1, borderWidth: 1, borderColor: Brand.orange, backgroundColor: Brand.orangeDeep, borderRadius: 18, paddingVertical: 16, paddingHorizontal: 14, gap: 8 }}
          >
            <MicroLabel color={Brand.orangeLight} size={10} track={0.14} numberOfLines={1}>
              {t('accueil.home.money.remaining')}
            </MicroLabel>
            {loading ? (
              <Skeleton height={28} radius={6} width="70%" />
            ) : (
              <Amount value={metrics.outstanding.total} size={amountSize} unitColor={Brand.orangeLight} unit={t('accueil.home.money.currency')} />
            )}
            <HText size={12} color={Brand.textOnDark} numberOfLines={2}>
              {t('accueil.home.money.unpaid', { count: metrics.outstanding.count })}
            </HText>
          </Pressable>
        </View>
      ) : null}

      {/* Trois chiffres de la période */}
      <View style={{ flexDirection: 'row' }}>
        <Stat label={t('accueil.home.stats.active')} suffix={suffix} value={value(act.active)} onPress={() => onOpenFocus('active')} edge="start" a11y={t('accueil.home.stats.a11y', { label: t('accueil.home.stats.active'), suffix: t(`accueil.home.stats.${period}`), value: act.active })} />
        <Stat label={t('accueil.home.stats.departures')} suffix={suffix} value={value(act.departures)} onPress={() => onOpenFocus('departures')} arrow={<DiagonalArrow direction="out" color={Brand.orangeLight} />} edge="middle" a11y={t('accueil.home.stats.a11y', { label: t('accueil.home.stats.departures'), suffix: t(`accueil.home.stats.${period}`), value: act.departures })} />
        <Stat label={t('accueil.home.stats.returns')} suffix={suffix} value={value(act.returns)} onPress={() => onOpenFocus('returns')} arrow={<DiagonalArrow direction="in" color={Brand.successOnDark} />} edge="end" a11y={t('accueil.home.stats.a11y', { label: t('accueil.home.stats.returns'), suffix: t(`accueil.home.stats.${period}`), value: act.returns })} />
      </View>

      <View style={{ alignSelf: 'flex-start' }}>
        <ArrowLink label={t('accueil.home.reports')} onPress={() => router.push('/rapports')} onDark />
      </View>
    </View>
  );
}

function Amount({ value, size, unit, unitColor }: { value: number; size: number; unit: string; unitColor: string }) {
  return (
    <HText font="display" weight="semibold" size={size} color={Brand.white} track={-0.02} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ lineHeight: size + 2 }}>
      {formatAmount(value)}
      <HText weight="medium" size={13} color={unitColor}>{` ${unit}`}</HText>
    </HText>
  );
}

function Stat({
  label,
  suffix,
  value,
  onPress,
  arrow,
  edge,
  a11y,
}: {
  label: string;
  suffix: string;
  value: string;
  onPress: () => void;
  arrow?: React.ReactNode;
  edge: 'start' | 'middle' | 'end';
  a11y: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{
        flex: 1,
        minHeight: 44,
        gap: 6,
        paddingVertical: 4,
        paddingStart: edge === 'start' ? 0 : 12,
        paddingEnd: edge === 'end' ? 0 : 12,
        borderEndWidth: edge === 'end' ? 0 : 1,
        borderEndColor: Brand.borderOnDark,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <HText font="display" weight="semibold" size={24} color={Brand.white} style={{ lineHeight: 26 }}>
          {value}
        </HText>
        {arrow}
      </View>
      <View>
        <MicroLabel color={Brand.mutedOnDark} size={10} track={0.1} numberOfLines={1} style={{ lineHeight: 14 }}>
          {label}
        </MicroLabel>
        <MicroLabel color={Brand.mutedOnDark} size={10} track={0.1} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ lineHeight: 14 }}>
          {suffix}
        </MicroLabel>
      </View>
    </Pressable>
  );
}
