import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

/** Hauteur du clavier (0 quand il est fermé) : la barre d'enregistrement monte avec lui et ne passe jamais dessous. */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (event) => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** Hauteur à réserver en bas de la page défilante pour que rien ne reste caché derrière la barre. */
export const SAVE_BAR_SPACE = 120;

/**
 * Barre d'enregistrement : UNE SEULE par page. Carte graphite flottante en bas, au-dessus du clavier et de la zone sûre. Elle apparaît dès
 * qu'un champ change (`changes` non vide) et disparaît quand il n'y a plus de modification. À gauche : « 3 modifications » + les champs
 * changés ; à droite : Annuler et Enregistrer (le seul bouton orange de l'écran).
 */
export function SaveBar({ changes, onSave, onCancel, busy = false }: { changes: string[]; onSave: () => void; onCancel: () => void; busy?: boolean }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  if (changes.length === 0) return null;
  const count = changes.length === 1 ? t('form.changesOne') : t('form.changesMany', { count: changes.length });
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 16, end: 16, bottom: Math.max(insets.bottom, 16) + (keyboard > 0 ? keyboard - insets.bottom : 0) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 24, padding: 12, backgroundColor: Brand.graphite, shadowColor: Brand.graphite, shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
        <View style={{ flex: 1, gap: 2, paddingStart: 6 }} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${count}. ${changes.join(', ')}`}>
          <HText weight="semibold" size={14} color={Brand.white}>
            {count}
          </HText>
          <HText size={12} color={Brand.mutedOnDark} numberOfLines={1}>
            {changes.join(', ')}
          </HText>
        </View>
        <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel={t('form.cancel')} style={{ minHeight: 46, minWidth: 44, borderRadius: 23, borderWidth: 1, borderColor: Brand.strokeOnDark, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="semibold" size={13} color={Brand.white}>
            {t('form.cancel')}
          </HText>
        </Pressable>
        <Pressable onPress={onSave} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} accessibilityLabel={busy ? t('form.saving') : t('form.save')} style={{ minHeight: 46, minWidth: 44, borderRadius: 23, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.orange, opacity: busy ? 0.8 : 1 }}>
          {busy ? <ActivityIndicator size="small" color={Brand.white} /> : null}
          <HText weight="semibold" size={13} color={Brand.white}>
            {busy ? t('form.saving') : t('form.save')}
          </HText>
        </Pressable>
      </View>
    </View>
  );
}
