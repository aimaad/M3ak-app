import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Logo } from '@/components/logo';
import { ThemedText } from '@/components/themed-text';
import { fontFamilyFor, M3akPalette } from '@/constants/theme';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { useLanguage } from '@/i18n/use-language';
import { getInitials } from '@/lib/initials';

import { formatHeaderDate, headerFirstName } from './header-format';

type DashboardHeaderProps = {
  /** Prénom du profil (peut manquer). */
  prenom?: string | null;
  /** Nom complet, utilisé si le prénom manque. */
  fullName?: string | null;
  agencyName?: string | null;
  agencyCity?: string | null;
  avatarPath?: string | null;
};

const SOFT_WHITE = 'rgba(255,255,255,0.78)';
const FAINT_WHITE = 'rgba(255,255,255,0.58)';

/** Bouton rond translucide de 44 × 44 (zone tactile minimale) posé sur le fond vert forêt. */
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
      hitSlop={4}
      className="h-11 w-11 items-center justify-center rounded-full"
      style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)' })}
    >
      <Ionicons name={icon} size={21} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * En-tête du tableau de bord : fond vert forêt qui monte sous la barre d'état (zone de sécurité comprise), logo, actions
 * (question à Kriha, notifications, profil), salutation, agence et date du jour. Aucune dimension fixe de largeur : tout
 * se réduit ou passe à la ligne sur les petits écrans.
 */
export function DashboardHeader({ prenom, fullName, agencyName, agencyCity, avatarPath }: DashboardHeaderProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();

  const firstName = headerFirstName(prenom, fullName);
  const greeting = firstName
    ? t('accueil.header.greeting', { name: firstName })
    : t('accueil.header.greetingNoName');
  const agencyLine = [agencyName?.trim(), agencyCity?.trim()].filter(Boolean).join(' · ');

  return (
    <View
      style={{
        backgroundColor: M3akPalette.mauveDeep,
        paddingTop: insets.top + 8,
        paddingBottom: 20,
        paddingStart: Math.max(insets.left, 0) + 20,
        paddingEnd: Math.max(insets.right, 0) + 20,
        borderBottomStartRadius: 28,
        borderBottomEndRadius: 28,
      }}
    >
      {/* Les onglets restent montés : on ne règle la barre d'état (icônes claires) que lorsque l'Accueil est affiché. */}
      {focused ? <StatusBar style="light" /> : null}

      <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
        <View className="shrink">
          <Logo tone="light" />
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
            className="h-11 w-11 items-center justify-center rounded-full"
            style={({ pressed }) => ({
              borderWidth: 2,
              borderColor: pressed ? M3akPalette.emerald : 'rgba(255,255,255,0.35)',
            })}
          >
            <Avatar path={avatarPath} size={38} initials={getInitials(fullName ?? firstName)} />
          </Pressable>
        </View>
      </View>

      <View style={{ marginTop: 20, gap: 4 }}>
        <ThemedText
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          accessibilityRole="header"
          style={{ color: '#FFFFFF', fontSize: 23, lineHeight: 30, fontFamily: fontFamilyFor(language, 'bold') }}
        >
          {greeting}
        </ThemedText>
        {agencyLine ? (
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Ionicons name="storefront-outline" size={15} color={SOFT_WHITE} />
            <ThemedText numberOfLines={1} style={{ color: SOFT_WHITE, fontSize: 14, lineHeight: 20, fontFamily: fontFamilyFor(language, 'semibold') }}>
              {agencyLine}
            </ThemedText>
          </View>
        ) : null}
        <ThemedText numberOfLines={1} style={{ color: FAINT_WHITE, fontSize: 12, lineHeight: 16 }}>
          {formatHeaderDate(new Date(), language)}
        </ThemedText>
      </View>
    </View>
  );
}
