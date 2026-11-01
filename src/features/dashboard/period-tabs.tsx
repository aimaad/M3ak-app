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
  const fill = { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 } as const;
  return (
    // Verre : fond aubergine translucide, reflet clair sur la moitié haute, liseré lavande et halo violet.
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('accueil.period.label')}
      style={{
        height: 50,
        borderRadius: 25,
        shadowColor: '#CB83F5',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 5 },
        elevation: 4,
      }}
    >
      <View
        pointerEvents="none"
        style={[
          fill,
          {
            borderRadius: 25,
            overflow: 'hidden',
            backgroundColor: 'rgba(40,16,62,0.62)',
            borderWidth: 1,
            borderColor: 'rgba(214,160,250,0.6)',
          },
        ]}
      >
        <Svg width="100%" height="100%" preserveAspectRatio="none" style={fill}>
          <Defs>
            <LinearGradient id="kp-glass" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.04" />
              <Stop offset="1" stopColor="#CB83F5" stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#kp-glass)" />
        </Svg>
      </View>

      <View className="flex-1 flex-row items-center" style={{ paddingHorizontal: 4, gap: 2 }}>
        {DASHBOARD_PERIODS.map((period) => {
          const selected = period === value;
          return (
            <Pressable
              key={period}
              onPress={() => onChange(period)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className="flex-row items-center justify-center"
              style={{
                // Largeur d'après le contenu (« Aujourd'hui » n'est jamais coupé), le reste réparti ; le bouton choisi en reçoit un peu plus.
                flexGrow: selected ? 1.4 : 1,
                flexShrink: 0,
                flexBasis: 'auto',
                height: 42,
                borderRadius: 21,
                gap: 7,
                paddingHorizontal: 8,
                ...(selected
                  ? {
                      shadowColor: '#D58BFF',
                      shadowOpacity: 1,
                      shadowRadius: 16,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 6,
                    }
                  : null),
              }}
            >
              {selected ? (
                <>
                  {/* Les calques sont fixés aux quatre bords : sans cela le violet démarrait après les marges du bouton. */}
                  <View
                    pointerEvents="none"
                    style={[fill, { borderRadius: 21, overflow: 'hidden' }]}
                  >
                    <Svg width="100%" height="100%" preserveAspectRatio="none" style={fill}>
                      <Defs>
                        <LinearGradient id="kp-selected" x1="0" y1="0" x2="1" y2="1">
                          <Stop offset="0" stopColor="#B96AF6" />
                          <Stop offset="0.55" stopColor="#9A45E2" />
                          <Stop offset="1" stopColor="#8433CF" />
                        </LinearGradient>
                        <LinearGradient id="kp-shine" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.5" />
                          <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.08" />
                          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                        </LinearGradient>
                      </Defs>
                      <Rect width="100%" height="100%" fill="url(#kp-selected)" />
                      <Rect width="100%" height="55%" fill="url(#kp-shine)" />
                    </Svg>
                  </View>
                  <View
                    pointerEvents="none"
                    style={[
                      fill,
                      { borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
                    ]}
                  />
                </>
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
                  ...(selected
                    ? {
                        textShadowColor: 'rgba(50,10,90,0.5)',
                        textShadowRadius: 3,
                        textShadowOffset: { width: 0, height: 1 },
                      }
                    : null),
                }}
              >
                {t(LABEL_KEY[period])}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
