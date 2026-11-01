import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Image, Pressable, View, type LayoutChangeEvent } from 'react-native';
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
const MARK = require('../../../assets/images/logo-m3ak-mark.png');

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
};

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
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}>
      <Image
        source={HERO_IMAGE}
        resizeMode="cover"
        style={{ position: 'absolute', end: 0, top, width: imageWidth, height: imageHeight }}
        accessible={false}
      />
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="kh-side" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#0B0716" stopOpacity="0.9" />
            <Stop offset="0.55" stopColor="#0B0716" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#0B0716" stopOpacity="0.05" />
          </LinearGradient>
          <LinearGradient id="kh-top" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0B0716" stopOpacity="0.55" />
            <Stop offset="0.5" stopColor="#0B0716" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#kh-side)" />
        <Rect width="100%" height="100%" fill="url(#kh-top)" />
      </Svg>
    </View>
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
 * En-tête « hero » du tableau de bord : photo, logo M3ak, trois actions rondes (question à M3ak, notifications, profil),
 * puis agence, salutation et phrase d'accroche. Rien n'a de largeur fixe : le texte se réduit ou se coupe proprement
 * jusqu'à 320 dp, et la photo s'adapte à la largeur de l'écran.
 */
export function DashboardHeader({ prenom, fullName, agencyName, agencyCity, avatarPath }: DashboardHeaderProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const arabic = language === 'ar';
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((previous) =>
      previous && Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1
        ? previous
        : { width, height }
    );
  };

  const firstName = headerFirstName(prenom, fullName);
  const greeting = firstName
    ? t('accueil.header.greeting', { name: firstName })
    : t('accueil.header.greetingNoName');
  const agencyLine = [agencyName?.trim(), agencyCity?.trim()].filter(Boolean).join(' · ');

  return (
    <View
      onLayout={onLayout}
      style={{
        backgroundColor: '#0B0716',
        overflow: 'hidden',
        paddingTop: insets.top + 4,
        paddingBottom: 104,
        paddingStart: insets.left + 20,
        paddingEnd: insets.right + 20,
        borderBottomStartRadius: 28,
        borderBottomEndRadius: 28,
      }}
    >
      {size ? <HeroBackdrop width={size.width} height={size.height} /> : null}
      {/* Les onglets restent montés : on ne règle la barre d'état (icônes claires) que lorsque l'Accueil est affiché. */}
      {focused ? <StatusBar style="light" /> : null}

      <View className="flex-row items-center justify-between" style={{ minHeight: 44, gap: 12 }}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel="M3ak"
          className="shrink flex-row items-center"
          style={{ gap: 10 }}
        >
          <Image source={MARK} resizeMode="contain" style={{ width: 40, height: 38 }} />
          <View className="shrink">
            <ThemedText
              numberOfLines={1}
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
          </View>
        </View>
        <View className="shrink-0 flex-row items-center" style={{ gap: 8 }}>
          <HeaderIconButton
            icon="search-outline"
            label={t('accueil.header.search')}
            onPress={() => router.push('/chat')}
          />
          <NotificationBell tone="onForest" />
          <Pressable
            onPress={() => router.push('/profil')}
            accessibilityRole="button"
            accessibilityLabel={t('accueil.header.profile')}
            className="h-11 w-11 items-center justify-center rounded-full border-2 border-white/30 active:border-emerald"
          >
            <Avatar path={avatarPath} size={40} initials={getInitials(fullName ?? firstName)} />
          </Pressable>
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
          style={{ marginTop: 10, width: 28, height: 3, borderRadius: 2, backgroundColor: M3akPalette.emerald }}
        />
      </View>
    </View>
  );
}
