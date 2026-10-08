import { router } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

export type SectionKey = 'accueil' | 'flotte' | 'clients' | 'locations' | 'equipe';

const SECTIONS: {
  key: SectionKey;
  href: '/accueil' | '/flotte' | '/clients' | '/locations' | '/equipe';
  labelKey: string;
}[] = [
  { key: 'accueil', href: '/accueil', labelKey: 'accueil.title' },
  { key: 'flotte', href: '/flotte', labelKey: 'flotte.title' },
  { key: 'clients', href: '/clients', labelKey: 'clients.title' },
  { key: 'locations', href: '/locations', labelKey: 'locations.title' },
  { key: 'equipe', href: '/equipe', labelKey: 'equipe.title' },
];

export function SectionTabs({ current }: { current: SectionKey }) {
  const { t } = useLanguage();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-6 pb-3">
      {SECTIONS.map((section) => {
        const selected = section.key === current;
        return (
          <Pressable
            key={section.key}
            onPress={() => !selected && router.replace(section.href)}
            className={`rounded-full border px-4 py-2 ${
              selected ? 'border-[#1f5eff] bg-[#1f5eff]' : 'border-[#e1e5f0] bg-white'
            }`}
          >
            <ThemedText type="small" style={{ color: selected ? '#ffffff' : '#101423' }}>
              {t(section.labelKey)}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
