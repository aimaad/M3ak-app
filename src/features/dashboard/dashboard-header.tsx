import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { useLanguage } from '@/i18n/use-language';
import { getInitials } from '@/lib/initials';

import { formatHeaderDate, headerFirstName } from './header-format';

/**
 * Logo officiel Kriha. Tant que le fichier n'est pas fourni, l'en-tête n'affiche que le nom en blanc (aucun logo
 * inventé). Pour le brancher : déposer l'image (fond transparent, version claire) dans `assets/images/` puis écrire
 * `require('@/../assets/images/kriha-logo.png')` ici.
 */
const KRIHA_LOGO: ImageSourcePropType | null = null;

type DashboardHeaderProps = {
  /** Prénom du profil (peut manquer). */
  prenom?: string | null;
  /** Nom complet, utilisé si le prénom manque. */
  fullName?: string | null;
  agencyName?: string | null;
  agencyCity?: string | null;
  avatarPath?: string | null;
};

const BUTTON_SIZE = 44;

/** Fond : vert forêt avec une profondeur très discrète (dégradé diagonal + halo doux en haut), sans dépendance de plus. */
function HeaderBackdrop() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0 }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="kh-base" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#064E3B" />
            <Stop offset="1" stopColor="#075E46" />
          </LinearGradient>
          <RadialGradient id="kh-glow" cx="0.9" cy="0" rx="0.75" ry="0.9" fx="0.9" fy="0">
            <Stop offset="0" stopColor="#34D399" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#34D399" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#kh-base)" />
        <Rect width="100%" height="100%" fill="url(#kh-glow)" />
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
      className="h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 active:bg-white/20"
    >
      <Ionicons name={icon} size={21} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * En-tête du tableau de bord : fond vert forêt qui monte sous la barre d'état (zone de sécurité comprise), marque,
 * trois actions rondes alignées (question à Kriha, notifications, profil), puis date, salutation et agence.
 * Aucune largeur fixe : tout se réduit ou se coupe proprement jusqu'à 320 dp.
 */
export function DashboardHeader({ prenom, fullName, agencyName, agencyCity, avatarPath }: DashboardHeaderProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const arabic = language === 'ar';

  const firstName = headerFirstName(prenom, fullName);
  const greeting = firstName
    ? t('accueil.header.greeting', { name: firstName })
    : t('accueil.header.greetingNoName');
  const agencyLine = [agencyName?.trim(), agencyCity?.trim()].filter(Boolean).join(' · ');
  const dateText = formatHeaderDate(new Date(), language);

  return (
    <View
      style={{
        backgroundColor: M3akPalette.mauveDeep,
        overflow: 'hidden',
        paddingTop: insets.top + 4,
        paddingBottom: 18,
        paddingStart: insets.left + 20,
        paddingEnd: insets.right + 20,
        borderBottomStartRadius: 28,
        borderBottomEndRadius: 28,
      }}
    >
      <HeaderBackdrop />
      {/* Les onglets restent montés : on ne règle la barre d'état (icônes claires) que lorsque l'Accueil est affiché. */}
      {focused ? <StatusBar style="light" /> : null}

      <View className="flex-row items-center justify-between" style={{ minHeight: BUTTON_SIZE, gap: 12 }}>
        <View accessible accessibilityRole="image" accessibilityLabel="Kriha" className="shrink flex-row items-center">
          {KRIHA_LOGO ? (
            <Image source={KRIHA_LOGO} resizeMode="contain" style={{ height: 28, width: 96 }} />
          ) : (
            <ThemedText
              numberOfLines={1}
              style={{
                color: '#FFFFFF',
                fontSize: 24,
                lineHeight: 30,
                letterSpacing: arabic ? 0 : -0.4,
                fontFamily: fontFamilyFor('fr', 'extrabold'),
              }}
            >
              Kriha
            </ThemedText>
          )}
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
            className="h-11 w-11 items-center justify-center rounded-full border-2 border-white/15 active:border-emerald"
          >
            <Avatar path={avatarPath} size={BUTTON_SIZE - 4} initials={getInitials(fullName ?? firstName)} />
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <ThemedText
          numberOfLines={1}
          style={{
            color: 'rgba(255,255,255,0.62)',
            fontSize: 12,
            lineHeight: 16,
            letterSpacing: arabic ? 0 : 0.6,
            textTransform: arabic ? 'none' : 'uppercase',
            fontFamily: fontFamilyFor(language, 'semibold'),
          }}
        >
          {dateText}
        </ThemedText>
        <ThemedText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          accessibilityRole="header"
          style={{
            marginTop: 2,
            color: '#FFFFFF',
            fontSize: 24,
            lineHeight: 32,
            fontFamily: fontFamilyFor(language, 'bold'),
          }}
        >
          {greeting}
        </ThemedText>
        {agencyLine ? (
          <ThemedText
            numberOfLines={1}
            style={{
              marginTop: 2,
              color: '#A7F3D0',
              fontSize: 14,
              lineHeight: 20,
              fontFamily: fontFamilyFor(language, 'semibold'),
            }}
          >
            {agencyLine}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}
