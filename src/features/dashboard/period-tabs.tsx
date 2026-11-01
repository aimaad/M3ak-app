import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette, Shadows } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { DASHBOARD_PERIODS, type DashboardPeriod } from './kpis';

const LABEL_KEY: Record<DashboardPeriod, string> = {
  today: 'accueil.period.tabs.today',
  '7d': 'accueil.period.tabs.days7',
  '30d': 'accueil.period.tabs.days30',
};

/**
 * Sélecteur de période de l'accueil : Aujourd'hui / 7 jours / 30 jours. Trois boutons de même largeur (44 dp de haut au
 * minimum), le choisi est plein (mauve signature, texte blanc : 7,45:1).
 */
export function PeriodTabs({ value, onChange }: { value: DashboardPeriod; onChange: (period: DashboardPeriod) => void }) {
  const { t, language } = useLanguage();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('accueil.period.label')}
      className="flex-row rounded-full border border-line bg-white p-1"
      style={{ gap: 4, ...Shadows.card }}
    >
      {DASHBOARD_PERIODS.map((period) => {
        const selected = period === value;
        return (
          <Pressable
            key={period}
            onPress={() => onChange(period)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="min-h-11 flex-1 flex-row items-center justify-center rounded-full px-2"
            style={{ gap: 6, backgroundColor: selected ? M3akPalette.primary : 'transparent' }}
          >
            <Ionicons name="calendar-outline" size={16} color={selected ? M3akPalette.onPrimary : M3akPalette.muted} />
            <ThemedText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{
                fontSize: 13.5,
                lineHeight: 18,
                color: selected ? M3akPalette.onPrimary : M3akPalette.muted,
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
