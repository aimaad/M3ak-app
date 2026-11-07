import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Brand } from '@/constants/theme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useDesktopLayout } from '@/hooks/use-desktop-layout';
import { UndoController, type ActiveUndo, type UndoRequest } from '@/lib/undo';

type UndoContextValue = { showUndo: (request: UndoRequest) => void };

const UndoContext = createContext<UndoContextValue>({ showUndo: () => undefined });

/** Affiche, après une action réversible, une phrase avec un bouton « Annuler » pendant quelques secondes. */
export function useUndo(): UndoContextValue {
  return useContext(UndoContext);
}

export function UndoProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveUndo | null>(null);
  const [controller] = useState(() => new UndoController(setActive));
  const isDesktop = useDesktopLayout();
  const tabInset = useTabBarInset();

  useEffect(() => () => controller.dismiss(), [controller]);

  const value = useMemo<UndoContextValue>(() => ({ showUndo: (request) => controller.show(request) }), [controller]);

  return (
    <UndoContext.Provider value={value}>
      {children}
      {active ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: isDesktop ? 24 : tabInset - 8, alignItems: 'center', zIndex: 50 }}>
          <View
            accessibilityLiveRegion="polite"
            className="w-full flex-row items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ maxWidth: 480, backgroundColor: Palette.textPrimary, shadowColor: Palette.shadow, shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}
          >
            <ThemedText type="small" style={{ color: Brand.white, flex: 1 }}>
              {active.message}
            </ThemedText>
            <Pressable onPress={() => void controller.undo()} accessibilityRole="button" hitSlop={10} className="min-h-11 justify-center px-2">
              <ThemedText type="smallBold" style={{ color: Palette.primarySoft }}>
                {active.actionLabel}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </UndoContext.Provider>
  );
}
