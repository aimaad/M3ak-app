import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, homeTextFont, Palette } from '@/constants/theme';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HEIGHT, TAB_BAR_SIDE_GAP } from '@/hooks/use-tab-bar-inset';
import { useLanguage } from '@/i18n/use-language';

export type SectionKey = 'accueil' | 'flotte' | 'clients' | 'locations';

const SECTIONS: {
  key: SectionKey;
  href: '/accueil' | '/flotte' | '/clients' | '/locations';
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: 'accueil',
    href: '/accueil',
    labelKey: 'accueil.title',
    icon: 'home-outline',
    iconActive: 'home',
  },
  {
    key: 'flotte',
    href: '/flotte',
    labelKey: 'flotte.title',
    icon: 'car-outline',
    iconActive: 'car',
  },
  {
    key: 'clients',
    href: '/clients',
    labelKey: 'clients.title',
    icon: 'people-outline',
    iconActive: 'people',
  },
  {
    key: 'locations',
    href: '/locations',
    labelKey: 'locations.title',
    icon: 'key-outline',
    iconActive: 'key',
  },
];

const PLUS_SIZE = 52;

/** Ordre dans la barre : Accueil, Flotte, le « + » central, Locations, Clients. Équipe vit dans le menu du profil (avatar). */
const ITEMS: ((typeof SECTIONS)[number] | 'plus')[] = [SECTIONS[0], SECTIONS[1], 'plus', SECTIONS[3], SECTIONS[2]];

/** Barre d'onglets du bas (mobile). Chaque onglet garde sa propre pile d'écrans et sa position de défilement. */
export function AppTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
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
    // Barre flottante (position absolue : 16 px des bords, 26 px du bas + zone de sécurité) : une pilule graphite (rayon 34,
    // hauteur 68). Les écrans à onglets laissent `useTabBarInset()` en bas de leur contenu pour que rien ne soit caché. Cinq emplacements égaux : Accueil, Flotte, le « + »
    // orange central (nouvelle location), Locations, Clients. Actif : blanc ; inactif : gris clair. Seule ombre : grise, légère.
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: TAB_BAR_BOTTOM_GAP + insets.bottom,
        start: Math.max(insets.left, 0) + TAB_BAR_SIDE_GAP,
        end: Math.max(insets.right, 0) + TAB_BAR_SIDE_GAP,
      }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          height: TAB_BAR_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 34,
          backgroundColor: Brand.graphite,
          shadowColor: Palette.shadow,
          shadowOpacity: 0.28,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 12 },
          elevation: 8,
        }}
      >
        {ITEMS.map((item) => {
          if (item === 'plus') {
            return (
              <View key="plus" style={{ flex: 1, alignItems: 'center' }}>
                <Pressable
                  onPress={() => router.push('/locations/nouveau')}
                  accessibilityRole="button"
                  accessibilityLabel={t('locations.addRental')}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    width: PLUS_SIZE,
                    height: PLUS_SIZE,
                    borderRadius: PLUS_SIZE / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: pressed ? Palette.primaryPressed : Palette.primary,
                  })}
                >
                  <Ionicons name="add" size={26} color={Brand.white} />
                </Pressable>
              </View>
            );
          }
          const section = item;
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
              style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3 }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t(section.labelKey)}
            >
              <Ionicons name={selected ? section.iconActive : section.icon} size={22} color={selected ? Brand.white : Brand.mutedOnDark} />
              <ThemedText
                type="small"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{
                  color: selected ? Brand.white : Brand.mutedOnDark,
                  fontSize: 10,
                  lineHeight: 13,
                  fontFamily: homeTextFont(language, selected ? 'semibold' : 'medium'),
                }}
              >
                {t(section.labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
