import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, Pressable, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { useLanguage } from '@/i18n/use-language';
import { getInitials } from '@/lib/initials';

import { headerFirstName } from './header-format';
import type { DashboardPeriod } from './kpis';
import { PeriodTabs } from './period-tabs';

const HERO_IMAGE = require('../../../assets/images/hero-dashboard.jpg');
// Version éclaircie du logo, sur fond transparent : lisible directement sur le fond sombre (sans pastille).
const MARK = require('../../../assets/images/logo-m3ak-ribbon-light.png');
/** Proportions du logo (640 × 373) et de la photo (1000 × 1094). */
const MARK_RATIO = 640 / 373;
const HERO_RATIO = 1094 / 1000;
/** Position verticale du bas de la voiture dans la photo (≈ 67 %). */
const CAR_BOTTOM = 0.67;
/** Largeur de la photo par rapport à l'écran : la voiture occupe la moitié droite, le texte reste à gauche. */
const HERO_WIDTH = 0.76;

const DARK = '#171321';
/** Fondu du bas du hero vers la couleur de la page : pas de bord net. */
const FADE_HEIGHT = 26;
const TABS_HEIGHT = 48;
const TABS_GAP = 16;
/** Espace sous la voiture : sélecteur + fondu. */
const BELOW_CAR = TABS_HEIGHT + TABS_GAP + FADE_HEIGHT;
/** Hauteur de la petite barre fixe (sous la zone de sécurité). */
const COMPACT_BAR = 56;

function LogoMark({ height }: { height: number }) {
  return (
    <Image source={MARK} resizeMode="contain" style={{ width: height * MARK_RATIO, height }} />
  );
}

/** Rond de profil (photo ou initiales) à contour lavande : ouvre le profil. Même bouton dans le hero et dans la petite barre. */
function ProfileButton({ path, initials }: { path: string | null | undefined; initials: string }) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={() => router.push('/profil')}
      accessibilityRole="button"
      accessibilityLabel={t('accueil.header.profile')}
      className="h-11 w-11 items-center justify-center rounded-full border-2 border-lavender active:border-white"
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
      className="h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/25 active:bg-white/25"
    >
      <Ionicons name={icon} size={21} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * Photo du hero : la voiture est calée en bas à droite, à côté du texte (qui reste à gauche), sans déformation. Des voiles
 * aubergine dégradés (gauche, haut, bas) fondent la photo dans le fond et garantissent la lisibilité.
 */
function HeroBackdrop({ width, height }: { width: number; height: number }) {
  let imageWidth = width * HERO_WIDTH;
  let imageHeight = imageWidth * HERO_RATIO;
  // La photo doit toujours couvrir toute la hauteur du hero (petits écrans) : on l'agrandit au besoin.
  if (imageHeight < height) {
    imageWidth *= height / imageHeight;
    imageHeight = height;
  }
  const top = Math.min(0, height - BELOW_CAR - CAR_BOTTOM * imageHeight);
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}
    >
      <Image
        source={HERO_IMAGE}
        resizeMode="cover"
        style={{ position: 'absolute', end: 0, top, width: imageWidth, height: imageHeight }}
        accessible={false}
      />
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="kh-side" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={DARK} stopOpacity="1" />
            <Stop offset="0.2" stopColor={DARK} stopOpacity="0.96" />
            <Stop offset="0.5" stopColor={DARK} stopOpacity="0.45" />
            <Stop offset="0.8" stopColor={DARK} stopOpacity="0.08" />
            <Stop offset="1" stopColor={DARK} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="kh-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={DARK} stopOpacity="0.7" />
            <Stop offset="0.45" stopColor={DARK} stopOpacity="0" />
          </LinearGradient>
          <LinearGradient id="kh-bottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.55" stopColor={DARK} stopOpacity="0" />
            <Stop offset="1" stopColor={DARK} stopOpacity="0.55" />
          </LinearGradient>
          <LinearGradient id="kh-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={M3akPalette.background} stopOpacity="0" />
            <Stop offset="1" stopColor={M3akPalette.background} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#kh-side)" />
        <Rect width="100%" height="100%" fill="url(#kh-top)" />
        <Rect width="100%" height="100%" fill="url(#kh-bottom)" />
        <Rect
          y={Math.max(height - FADE_HEIGHT, 0)}
          width="100%"
          height={FADE_HEIGHT}
          fill="url(#kh-fade)"
        />
      </Svg>
    </View>
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
}: DashboardHeaderProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { width: screenWidth } = useWindowDimensions();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const logoHeight = screenWidth < 340 ? 44 : 52;
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

  return (
    <View onLayout={onLayout} style={{ backgroundColor: DARK, overflow: 'hidden' }}>
      {/* Les onglets restent montés : on ne règle la barre d'état (icônes claires) que lorsque l'Accueil est affiché. */}
      {focused ? <StatusBar style="light" /> : null}
      {size ? <HeroBackdrop width={size.width} height={size.height} /> : null}

      <View
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: FADE_HEIGHT,
          paddingStart: insets.left + 20,
          paddingEnd: insets.right + 20,
        }}
      >
        <View className="flex-row items-center justify-between" style={{ minHeight: 48, gap: 12 }}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="M3ak"
            className="shrink flex-row items-center"
            style={{ gap: 8 }}
          >
            <LogoMark height={logoHeight} />
            {showName ? (
              <View className="shrink">
                <ThemedText
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{
                    color: '#FFFFFF',
                    fontSize: 22,
                    lineHeight: 26,
                    letterSpacing: -0.3,
                    fontFamily: fontFamilyFor('fr', 'extrabold'),
                  }}
                >
                  M3ak
                </ThemedText>
                {showAgency ? (
                  <ThemedText
                    numberOfLines={1}
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 11,
                      lineHeight: 14,
                      fontFamily: fontFamilyFor(language, 'medium'),
                    }}
                  >
                    {agencyName?.trim()}
                  </ThemedText>
                ) : null}
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

        <View style={{ marginTop: 14, maxWidth: '62%' }}>
          <ThemedText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            accessibilityRole="header"
            style={{
              color: '#FFFFFF',
              fontSize: 24,
              lineHeight: 31,
              fontFamily: fontFamilyFor(language, 'bold'),
            }}
          >
            {greeting}
          </ThemedText>
          <ThemedText
            numberOfLines={3}
            style={{
              marginTop: 4,
              color: 'rgba(255,255,255,0.86)',
              fontSize: 12.5,
              lineHeight: 17,
              fontFamily: fontFamilyFor(language, 'medium'),
            }}
          >
            {t('accueil.header.tagline')}
          </ThemedText>
          <View
            style={{
              marginTop: 10,
              width: 28,
              height: 3,
              borderRadius: 2,
              backgroundColor: M3akPalette.lavender,
            }}
          />
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
          borderBottomColor: 'rgba(255,255,255,0.08)',
          shadowColor: '#000000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        style,
      ]}
    >
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="M3ak"
        className="shrink flex-row items-center"
        style={{ gap: 8 }}
      >
        <LogoMark height={40} />
        <ThemedText
          numberOfLines={1}
          style={{
            color: '#FFFFFF',
            fontSize: 20,
            lineHeight: 24,
            letterSpacing: -0.3,
            fontFamily: fontFamilyFor('fr', 'extrabold'),
          }}
        >
          M3ak
        </ThemedText>
      </View>
      <View className="shrink-0 flex-row items-center" style={{ gap: 8 }}>
        <NotificationBell tone="onForest" />
        <ProfileButton path={avatarPath} initials={initials} />
      </View>
    </Animated.View>
  );
}
