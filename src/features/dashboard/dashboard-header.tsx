import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

const HERO_IMAGE = require('../../../assets/images/hero-dashboard.jpg');
// Version éclaircie du logo, sur fond transparent : lisible directement sur le mauve profond (sans pastille).
const MARK = require('../../../assets/images/logo-m3ak-ribbon-light.png');
/** Proportions du fichier (640 × 373). */
const MARK_RATIO = 640 / 373;

// Proportions de la photo (1000 × 1094) et position verticale du bas de la voiture dans l'image (≈ 67 %).
const HERO_RATIO = 1094 / 1000;
const CAR_BOTTOM = 0.67;
const HERO_SCALE = 1.1;

type DashboardHeaderProps = {
  /** Prénom du profil (peut manquer). */
  prenom?: string | null;
  /** Nom complet, utilisé si le prénom manque. */
  fullName?: string | null;
  agencyName?: string | null;
  agencyCity?: string | null;
  avatarPath?: string | null;
  /** Position de défilement de la page (valeur partagée mise à jour par la liste) : pilote le repli du hero. */
  scrollY: SharedValue<number>;
  /** Hauteur du hero déployé (pour réserver la place au-dessus du contenu). */
  onFullHeight?: (height: number) => void;
  /** Actualisation en cours : un petit indicateur remplace celui de la liste, masqué sous l'en-tête. */
  refreshing?: boolean;
};

/** Hauteur de la petite barre repliée, sous la zone de sécurité. */
const COMPACT_BAR = 56;
/** Hauteur supposée du hero tant qu'il n'est pas mesuré (évite un saut au premier affichage). */
const FALLBACK_HEIGHT = 330;

/**
 * Photo du hero : voiture calée en bas à droite (côté « fin » du texte, donc à gauche en arabe), sans déformation.
 * Un voile sombre dégradé garantit la lisibilité du texte à gauche et des boutons en haut.
 */
function HeroBackdrop({ width, height }: { width: number; height: number }) {
  // Photo légèrement plus large que l'écran, calée à droite : toute la voiture reste visible.
  const imageWidth = width * HERO_SCALE;
  const imageHeight = imageWidth * HERO_RATIO;
  const top = Math.min(0, height - 16 - CAR_BOTTOM * imageHeight);
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
            <Stop offset="0" stopColor="#171321" stopOpacity="0.9" />
            <Stop offset="0.55" stopColor="#171321" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#171321" stopOpacity="0.05" />
          </LinearGradient>
          <LinearGradient id="kh-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#171321" stopOpacity="0.55" />
            <Stop offset="0.5" stopColor="#171321" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#kh-side)" />
        <Rect width="100%" height="100%" fill="url(#kh-top)" />
      </Svg>
    </View>
  );
}

/** Logo sur fond transparent, à la hauteur demandée. */
function LogoMark({ height }: { height: number }) {
  return (
    <Image source={MARK} resizeMode="contain" style={{ width: height * MARK_RATIO, height }} />
  );
}

/** Rond de profil (photo ou initiales) : ouvre le profil. Même bouton dans le hero et dans la petite barre repliée. */
function ProfileButton({ path, initials }: { path: string | null | undefined; initials: string }) {
  const { t } = useLanguage();
  return (
    <Pressable
      onPress={() => router.push('/profil')}
      accessibilityRole="button"
      accessibilityLabel={t('accueil.header.profile')}
      className="h-11 w-11 items-center justify-center rounded-full border-2 border-white/30 active:border-primary"
    >
      <Avatar path={path} size={40} initials={initials} />
    </Pressable>
  );
}

/** Bouton rond de 44 × 44 : même disque translucide et même trait fin pour toutes les actions. */
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
 * En-tête « hero » du tableau de bord, qui se replie quand on fait défiler la page : le grand hero (photo, salutation,
 * agence, accroche) rétrécit en douceur, puis laisse place à une petite barre avec le logo M3ak et les notifications.
 * Tout est piloté par `scrollY` sur le fil d'interface (Reanimated) : pas de saccade. Rien n'a de largeur fixe : le texte
 * se réduit ou se coupe proprement jusqu'à 320 dp, et la photo s'adapte à la largeur de l'écran.
 */
