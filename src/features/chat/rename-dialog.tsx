import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { Brand, HomeFonts, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

/** Fenêtre « Renommer la conversation » : un champ de titre, Annuler / Enregistrer. */
export function RenameDialog({ visible, initialTitle, onClose, onSave }: { visible: boolean; initialTitle: string; onClose: () => void; onSave: (title: string) => void }) {
  const { t, language } = useLanguage();
  const [title, setTitle] = useState(initialTitle);
  const trimmed = title.trim();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'center', padding: 24 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')}>
        <Pressable onPress={() => undefined} accessible={false} style={{ backgroundColor: Palette.card, borderRadius: 22, padding: 20, gap: 14 }}>
          <HText font="display" weight="semibold" size={17}>
            {t('chat.history.renameTitle')}
          </HText>
          <TextInput
            value={title}
            onChangeText={setTitle}
            autoFocus
            maxLength={120}
            returnKeyType="done"
            onSubmitEditing={() => trimmed && onSave(trimmed)}
            accessibilityLabel={t('chat.history.renameField')}
            style={{ height: 48, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface, paddingHorizontal: 14, fontSize: 15, color: Palette.textPrimary, fontFamily: language === 'ar' ? HomeFonts.arabic.medium : HomeFonts.text.regular }}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
            <Pressable onPress={onClose} accessibilityRole="button" style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
              <HText weight="semibold" size={14} color={Palette.textSecondary}>
                {t('common.cancel')}
              </HText>
            </Pressable>
            <Pressable
              onPress={() => trimmed && onSave(trimmed)}
              disabled={!trimmed}
              accessibilityRole="button"
              style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 14, justifyContent: 'center', backgroundColor: trimmed ? Brand.graphite : Palette.surfaceAlt }}
            >
              <HText weight="semibold" size={14} color={trimmed ? Brand.white : Palette.textMuted}>
                {t('chat.history.save')}
              </HText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
