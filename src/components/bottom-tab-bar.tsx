import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Palette } from '@/constants/theme';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { useLanguage } from '@/i18n/use-language';

export type SectionKey = 'accueil' | 'flotte' | 'clients' | 'locations' | 'equipe';

const SECTIONS: {
  key: SectionKey;
  href: '/accueil' | '/flotte' | '/clients' | '/locations' | '/equipe';
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
  {
    key: 'equipe',
    href: '/equipe',
    labelKey: 'equipe.title',
    icon: 'briefcase-outline',
    iconActive: 'briefcase',
  },
];

const INACTIVE_COLOR = Palette.textMuted;
const PLUS_SIZE = 58;

/** Ordre dans la barre : trois onglets, le « + » central, deux onglets. Les cinq destinations sont celles d'avant. */
const ITEMS: ((typeof SECTIONS)[number] | 'plus')[] = [
  SECTIONS[0],
  SECTIONS[1],
  SECTIONS[2],
  'plus',
  SECTIONS[3],
  SECTIONS[4],
];

/** Barre d'onglets du bas (mobile). Chaque onglet garde sa propre pile d'écrans et sa position de défilement. */
export function AppTabBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { t } = useLanguage();
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
    // Barre flottante : un bloc de la couleur de la page (il prend sa place dans la mise en page, rien n'est recouvert) qui porte
    // une grande gélule blanche aux coins très arrondis, simplement cernée d'une bordure (aucune ombre colorée). Le bouton « + »
    // central (création d'une location) dépasse légèrement de la barre ; les cinq onglets sont répartis de part et d'autre.
    <View
      style={{
        backgroundColor: Palette.background,
        paddingTop: 22,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingStart: Math.max(insets.left, 0) + 14,
        paddingEnd: Math.max(insets.right, 0) + 14,
      }}
    >
      <View
        className="flex-row items-center"
        style={{
          borderRadius: 32,
          paddingHorizontal: 6,
          backgroundColor: Palette.card,
          borderWidth: 1,
          borderColor: Palette.border,
        }}
      >
        {ITEMS.map((item) => {
          if (item === 'plus') {
            return (
              <View
                key="plus"
                className="items-center"
                style={{ width: PLUS_SIZE + 12, marginTop: -26 }}
              >
                <Pressable
                  onPress={() => router.push('/locations/nouveau')}
                  accessibilityRole="button"
                  accessibilityLabel={t('locations.addRental')}
                  style={({ pressed }) => ({
                    width: PLUS_SIZE,
                    height: PLUS_SIZE,
                    borderRadius: PLUS_SIZE / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Orange uni (orange foncé appuyé), cerné de blanc ; seule ombre autorisée : grise, très légère (élément flottant).
                    backgroundColor: pressed ? Palette.primaryPressed : Palette.primary,
                    borderWidth: 3,
                    borderColor: Palette.background,
                    shadowColor: Palette.shadow,
                    shadowOpacity: 0.16,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 4,
                  })}
                >
                  <Ionicons name="add" size={32} color={Brand.white} />
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
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                // On compare à l'onglet réellement affiché par le navigateur (et non à l'adresse) : sinon un clic est
                // ignoré quand les deux ne concordent plus.
                const focused = state.routes[state.index]?.key === route.key;
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              className="min-h-16 flex-1 items-center justify-center"
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t(section.labelKey)}
            >
              <View
                className="items-center justify-center"
                style={{
                  gap: 3,
                  minWidth: 52,
                  paddingHorizontal: 6,
                  paddingVertical: 7,
                  borderRadius: 20,
                  // Onglet actif en graphite, contenu blanc.
                  backgroundColor: selected ? Brand.graphite : 'transparent',
                }}
              >
                <Ionicons
                  name={selected ? section.iconActive : section.icon}
                  size={22}
                  color={selected ? Brand.white : INACTIVE_COLOR}
                />
                <ThemedText
                  type="small"
                  numberOfLines={1}
                  style={{
                    color: selected ? Brand.white : Palette.textSecondary,
                    fontSize: 10.5,
                    lineHeight: 13,
                    fontWeight: selected ? '700' : '500',
                  }}
                >
                  {t(section.labelKey)}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
