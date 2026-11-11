import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { withAlpha } from '../fleet-style';

function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: withAlpha(Brand.graphite, 0.55) }} onPress={onClose} accessibilityLabel={t('vehicleDetail.close')} />
      <View style={{ backgroundColor: Palette.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 14 }}>{children}</View>
    </Modal>
  );
}

export type MenuItem = { key: string; label: string; onPress: () => void; danger?: boolean };

/** Menu « … » : Modifier, Archiver. */
export function MoreMenu({ visible, onClose, items }: { visible: boolean; onClose: () => void; items: MenuItem[] }) {
  return (
    <Sheet visible={visible} onClose={onClose}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          onPress={() => {
            onClose();
            item.onPress();
          }}
          accessibilityRole="button"
          style={{ minHeight: 52, borderRadius: 16, backgroundColor: Palette.surface, paddingHorizontal: 16, justifyContent: 'center' }}
        >
          <HText weight="semibold" size={15} color={item.danger ? Palette.error : Palette.textPrimary}>
            {item.label}
          </HText>
        </Pressable>
      ))}
    </Sheet>
  );
}

/** « Rendre indisponible » : confirmation avec un motif facultatif (200 caractères au plus). */
export function ReasonSheet({ visible, onClose, onConfirm, busy = false, error = null }: { visible: boolean; onClose: () => void; onConfirm: (reason: string) => void; busy?: boolean; error?: string | null }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  return (
    <Sheet visible={visible} onClose={onClose}>
      <HText font="display" weight="bold" size={20} accessibilityRole="header">
        {t('vehicleDetail.reason.title')}
      </HText>
      <HText size={14} color={Palette.textSecondary} style={{ lineHeight: 20 }}>
        {t('vehicleDetail.reason.body')}
      </HText>
      <View style={{ gap: 6 }}>
        <HText weight="semibold" size={12} color={Palette.textSecondary}>
          {t('vehicleDetail.reason.label')}
        </HText>
        <TextInput
          value={reason}
          onChangeText={(text) => setReason(text.slice(0, 200))}
          placeholder={t('vehicleDetail.reason.placeholder')}
          placeholderTextColor={Palette.textMuted}
          maxLength={200}
          multiline
          accessibilityLabel={t('vehicleDetail.reason.label')}
          style={{ minHeight: 56, maxHeight: 110, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface, padding: 12, fontSize: 15, color: Palette.textPrimary, textAlignVertical: 'top' }}
        />
      </View>
      {error ? (
        <HText size={13} color={Palette.error} accessibilityLiveRegion="polite">
          {error}
        </HText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={onClose} accessibilityRole="button" style={{ flex: 1, minHeight: 52, borderRadius: 26, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="semibold" size={14}>
            {t('vehicleDetail.reason.cancel')}
          </HText>
        </Pressable>
        <Pressable onPress={() => onConfirm(reason.trim())} disabled={busy} accessibilityRole="button" style={{ flex: 1.4, minHeight: 52, borderRadius: 26, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
          <HText weight="semibold" size={14} color={Brand.white}>
            {t('vehicleDetail.reason.confirm')}
          </HText>
        </Pressable>
      </View>
    </Sheet>
  );
}
