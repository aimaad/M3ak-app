import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  Pressable,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BRAND_NAME, LogoMark } from '@/components/logo';
import { ThemedText } from '@/components/themed-text';
import { Brand, fontFamilyFor, Palette, Themes } from '@/constants/theme';
import { NotificationBell } from '@/features/notifications/notification-bell';
import {
  endOpening,
  startOpening,
  useAssetsReady,
  useOpeningStatus,
} from '@/features/opening/opening-store';
import { useLanguage } from '@/i18n/use-language';
import { getInitials } from '@/lib/initials';

import { headerFirstName } from './header-format';
import { HERO_DARK, HERO_FADE_HEIGHT, HeroCar, HeroScene } from './hero-scene';
import type { DashboardPeriod } from './kpis';
import { PeriodTabs } from './period-tabs';

const DARK = HERO_DARK;
const FADE_HEIGHT = HERO_FADE_HEIGHT;
const TABS_GAP = 21;
/** Hauteur de la petite barre fixe (sous la zone de sécurité). */
const COMPACT_BAR = 56;

/** Rond de profil (photo ou initiales) à contour lavande : ouvre le profil. Même bouton dans le hero et dans la petite barre. */
function ProfileButton({ path, initials }: { path: string | null | undefined; initials: string }) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={() => router.push('/profil')}
      accessibilityRole="button"
      accessibilityLabel={t('accueil.header.profile')}
      className="h-11 w-11 items-center justify-center rounded-full border-2 border-orange-light active:border-white"
    >
      <Avatar path={path} size={40} initials={initials} />
    </Pressable>
  );
}

/** Bouton rond de 44 × 44 : disque translucide et trait fin. */
function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full border"
      style={({ pressed }) => ({
        backgroundColor: pressed ? Themes.dark.surfaceAlt : Themes.dark.surface,
        borderColor: Themes.dark.border,
      })}
    >
      <Ionicons name={icon} size={21} color={Brand.white} />
    </Pressable>
  );
}

type DashboardHeaderProps = {
  /** Prénom du profil (peut manquer). */
  prenom?: string | null;
  /** Nom complet, utilisé si le prénom manque. */
  fullName?: string | null;
  agencyName?: string | null;
  avatarPath?: string | null;
  /** Période choisie (Aujourd'hui / 7 jours / 30 jours) et son changement : le sélecteur est posé sur le bas du hero. */
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  /** Hauteur mesurée du hero (pour que la petite barre sache quand apparaître). */
  onHeight?: (height: number) => void;
  /** Position de défilement de la page : sert uniquement à la parallaxe discrète de la photo. */
  scrollY?: SharedValue<number>;
};

/**
 * Hero du tableau de bord : photo, logo M3ak et actions (question à M3ak, notifications, profil), salutation, accroche et
 * sélecteur de période. Il fait partie du contenu de la page et défile normalement avec elle (il ne reste pas collé en haut).
 * Aucune largeur fixe : tout se réduit ou se coupe proprement jusqu'à 320 dp.
 */
