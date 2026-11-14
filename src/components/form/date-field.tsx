import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { createElement, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { parseIsoDay, relativeDay, toIsoDay } from './logic';

/**
 * Date : un champ avec une icône calendrier, la date en clair (« 14 nov. 2027 ») et dessous un rappel relatif (« dans 12 mois »,
 * éventuellement suivi de `extra` : « · ou à 55 200 km »). Un tap ouvre le calendrier du téléphone : on ne tape jamais une date à la main.
 * Valeur ISO (AAAA-MM-JJ) ou null (vide : « Choisir une date », jamais « — »).
 */
export function DateField({ label, value, onChange, minimumDate, maximumDate, relative = true, extra, error, showError = false, help }: { label: string; value: string | null; onChange: (iso: string) => void; minimumDate?: Date; maximumDate?: Date; relative?: boolean; extra?: string; error?: string; showError?: boolean; help?: string }) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date>(() => (value ? parseIsoDay(value) : new Date()));
  const locale = language === 'ar' ? 'ar-MA' : 'fr-FR';
  const shown = value ? parseIsoDay(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const rel = value && relative ? relativeDay(value, new Date()) : null;
  const relText = rel ? t(`form.rel.${rel.key}`, { n: rel.n }) : '';
  const sub = [relText, extra].filter(Boolean).join(' ');
  const visibleError = !!error && showError;

  function pick() {
    const current = value ? parseIsoDay(value) : new Date();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode: 'date', minimumDate, maximumDate, onChange: (event: DateTimePickerEvent, date?: Date) => { if (event.type === 'set' && date) onChange(toIsoDay(date)); } });
      return;
    }
    setPending(current);
    setOpen(true);
  }

  const body = (
    <Pressable
      onPress={Platform.OS === 'web' ? undefined : pick}
      accessibilityRole="button"
      accessibilityLabel={`${label}${shown ? `: ${shown}` : ''}`}
      style={{ minHeight: 60, borderRadius: 16, borderWidth: visibleError ? 1.5 : 1, borderColor: visibleError ? Palette.error : Palette.border, backgroundColor: visibleError ? Brand.errorFieldFill : Brand.white, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <Ionicons name="calendar-outline" size={22} color={Brand.graphite} />
      <View style={{ flex: 1 }}>
        <HText weight="bold" size={16} color={shown ? Palette.textPrimary : Palette.textMuted}>
          {shown || t('form.pickDate')}
        </HText>
        {sub ? (
          <HText size={12} color={Palette.textSecondary}>
            {sub}
          </HText>
        ) : null}
      </View>
      <Ionicons name="chevron-down" size={16} color={Palette.textSecondary} />
      {Platform.OS === 'web'
        ? createElement('input', {
            type: 'date',
            value: value ?? '',
            min: minimumDate ? toIsoDay(minimumDate) : undefined,
            max: maximumDate ? toIsoDay(maximumDate) : undefined,
            'aria-label': label,
            onChange: (event: { target: { value: string } }) => event.target.value && onChange(event.target.value),
            style: { position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' },
          })
        : null}
    </Pressable>
  );

  return (
    <View style={{ gap: 6 }}>
      <HText weight="semibold" size={13} color={visibleError ? Palette.error : Palette.textSecondary} numberOfLines={1}>
        {label}
      </HText>
      {body}
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
            <DateTimePicker value={pending} mode="date" display="inline" themeVariant="light" locale={locale} minimumDate={minimumDate} maximumDate={maximumDate} accentColor={Brand.orange} onChange={(_event, date) => date && setPending(date)} />
            <Pressable onPress={() => { onChange(toIsoDay(pending)); setOpen(false); }} accessibilityRole="button" style={{ height: 54, borderRadius: 27, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
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
