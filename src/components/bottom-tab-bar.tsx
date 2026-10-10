import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
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

const INACTIVE_COLOR = '#B3A6C2';

export function BottomTabBar({ current }: { current: SectionKey }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      className="absolute inset-x-0 bottom-0 flex-row border-t bg-white"
      style={{ paddingBottom: Math.max(insets.bottom, 10), borderColor: theme.border }}
    >
      {SECTIONS.map((section) => {
        const selected = section.key === current;
        return (
          <Pressable
            key={section.key}
            onPress={() => !selected && router.replace(section.href)}
            className="flex-1 items-center gap-1 pt-2"
          >
            <View
              className="h-7 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: selected ? M3akPalette.mauveLight : 'transparent' }}
            >
              <Ionicons
                name={selected ? section.iconActive : section.icon}
                size={20}
                color={selected ? M3akPalette.mauve : INACTIVE_COLOR}
              />
            </View>
            <ThemedText
              type="small"
              style={{ color: selected ? M3akPalette.mauve : INACTIVE_COLOR, fontSize: 11 }}
            >
              {t(section.labelKey)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}
