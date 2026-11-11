import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { FUEL_TYPES } from '../types';
import { type ReviewField, type ReviewIssue, type ReviewKey } from './review';

export function useFieldLabel() {
  const { t } = useLanguage();
  return (key: ReviewKey) => t(`vehicleAdd.read.labels.${key}`);
}

/** La valeur lue sur la carte, avec les caractères invalides soulignés en jaune. */
export function RawValue({ field }: { field: ReviewField }) {
  const { t } = useLanguage();
  const chars = Array.from(field.raw);
  return (
    <View style={{ minHeight: 52, borderRadius: 12, backgroundColor: Brand.surfaceOnDark, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, direction: 'ltr' }}>
      <MicroLabel size={10} track={0.1} color={Brand.mutedOnDark}>
        {t('vehicleAdd.read.onCard')}
      </MicroLabel>
      <HText accessibilityLabel={field.raw} style={{ flexShrink: 1, fontFamily: 'Courier New', fontSize: 18, fontWeight: '700', letterSpacing: 1.2, color: Brand.textOnDark }} numberOfLines={2}>
        {chars.length === 0 ? t('vehicleAdd.read.nothingRead') : chars.map((char, index) => (field.badChars.includes(index) ? <HText key={index} style={{ fontFamily: 'Courier New', fontSize: 18, fontWeight: '700', color: Brand.warningOnDark, textDecorationLine: 'underline' }}>{char}</HText> : char))}
      </HText>
    </View>
  );
}

/** Saisie d'un champ : texte, ou pastilles pour le carburant. */
export function FieldEditor({ fieldKey, value, onChange, onSubmit, issue, autoFocus = false }: { fieldKey: ReviewKey; value: string; onChange: (value: string) => void; onSubmit: () => void; issue: ReviewIssue | null; autoFocus?: boolean }) {
  const { t } = useLanguage();
  if (fieldKey === 'carburant') {
    return (
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {FUEL_TYPES.map((fuel) => (
          <Pressable key={fuel} onPress={() => onChange(fuel)} accessibilityRole="button" accessibilityState={{ selected: value === fuel }} style={{ minHeight: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: value === fuel ? Brand.graphite : Palette.card, borderWidth: 1, borderColor: value === fuel ? Brand.graphite : Palette.border }}>
            <HText weight="semibold" size={14} color={value === fuel ? Brand.white : Palette.textPrimary}>
              {t(`vehicle.fuel.${fuel}`)}
            </HText>
          </Pressable>
        ))}
      </View>
    );
  }
  const numeric = fieldKey === 'puissanceFiscale';
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      autoFocus={autoFocus}
      autoCapitalize={fieldKey === 'vin' ? 'characters' : 'none'}
      autoCorrect={false}
      keyboardType={numeric ? 'number-pad' : fieldKey === 'dateMiseEnCirculation' ? 'numbers-and-punctuation' : 'default'}
      placeholder={fieldKey === 'dateMiseEnCirculation' ? t('vehicle.fields.datePlaceholder') : undefined}
      placeholderTextColor={Palette.textMuted}
      accessibilityLabel={t(`vehicleAdd.read.labels.${fieldKey}`)}
      style={{ flex: 1, minWidth: 0, height: 48, borderRadius: 14, borderWidth: 1, borderColor: issue ? Palette.error : Palette.border, backgroundColor: Palette.surface, paddingHorizontal: 14, fontSize: fieldKey === 'vin' ? 15 : 16, fontWeight: '700', color: Palette.textPrimary }}
    />
  );
}

/** Carte « INFO À CONFIRMER » : nom du champ, valeur lue (caractères douteux soulignés), champ pré-rempli avec la correction et « Confirmer ». */
export function ConfirmCard({ field, label, headline, onConfirm }: { field: ReviewField; label: string; headline: string | null; onConfirm: (value: string) => ReviewIssue | null }) {
  const { t } = useLanguage();
  const [value, setValue] = useState(field.value);
  const [issue, setIssue] = useState<ReviewIssue | null>(null);
  const shownIssue = issue ?? field.issue;
  function submit() {
    setIssue(onConfirm(value));
  }
  return (
    <View style={{ backgroundColor: Palette.card, borderWidth: 1.5, borderColor: Brand.orange, borderRadius: 24, padding: 16, gap: 12, shadowColor: Brand.orange, shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {headline ? (
          <MicroLabel size={11} track={0.14} color={Brand.orangeUrgentText}>
            {headline}
          </MicroLabel>
        ) : (
          <View />
        )}
        {shownIssue ? (
          <HText size={11} color={issue ? Palette.error : Palette.textSecondary} style={{ flexShrink: 1 }} accessibilityLiveRegion="polite">
            {t(`vehicleAdd.read.reasons.${shownIssue}`)}
          </HText>
        ) : null}
      </View>
      <HText weight="semibold" size={15}>
        {label}
      </HText>
      <RawValue field={field} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: field.key === 'carburant' ? 'wrap' : 'nowrap' }}>
        <FieldEditor fieldKey={field.key} value={value} onChange={(next) => { setValue(next); setIssue(null); }} onSubmit={submit} issue={issue} />
        <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel={`${t('vehicleAdd.read.confirm')} ${label}`} style={{ minHeight: 48, borderRadius: 24, paddingHorizontal: 18, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="semibold" size={14} color={Brand.white}>
            {t('vehicleAdd.read.confirm')}
          </HText>
        </Pressable>
      </View>
    </View>
  );
}

/** Une ligne d'un groupe : libellé, valeur (ou « À confirmer »), point jaune si lecture moyenne, coche verte si confirmée. Un tap la corrige. */
export function ReviewRow({ label, display, confirmed, uncertain, onPress, editor }: { label: string; display: string; confirmed: boolean; uncertain: boolean; onPress: () => void; editor: React.ReactNode }) {
  const { t } = useLanguage();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: Palette.surfaceAlt }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={confirmed ? t('vehicleAdd.read.a11yRead', { field: label, value: display }) : t('vehicleAdd.read.a11yPending', { field: label })}
        accessibilityHint={t('vehicleAdd.read.edit', { field: label })}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 11 }}
      >
        <HText size={13} color={Palette.textSecondary} style={{ flexShrink: 0 }}>
          {label}
        </HText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
          <HText weight="semibold" size={14} color={confirmed ? Palette.textPrimary : Brand.orangeUrgentText} numberOfLines={1} style={{ flexShrink: 1 }}>
            {confirmed ? display || '—' : t('vehicleAdd.read.toConfirm')}
          </HText>
          {uncertain && confirmed ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Brand.parcInspect }} /> : null}
          {confirmed ? <Ionicons name="checkmark" size={15} color={Palette.success} /> : <Ionicons name="alert-circle" size={15} color={Brand.orange} />}
        </View>
      </Pressable>
      {editor}
    </View>
  );
}
