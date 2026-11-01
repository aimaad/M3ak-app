import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
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

/** Durée de la transition d'un bouton à l'autre : fluide, sans rebond. */
const TRANSITION_MS = 220;
const FILL = { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 } as const;

/**
 * Un bouton de période. Le « violet verre » du bouton choisi (dégradé, reflet, liseré, halo) apparaît en fondu pendant que
 * la largeur du bouton glisse de 1 à 1,4 : l'indicateur passe d'un bouton à l'autre en 220 ms, sur le fil d'interface.
 * Même géométrie qu'avant : hauteur 42, rayon 21, marges intérieures 8, espace de 7 entre icône et texte.
 */
function PeriodTab({
  label,
  selected,
  showIcon,
  onPress,
}: {
  label: string;
  selected: boolean;
  showIcon: boolean;
  onPress: () => void;
}) {
  const { language } = useLanguage();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    const target = selected ? 1 : 0;
    progress.value = reduceMotion
      ? target
      : withTiming(target, { duration: TRANSITION_MS, easing: Easing.inOut(Easing.cubic) });
  }, [selected, reduceMotion, progress]);

  const bodyStyle = useAnimatedStyle(() => ({
    flexGrow: 1 + 0.4 * progress.value,
    shadowOpacity: 0.6 * progress.value,
    elevation: 4 * progress.value,
  }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      style={[
        {
          flexShrink: 0,
          flexBasis: 'auto',
          height: 42,
          borderRadius: 21,
          // Halo plus mesuré qu'avant (intensité 1 → 0,6, rayon 16 → 13) : verre poli, pas néon.
          shadowColor: '#D58BFF',
          shadowRadius: 13,
          shadowOffset: { width: 0, height: 0 },
        },
        bodyStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        className="flex-row items-center justify-center"
        style={{ flex: 1, borderRadius: 21, gap: 7, paddingHorizontal: 8 }}
      >
        {/* Calques fixés aux quatre bords : sans cela le violet démarrerait après les marges du bouton. */}
        <Animated.View pointerEvents="none" style={[FILL, { borderRadius: 21 }, pillStyle]}>
          <View style={[FILL, { borderRadius: 21, overflow: 'hidden' }]}>
            <Svg width="100%" height="100%" preserveAspectRatio="none" style={FILL}>
              <Defs>
                <LinearGradient id="kp-selected" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#B96AF6" />
                  <Stop offset="0.55" stopColor="#9A45E2" />
                  <Stop offset="1" stopColor="#8433CF" />
                </LinearGradient>
                <LinearGradient id="kp-shine" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.46" />
                  <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.07" />
                  <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#kp-selected)" />
              <Rect width="100%" height="55%" fill="url(#kp-shine)" />
            </Svg>
          </View>
          {/* Reflet intérieur très discret : un filet clair en haut et un liseré fin à l'intérieur du contour. */}
          <View
            style={{
              position: 'absolute',
              top: 2,
              start: 14,
              end: 14,
              height: 1,
              borderRadius: 1,
              backgroundColor: 'rgba(255,255,255,0.5)',
            }}
          />
          <View
            style={[
              FILL,
              { borderRadius: 21, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
            ]}
          />
          <View
            style={{
              position: 'absolute',
              top: 2,
              bottom: 2,
              start: 2,
              end: 2,
              borderRadius: 19,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.12)',
            }}
          />
        </Animated.View>

        {showIcon ? <Ionicons name="calendar-outline" size={17} color="#FFFFFF" /> : null}
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
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Sélecteur de période posé sur le hero : Aujourd'hui / 7 jours / 30 jours. Gélule de verre sombre (fond aubergine
 * translucide, reflet clair, liseré lavande, halo violet mesuré) ; la période choisie est un bouton plus large en dégradé
 * violet lumineux avec reflet intérieur, liseré blanc et halo. 50 dp de haut ; blanc sur le dégradé : au moins 4,9:1.
 */
export function PeriodTabs({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  const { t } = useLanguage();
  // Sous 340 dp de large, les icônes sont retirées pour que les trois libellés tiennent en entier.
  const showIcons = useWindowDimensions().width >= 340;
  return (
    // Verre : fond aubergine translucide, reflet clair sur la moitié haute, liseré lavande et halo violet.
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('accueil.period.label')}
      style={{
        height: 50,
        borderRadius: 25,
        shadowColor: '#CB83F5',
        shadowOpacity: 0.32,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 5 },
        elevation: 4,
      }}
    >
      <View
        pointerEvents="none"
        style={[
          FILL,
          {
            borderRadius: 25,
            overflow: 'hidden',
            backgroundColor: 'rgba(40,16,62,0.62)',
            borderWidth: 1,
            borderColor: 'rgba(214,160,250,0.6)',
          },
        ]}
      >
        <Svg width="100%" height="100%" preserveAspectRatio="none" style={FILL}>
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
        {DASHBOARD_PERIODS.map((period) => (
          <PeriodTab
            key={period}
            label={t(LABEL_KEY[period])}
            selected={period === value}
            showIcon={showIcons}
            onPress={() => onChange(period)}
          />
        ))}
      </View>
    </View>
  );
}
