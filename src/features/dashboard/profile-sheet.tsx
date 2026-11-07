import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand, Palette } from '@/constants/theme';
import { signOut } from '@/features/auth/api';
import { unregisterThisDevice } from '@/features/notifications/push';
import { isRTL } from '@/i18n';
import { useLanguage } from '@/i18n/use-language';

import { HText } from './home-ui';

type Entry = { key: 'profile' | 'agency' | 'team'; icon: keyof typeof Ionicons.glyphMap; href: '/profil' | '/entreprise' | '/equipe' };
const ENTRIES: Entry[] = [
  { key: 'profile', icon: 'person-outline', href: '/profil' },
  { key: 'agency', icon: 'business-outline', href: '/entreprise' },
  { key: 'team', icon: 'people-outline', href: '/equipe' },
];

/**
 * Menu du profil (touche sur l'avatar) : feuille du bas avec Mon profil, Mon agence, Équipe et Déconnexion. Ce qu'on règle
 * rarement vit ici, pas dans la barre du bas. La déconnexion demande toujours une confirmation.
 */
export function ProfileSheet({ visible, onClose, name, agencyName }: { visible: boolean; onClose: () => void; name: string; agencyName: string | undefined }) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const chevron = isRTL(language) ? 'chevron-back' : 'chevron-forward';

  const go = (href: Entry['href']) => {
    onClose();
    router.push(href);
  };
  const confirmSignOut = () => {
    onClose();
    Alert.alert(t('accueil.home.menu.signOutTitle'), t('accueil.home.menu.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.signOut'),
        style: 'destructive',
        onPress: async () => {
          await unregisterThisDevice();
          await signOut();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }} onPress={onClose} accessibilityLabel={t('accueil.home.menu.close')} accessibilityRole="button">
        <Pressable
          onPress={() => undefined}
          accessible={false}
          style={[
            { backgroundColor: Palette.card, borderTopStartRadius: 24, borderTopEndRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 16) + 8 },
            Platform.select({ default: { shadowColor: Palette.shadow, shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 } }),
          ]}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, marginBottom: 12 }} />
          <View style={{ paddingVertical: 8, gap: 2 }}>
            <HText font="display" weight="semibold" size={18} numberOfLines={1}>
              {name || t('accueil.home.menu.title')}
            </HText>
            {agencyName ? (
              <HText size={13} color={Palette.textSecondary} numberOfLines={1}>
                {agencyName}
              </HText>
            ) : null}
          </View>
          {ENTRIES.map((entry) => (
            <Pressable
              key={entry.key}
              onPress={() => go(entry.href)}
              accessibilityRole="button"
              style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: Palette.border }}
            >
              <Ionicons name={entry.icon} size={22} color={Brand.graphite} />
              <HText weight="medium" size={15} style={{ flex: 1 }}>
                {t(`accueil.home.menu.${entry.key}`)}
              </HText>
              <Ionicons name={chevron} size={18} color={Palette.textMuted} />
            </Pressable>
          ))}
          <Pressable
            onPress={confirmSignOut}
            accessibilityRole="button"
            style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: Palette.border }}
          >
            <Ionicons name="log-out-outline" size={22} color={Palette.error} />
            <HText weight="medium" size={15} color={Palette.error} style={{ flex: 1 }}>
              {t('auth.signOut')}
            </HText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
