import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Logo } from '@/components/logo';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { signOut } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-context';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { useLanguage } from '@/i18n/use-language';

type NavItem = {
  segment: string;
  href: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  managersOnly?: boolean;
  ownerOnly?: boolean;
};

const NAV: NavItem[] = [
  { segment: 'accueil', href: '/accueil', labelKey: 'accueil.title', icon: 'home-outline' },
  { segment: 'flotte', href: '/flotte', labelKey: 'flotte.title', icon: 'car-outline' },
  { segment: 'clients', href: '/clients', labelKey: 'clients.title', icon: 'people-outline' },
  { segment: 'locations', href: '/locations', labelKey: 'locations.title', icon: 'key-outline' },
  { segment: 'contrats', href: '/contrats', labelKey: 'contract.listTitle', icon: 'document-text-outline' },
  { segment: 'maintenance', href: '/maintenance', labelKey: 'maintenance.title', icon: 'construct-outline' },
  { segment: 'chat', href: '/chat', labelKey: 'chat.title', icon: 'chatbubbles-outline' },
  { segment: 'equipe', href: '/equipe', labelKey: 'equipe.title', icon: 'briefcase-outline' },
  { segment: 'filiales', href: '/filiales', labelKey: 'filiales.title', icon: 'git-branch-outline', managersOnly: true },
  { segment: 'journal', href: '/journal', labelKey: 'journal.title', icon: 'shield-checkmark-outline', ownerOnly: true },
  { segment: 'entreprise', href: '/entreprise', labelKey: 'entreprise.title', icon: 'business-outline', managersOnly: true },
  { segment: 'notifications', href: '/notifications', labelKey: 'notifications.title', icon: 'notifications-outline' },
  { segment: 'profil', href: '/profil', labelKey: 'profil.title', icon: 'person-circle-outline' },
];

/** Écrans sans menu (connexion, choix d'agence, accès bloqué). */
const BARE_SEGMENTS = new Set(['', 'index', 'login', 'signup', 'mot-de-passe-oublie', 'onboarding', 'acces-bloque']);

/** Largeur maximale du contenu : les écrans mobiles restent lisibles, même sur un grand écran. */
const CONTENT_MAX_WIDTH = 1280;

/**
 * Version web sur grand écran : menu latéral à gauche, contenu à droite. Sur mobile (ou petite fenêtre), ne fait rien :
 * l'application garde sa barre du bas.
 */
export function DesktopShell({ children }: { children: ReactNode }) {
  const isDesktop = useDesktopLayout();
  const segments = useSegments();
  const { session } = useSession();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const current = (segments[0] as string | undefined) ?? '';

  if (!isDesktop || !session || BARE_SEGMENTS.has(current)) return <>{children}</>;

  const role = agencyQuery.data?.role;
  const canManage = role === 'owner' || role === 'manager';
  const items = NAV.filter((item) => (!item.ownerOnly || role === 'owner') && (!item.managersOnly || canManage));

  return (
    <View className="flex-1 flex-row" style={{ backgroundColor: M3akPalette.background }}>
      <View className="w-64 border-e bg-white" style={{ borderColor: '#E4DCF5' }}>
        <View className="px-6 pb-4 pt-6">
          <Logo markOnly />
          {agencyQuery.data ? (
            <ThemedText type="smallBold" className="mt-3" numberOfLines={1}>
              {agencyQuery.data.agencyName}
            </ThemedText>
          ) : null}
        </View>
        <ScrollView className="flex-1" contentContainerClassName="gap-1 px-3 pb-4">
          {items.map((item) => {
            const selected = item.segment === current;
            return (
              <Pressable
                key={item.segment}
                onPress={() => !selected && router.replace(item.href as never)}
                accessibilityRole="link"
                accessibilityState={{ selected }}
                className="min-h-11 flex-row items-center gap-3 rounded-xl px-3"
                style={{ backgroundColor: selected ? M3akPalette.mauve : 'transparent' }}
              >
                <Ionicons name={item.icon} size={20} color={selected ? '#FFFFFF' : '#8A82A0'} />
                <ThemedText type="smallBold" style={{ color: selected ? '#FFFFFF' : '#211A2E' }}>
                  {t(item.labelKey)}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
        <View className="gap-1 border-t px-3 py-3" style={{ borderColor: '#E4DCF5' }}>
          <Pressable onPress={() => signOut()} className="min-h-11 flex-row items-center gap-3 rounded-xl px-3">
            <Ionicons name="log-out-outline" size={20} color="#8A82A0" />
            <ThemedText type="smallBold">{t('auth.signOut')}</ThemedText>
          </Pressable>
        </View>
      </View>
      <View className="flex-1 items-center">
        <View className="w-full flex-1" style={{ maxWidth: CONTENT_MAX_WIDTH }}>
          {children}
        </View>
      </View>
    </View>
  );
}
