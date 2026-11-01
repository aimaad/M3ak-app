import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { DASHBOARD_PERIODS, type DashboardPeriod } from './kpis';

const LABEL_KEY: Record<DashboardPeriod, string> = {
  today: 'accueil.period.tabs.today',
  '7d': 'accueil.period.tabs.days7',
  '30d': 'accueil.period.tabs.days30',
};

/**
 * Sélecteur de période posé sur le hero : Aujourd'hui / 7 jours / 30 jours. Verre sombre (fond translucide, liseré clair) ;
 * la période choisie est un bouton mauve en dégradé avec un léger halo (blanc dessus : au moins 5,4:1). 48 dp de haut.
 */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  const { t, language } = useLanguage();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('accueil.period.label')}
      className="flex-row rounded-full"
      style={{
        height: 48,
        padding: 4,
        gap: 4,
        backgroundColor: 'rgba(23,19,33,0.62)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
      }}
    >
      {DASHBOARD_PERIODS.map((period) => {
        const selected = period === value;
        return (
          <Pressable
            key={period}
            onPress={() => onChange(period)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="flex-1 flex-row items-center justify-center rounded-full px-2"
            style={[
              { gap: 6, overflow: selected ? 'hidden' : 'visible' },
              selected
                ? {
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.35)',
                    shadowColor: '#8A5CC2',
                    shadowOpacity: 0.7,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 4,
                  }
                : null,
            ]}
          >
            {selected ? (
              <Svg
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                style={{ position: 'absolute' }}
              >
                <Defs>
                  <LinearGradient id="kp-selected" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#8A5CC2" />
                    <Stop offset="1" stopColor="#684394" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#kp-selected)" />
              </Svg>
            ) : null}
            <Ionicons
              name="calendar-outline"
              size={16}
              color={selected ? '#FFFFFF' : 'rgba(255,255,255,0.85)'}
            />
            <ThemedText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{
                fontSize: 13.5,
                lineHeight: 18,
                color: selected ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
                fontFamily: fontFamilyFor(language, selected ? 'bold' : 'semibold'),
              }}
            >
              {t(LABEL_KEY[period])}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
