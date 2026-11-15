import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { createElement, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

const pad = (n: number) => String(n).padStart(2, '0');
const toTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const dateOf = (time: string | null) => {
  const now = new Date();
  const [hour, minute] = time ? time.split(':').map(Number) : [now.getHours(), now.getMinutes()];
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
};

/**
 * Heure : même principe que le champ date (icône horloge, heure en clair, un tap ouvre le sélecteur du téléphone ; on ne tape jamais une
 * heure à la main). Valeur « HH:MM » (24 h) ou null (vide : « Choisir une heure »).
 */
export function TimeField({ label, value, onChange, error, showError = false, help }: { label: string; value: string | null; onChange: (time: string) => void; error?: string; showError?: boolean; help?: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date>(() => dateOf(value));
  const visibleError = !!error && showError;

  function pick() {
    const current = dateOf(value);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode: 'time', is24Hour: true, onValueChange: (_event, date) => onChange(toTime(date)) });
      return;
    }
    setPending(current);
    setOpen(true);
  }

  return (
    <View style={{ gap: 6 }}>
      <HText weight="semibold" size={13} color={visibleError ? Palette.error : Palette.textSecondary} numberOfLines={1}>
        {label}
      </HText>
      <Pressable
        onPress={Platform.OS === 'web' ? undefined : pick}
        accessibilityRole="button"
        accessibilityLabel={`${label}${value ? `: ${value}` : ''}`}
        style={{ minHeight: 60, borderRadius: 16, borderWidth: visibleError ? 1.5 : 1, borderColor: visibleError ? Palette.error : Palette.border, backgroundColor: visibleError ? Brand.errorFieldFill : Brand.white, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Ionicons name="time-outline" size={22} color={Brand.graphite} />
        <View style={{ flex: 1 }}>
          <HText weight="bold" size={16} color={value ? Palette.textPrimary : Palette.textMuted}>
            {value ?? t('form.pickTime')}
          </HText>
        </View>
        <Ionicons name="chevron-down" size={16} color={Palette.textSecondary} />
        {Platform.OS === 'web'
          ? createElement('input', {
              type: 'time',
              value: value ?? '',
              'aria-label': label,
              onChange: (event: { target: { value: string } }) => event.target.value && onChange(event.target.value),
              style: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' },
            })
          : null}
      </Pressable>
      {visibleError ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="alert-circle-outline" size={14} color={Palette.error} />
          <HText weight="semibold" size={12} color={Palette.error} style={{ flex: 1 }}>
            {error}
          </HText>
        </View>
      ) : help ? (
        <HText size={12} color={Palette.textSecondary}>
          {help}
        </HText>
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: Palette.overlay }} onPress={() => setOpen(false)} accessibilityLabel={t('form.close')} />
          <View style={{ backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 8 }}>
            <View style={{ alignItems: 'center' }}>
              <DateTimePicker value={pending} mode="time" display="spinner" is24Hour themeVariant="light" accentColor={Brand.orange} onValueChange={(_event, date) => setPending(date)} />
            </View>
            <Pressable onPress={() => { onChange(toTime(pending)); setOpen(false); }} accessibilityRole="button" style={{ height: 54, borderRadius: 27, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
              <HText weight="semibold" size={15} color={Brand.white}>
                {t('form.done')}
              </HText>
            </Pressable>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
