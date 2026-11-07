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

import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, Brand, Palette } from '@/constants/theme';
import { useLanguage } from '@/i18n/use-language';

import { DASHBOARD_PERIODS, type DashboardPeriod } from './kpis';

const LABEL_KEY: Record<DashboardPeriod, string> = {
  today: 'accueil.period.tabs.today',
  '7d': 'accueil.period.tabs.days7',
  '30d': 'accueil.period.tabs.days30',
};

/** Durée de la transition d'un bouton à l'autre : fluide, sans rebond. */
const TRANSITION_MS = 220;
const FILL = { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } as const;

/**
 * Un bouton de période. Le fond graphite du bouton choisi apparaît en fondu pendant que la largeur du bouton glisse de 1 à
 * 1,4 : l'indicateur passe d'un bouton à l'autre en 220 ms, sur le fil d'interface. Aplats uniques, aucune ombre colorée.
 * Hauteur 42, rayon 21, marges intérieures 8, espace de 7 entre icône et texte.
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

  const bodyStyle = useAnimatedStyle(() => ({ flexGrow: 1 + 0.4 * progress.value }));
  const pillStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <Animated.View
      style={[
        {
          flexShrink: 0,
          flexBasis: 'auto',
          height: 42,
          borderRadius: 21,
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
        style={{ flex: 1, borderRadius: 21, overflow: 'hidden', gap: 7, paddingHorizontal: 8 }}
      >
        <Animated.View
          pointerEvents="none"
          style={[FILL, { borderRadius: 21, backgroundColor: Brand.graphite }, pillStyle]}
        />

        {showIcon ? (
          <Ionicons name="calendar-outline" size={17} color={selected ? Brand.white : Palette.textSecondary} />
        ) : null}
        <ThemedText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{
            fontSize: 13.5,
            lineHeight: 18,
            color: selected ? Brand.white : Palette.textSecondary,
            fontFamily: fontFamilyFor(language, selected ? 'bold' : 'semibold'),
          }}
        >
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Sélecteur de période posé sur le hero : Aujourd'hui / 7 jours / 30 jours. Gélule blanche cernée d'une bordure ; la période
 * choisie est un bouton plus large en graphite, texte blanc (≥ 12:1). 50 dp de haut, aucune ombre.
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
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('accueil.period.label')}
      style={{
        height: 50,
        borderRadius: 25,
        backgroundColor: Palette.card,
        borderWidth: 1,
        borderColor: Palette.border,
      }}
    >
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
