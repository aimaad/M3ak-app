import { Ionicons } from '@expo/vector-icons';
import { Pressable, useWindowDimensions, View } from 'react-native';
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
 * Sélecteur de période posé sur le hero : Aujourd'hui / 7 jours / 30 jours. Gélule de verre sombre (fond mauve très foncé
 * translucide, liseré lavande, léger halo) ; la période choisie est un bouton plus large en dégradé violet lumineux, avec un
 * reflet clair en haut, un liseré blanc et un halo ; les autres n'ont que l'icône calendrier et le texte, espacés. 48 dp
 * de haut ; blanc sur le dégradé : au moins 4,9:1.
 */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  const { t, language } = useLanguage();
  // Sous 340 dp de large, les icônes sont retirées pour que les trois libellés tiennent en entier.
  const showIcons = useWindowDimensions().width >= 340;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('accueil.period.label')}
      className="flex-row items-center rounded-full"
      style={{
        height: 48,
        paddingHorizontal: 4,
        backgroundColor: 'rgba(38,16,58,0.66)',
        borderWidth: 1,
        borderColor: 'rgba(203,131,245,0.55)',
        shadowColor: '#CB83F5',
        shadowOpacity: 0.4,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
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
            className="flex-row items-center justify-center rounded-full px-2"
            style={[
              {
                flex: selected ? 1.3 : 1,
                height: 40,
                gap: 7,
                overflow: selected ? 'hidden' : 'visible',
              },
              selected
                ? {
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.6)',
                    shadowColor: '#CB83F5',
                    shadowOpacity: 0.95,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 5,
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
                    <Stop offset="0" stopColor="#A04AE0" />
                    <Stop offset="1" stopColor="#7A2AC0" />
                  </LinearGradient>
                  <LinearGradient id="kp-shine" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.34" />
                    <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#kp-selected)" />
                <Rect width="100%" height="100%" fill="url(#kp-shine)" />
              </Svg>
            ) : null}
            {showIcons ? <Ionicons name="calendar-outline" size={17} color="#FFFFFF" /> : null}
            <ThemedText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{
                fontSize: 13.5,
                lineHeight: 18,
                color: '#FFFFFF',
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
