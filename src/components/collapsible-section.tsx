import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type CollapsibleSectionProps = {
  title: string;
  /** Petite mention à droite du titre (nombre de documents, « à vérifier »…). */
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

/** Section repliable : évite les longs formulaires en n'affichant les champs secondaires qu'à la demande. */
export function CollapsibleSection({ title, badge, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View className="gap-3 rounded-2xl border border-line bg-white p-4">
      <Pressable onPress={() => setOpen((prev) => !prev)} className="flex-row items-center justify-between" hitSlop={6}>
        <View className="flex-1 flex-row items-center gap-2">
          <ThemedText type="smallBold">{title}</ThemedText>
          {badge ? (
            <View className="rounded-full bg-brand-light px-2 py-0.5">
              <ThemedText type="small" themeColor="primary" style={{ fontSize: 11 }}>
                {badge}
              </ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText type="small" themeColor="primary">
          {open ? '−' : '+'}
        </ThemedText>
      </Pressable>
      {open ? <View className="gap-3">{children}</View> : null}
    </View>
  );
}
