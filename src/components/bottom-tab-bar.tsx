import { Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n/use-language';

export type SectionKey = 'accueil' | 'flotte' | 'clients' | 'locations' | 'equipe';

const SECTIONS: {
  key: SectionKey;
  href: '/accueil' | '/flotte' | '/clients' | '/locations' | '/equipe';
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'accueil', href: '/accueil', labelKey: 'accueil.title', icon: 'home-outline', iconActive: 'home' },
  { key: 'flotte', href: '/flotte', labelKey: 'flotte.title', icon: 'car-outline', iconActive: 'car' },
  {
    key: 'clients',
    href: '/clients',
    labelKey: 'clients.title',
    icon: 'people-outline',
    iconActive: 'people',
  },
  { key: 'locations', href: '/locations', labelKey: 'locations.title', icon: 'key-outline', iconActive: 'key' },
  {
    key: 'equipe',
    href: '/equipe',
    labelKey: 'equipe.title',
    icon: 'briefcase-outline',
    iconActive: 'briefcase',
  },
];

const INACTIVE_COLOR = M3akPalette.subtle;

/** Barre d'onglets du bas (mobile). Chaque onglet garde sa propre pile d'écrans et sa position de défilement. */
export function AppTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDesktop = useDesktopLayout();

  const segments = useSegments();

  // Écran « de détail » d'un onglet (fiche, formulaire, assistant…) : adresse du type /(tabs)/clients/<id>. La barre est
  // alors masquée pour laisser la place aux boutons du bas ; seuls les écrans racines des onglets l'affichent.
  const isDetailScreen = (segments[0] as string) === '(tabs)' && segments.length > 2;

  // Sur grand écran web, le menu latéral remplace la barre du bas.
  if (isDesktop || isDetailScreen) return null;
  // L'onglet actif se lit dans l'adresse : plus fiable que l'index du navigateur au tout premier affichage.
  const pathParts = segments as string[];
  const currentName = pathParts[0] === '(tabs)' ? pathParts[1] : state.routes[state.index]?.name;

  return (
    <View
      className="flex-row border-t bg-white"
      style={[{ paddingBottom: Math.max(insets.bottom, 10), borderColor: theme.border }, { shadowColor: M3akPalette.mauveDeep, shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: -6 }, elevation: 12 }]}
    >
      {SECTIONS.map((section) => {
        const route = state.routes.find((candidate) => candidate.name === section.key);
        const selected = section.key === currentName;
        return (
          <Pressable
            key={section.key}
            onPress={() => {
              if (!route) return;
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              // On compare à l'onglet réellement affiché par le navigateur (et non à l'adresse) : sinon un clic est
              // ignoré quand les deux ne concordent plus.
              const focused = state.routes[state.index]?.key === route.key;
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            className="min-h-14 flex-1 items-center gap-1 pt-2"
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t(section.labelKey)}
          >
            <View
              className="h-8 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: selected ? M3akPalette.emerald : 'transparent' }}
            >
              <Ionicons
                name={selected ? section.iconActive : section.icon}
                size={21}
                color={selected ? M3akPalette.onEmerald : INACTIVE_COLOR}
              />
            </View>
            <ThemedText
              type="small"
              style={{ color: selected ? M3akPalette.mauveDeep : M3akPalette.muted, fontSize: 11, fontWeight: selected ? '700' : '500' }}
            >
              {t(section.labelKey)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