export function DashboardHeader({
  prenom,
  fullName,
  agencyName,
  avatarPath,
  period,
  onPeriodChange,
  onHeight,
  scrollY,
}: DashboardHeaderProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // Ouverture (noir → voiture qui s'allume → moteur) : voir features/opening. Elle se pose par-dessus l'application.
  const opening = useOpeningStatus();
  const assetsReady = useAssetsReady();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // Dès que le hero est mesuré et que les images de l'ouverture sont chargées, on lance la chronologie.
  useEffect(() => {
    if (opening === 'armed' && assetsReady && size) startOpening();
  }, [opening, assetsReady, size]);
  const logoHeight = screenWidth < 340 ? 40 : screenWidth < 375 ? 46 : 52;
  const showName = screenWidth >= 340;
  const showAgency = screenWidth >= 375 && !!agencyName?.trim();

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => {
      if (
        previous &&
        Math.abs(previous.width - width) < 1 &&
        Math.abs(previous.height - height) < 1
      )
        return previous;
      onHeight?.(height);
      return { width, height };
    });
  };

  const firstName = headerFirstName(prenom, fullName);
  const initials = getInitials(fullName ?? firstName);
  const greeting = firstName
    ? t('accueil.header.greeting', { name: firstName })
    : t('accueil.header.greetingNoName');
  // Le prénom est mis en lavande lumineuse : on coupe le texte traduit autour d'un repère à la place du prénom.
  const MARKER = '\uE000';
  const greetingParts = firstName
    ? t('accueil.header.greeting', { name: MARKER }).split(MARKER)
    : null;
  const hasTwoParts = greetingParts?.length === 2;

  return (
    <View onLayout={onLayout} style={{ backgroundColor: DARK, overflow: 'hidden' }}>
      {/* Les onglets restent montés : on ne règle la barre d'état (icônes claires) que lorsque l'Accueil est affiché. */}
      {focused ? <StatusBar style="light" /> : null}
      {size ? (
        <>
          <HeroScene
            width={size.width}
            height={size.height}
            scrollY={scrollY}
            reduceMotion={reduceMotion}
            onError={() => endOpening('aborted')}
          />
          <HeroCar
            width={size.width}
            height={size.height}
            scrollY={scrollY}
            reduceMotion={reduceMotion}
          />
        </>
      ) : null}

      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: FADE_HEIGHT,
          paddingStart: insets.left + 20,
          paddingEnd: insets.right + 20,
        }}
      >
        <View className="flex-row items-center justify-between" style={{ minHeight: 48, gap: 12 }}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={BRAND_NAME}
            style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <LogoMark height={logoHeight} onDark />
            {showName ? (
              <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    width: 1,
                    height: logoHeight * 0.62,
                    backgroundColor: Themes.dark.border,
                  }}
                />
                <View className="shrink">
                  <ThemedText
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={{
                      color: Brand.white,
                      fontSize: 22,
                      lineHeight: 26,
                      letterSpacing: -0.3,
                      fontFamily: fontFamilyFor('fr', 'extrabold'),
                    }}
                  >
                    {BRAND_NAME}
                  </ThemedText>
                  {showAgency ? (
                    <ThemedText
                      numberOfLines={1}
                      style={{
                        color: Themes.dark.textSecondary,
                        fontSize: 11,
                        lineHeight: 14,
                        fontFamily: fontFamilyFor(language, 'medium'),
                      }}
                    >
                      {agencyName?.trim()}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
          <View className="shrink-0 flex-row items-center" style={{ gap: 8 }}>
            <HeaderIconButton
              icon="search-outline"
              label={t('accueil.header.search')}
              onPress={() => router.push('/chat')}
            />
            <NotificationBell tone="onForest" />
            <ProfileButton path={avatarPath} initials={initials} />
          </View>
        </View>

        <View style={{ marginTop: 18, maxWidth: '62%' }}>
          <ThemedText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            accessibilityRole="header"
            style={{
              color: Brand.white,
              fontSize: 24,
              lineHeight: 31,
              fontFamily: fontFamilyFor(language, 'bold'),
            }}
          >
            {greetingParts && hasTwoParts ? (
              <>
                {greetingParts[0]}
                <ThemedText
                  style={{
                    color: Brand.orangeLight,
                    fontSize: 24,
                    lineHeight: 31,
                    fontFamily: fontFamilyFor(language, 'bold'),
                  }}
                >
                  {firstName}
                </ThemedText>
                {greetingParts[1]}
              </>
            ) : (
              greeting
            )}
          </ThemedText>
          <ThemedText
            numberOfLines={3}
            style={{
              marginTop: 4,
              maxWidth: '100%',
              color: Themes.dark.textPrimary,
              fontSize: 11.5,
              lineHeight: 16,
              fontFamily: fontFamilyFor(language, 'medium'),
            }}
          >
            {t('accueil.header.tagline')}
          </ThemedText>
          {/* Petite ligne décorative : orange clair uni (l'accent de la marque sur fond sombre). */}
          <View style={{ marginTop: 12, width: 38, height: 3, borderRadius: 2, backgroundColor: Brand.orangeLight }} />
        </View>

        <View style={{ marginTop: TABS_GAP + 6 }}>
          <PeriodTabs value={period} onChange={onPeriodChange} />
        </View>
      </View>
    </View>
  );
}

/**
 * Petite barre fixe en haut (logo M3ak, notifications, profil) : invisible tant que le hero est à l'écran, elle apparaît en
 * fondu dès que le hero a défilé et reste alors collée en haut. `scrollY` vient de la liste (fil d'interface, sans saccade).
 */
export function CompactTopBar({
  scrollY,
  heroHeight,
  prenom,
  fullName,
  avatarPath,
}: {
  scrollY: SharedValue<number>;
  heroHeight: number;
  prenom?: string | null;
  fullName?: string | null;
  avatarPath?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const barHeight = insets.top + COMPACT_BAR;
  // Elle apparaît quand les boutons du hero (en haut) sortent de l'écran, bien avant la fin du hero.
  const from = Math.max(insets.top + 40, Math.min(heroHeight - barHeight - 40, 120));
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [from, from + 50], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [from, from + 50], [-10, 0], Extrapolation.CLAMP) },
    ],
  }));
  const props = useAnimatedProps(() => ({
    pointerEvents: scrollY.value > from + 20 ? ('auto' as const) : ('none' as const),
  }));
  const initials = getInitials(fullName ?? headerFirstName(prenom, fullName));

  return (
    <Animated.View
      animatedProps={props}
      style={[
        {
          position: 'absolute',
          top: 0,
          start: 0,
          end: 0,
          height: barHeight,
          paddingTop: insets.top,
          paddingStart: insets.left + 20,
          paddingEnd: insets.right + 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          backgroundColor: DARK,
          borderBottomWidth: 1,
          borderBottomColor: Themes.dark.border,
          // Barre flottante : seule ombre autorisée, grise et très légère.
          shadowColor: Palette.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        },
        style,
      ]}
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={BRAND_NAME}
        className="shrink flex-row items-center"
        style={{ gap: 8 }}
      >
        <LogoMark height={40} onDark />
        <ThemedText
          numberOfLines={1}
          style={{
            color: Brand.white,
            fontSize: 20,
            lineHeight: 24,
            letterSpacing: -0.3,
            fontFamily: fontFamilyFor('fr', 'extrabold'),
          }}
        >
          {BRAND_NAME}
        </ThemedText>
      </View>
      <View className="shrink-0 flex-row items-center" style={{ gap: 8 }}>
        <NotificationBell tone="onForest" />
        <ProfileButton path={avatarPath} initials={initials} />
      </View>
    </Animated.View>
  );
}