export function DashboardHeader({
  prenom,
  fullName,
  agencyName,
  agencyCity,
  avatarPath,
  scrollY,
  onFullHeight,
  refreshing = false,
}: DashboardHeaderProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const arabic = language === 'ar';
  const { width: screenWidth } = useWindowDimensions();
  // Logo grand, mais réduit sur les petits écrans pour laisser la place aux trois boutons ; le nom s'efface sous 340 dp.
  const logoHeight = screenWidth < 340 ? 52 : 62;
  const showName = screenWidth >= 340;
  const showProduct = screenWidth >= 390;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const fullHeight = size?.height ?? FALLBACK_HEIGHT + insets.top;
  const compactHeight = insets.top + COMPACT_BAR;
  const range = Math.max(fullHeight - compactHeight, 1);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) => {
      if (
        previous &&
        Math.abs(previous.width - width) < 1 &&
        Math.abs(previous.height - height) < 1
      )
        return previous;
      onFullHeight?.(height);
      return { width, height };
    });
  };

  // Le conteneur rétrécit de la hauteur du hero à celle de la petite barre ; ses coins du bas s'affinent un peu.
  const containerStyle = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      height: interpolate(y, [0, range], [fullHeight, compactHeight], Extrapolation.CLAMP),
      borderBottomStartRadius: interpolate(y, [0, range], [28, 20], Extrapolation.CLAMP),
      borderBottomEndRadius: interpolate(y, [0, range], [28, 20], Extrapolation.CLAMP),
    };
  });
  // Photo : s'efface avant la fin du repli, la petite barre repose sur le mauve profond uni.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, range * 0.8], [1, 0], Extrapolation.CLAMP),
  }));
  // Hero : s'estompe et remonte, sortant du cadre (les boutons cachés ne sont plus touchables, car rognés).
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, range * 0.55], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(scrollY.value, [0, range], [0, -range * 0.6], Extrapolation.CLAMP),
      },
    ],
  }));
  // Petite barre : apparaît en fin de repli ; tant qu'elle est invisible elle ne reçoit aucun toucher.
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [range * 0.55, range * 0.95], [0, 1], Extrapolation.CLAMP),
  }));
  const compactProps = useAnimatedProps(() => ({
    pointerEvents: scrollY.value > range * 0.7 ? ('auto' as const) : ('none' as const),
  }));

  const firstName = headerFirstName(prenom, fullName);
  const initials = getInitials(fullName ?? firstName);
  const greeting = firstName
    ? t('accueil.header.greeting', { name: firstName })
    : t('accueil.header.greetingNoName');
  const agencyLine = [agencyName?.trim(), agencyCity?.trim()].filter(Boolean).join(' · ');

  return (
    <Animated.View
      style={[
        {
          backgroundColor: '#171321',
          overflow: 'hidden',
          borderBottomStartRadius: 28,
          borderBottomEndRadius: 28,
        },
        { height: fullHeight },
        containerStyle,
      ]}
    >
      {/* Les onglets restent montés : on ne règle la barre d'état (icônes claires) que lorsque l'Accueil est affiché. */}
      {focused ? <StatusBar style="light" /> : null}

      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, start: 0, end: 0, height: fullHeight },
          backdropStyle,
        ]}
      >
        {size ? <HeroBackdrop width={size.width} height={size.height} /> : null}
      </Animated.View>

      <Animated.View
        onLayout={onLayout}
        style={[
          {
            position: 'absolute',
            top: 0,
            start: 0,
            end: 0,
            paddingTop: insets.top + 4,
            paddingBottom: 104,
            paddingStart: insets.left + 20,
            paddingEnd: insets.right + 20,
          },
          heroStyle,
        ]}
      >
        <View className="flex-row items-center justify-between" style={{ minHeight: 44, gap: 12 }}>
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
                {showProduct ? (
                  <ThemedText
                    numberOfLines={1}
                    style={{
                      color: 'rgba(255,255,255,0.7)',
                      fontSize: 10.5,
                      lineHeight: 13,
                      letterSpacing: arabic ? 0 : 0.2,
                      fontFamily: fontFamilyFor(language, 'medium'),
                    }}
                  >
                    {t('accueil.header.product')}
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

        <View style={{ marginTop: 18, maxWidth: '78%' }}>
          {agencyLine ? (
            <ThemedText
              numberOfLines={1}
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                lineHeight: 16,
                letterSpacing: arabic ? 0 : 0.5,
                textTransform: arabic ? 'none' : 'uppercase',
                fontFamily: fontFamilyFor(language, 'semibold'),
              }}
            >
              {agencyLine}
            </ThemedText>
          ) : null}
          <ThemedText
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            accessibilityRole="header"
            style={{
              marginTop: 2,
              color: '#FFFFFF',
              fontSize: 25,
              lineHeight: 33,
              fontFamily: fontFamilyFor(language, 'bold'),
            }}
          >
            {greeting}
          </ThemedText>
          <ThemedText
            numberOfLines={2}
            style={{
              marginTop: 4,
              color: 'rgba(255,255,255,0.86)',
              fontSize: 13.5,
              lineHeight: 19,
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
      </Animated.View>

      {/* Petite barre repliée : logo M3ak à gauche, notifications à droite. */}
      <Animated.View
        animatedProps={compactProps}
        style={[
          {
            position: 'absolute',
            top: insets.top,
            start: 0,
            end: 0,
            height: COMPACT_BAR,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingStart: insets.left + 20,
            paddingEnd: insets.right + 20,
          },
          compactStyle,
        ]}
      >
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="M3ak"
          className="shrink flex-row items-center"
          style={{ gap: 10 }}
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

      {refreshing ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', bottom: 8, start: 0, end: 0, alignItems: 'center' }}
        >
          <ActivityIndicator size="small" color="#FFFFFF" />
        </View>
      ) : null}
    </Animated.View>
  );
}
