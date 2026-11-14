import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Brand, homeDisplayFont, homeTextFont, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { formatThousands, digitsOnly } from './logic';
import { HALO } from './form-field';

function StepButton({ symbol, label, onPress, disabled }: { symbol: string; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} hitSlop={6} style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface, opacity: disabled ? 0.4 : 1 }}>
      <HText weight="semibold" size={22}>
        {symbol}
      </HText>
    </Pressable>
  );
}

/** Nombre entier avec − et + (places, portes) dans un champ de 56 px. Vide (null) : « Choisir » en texte d'aide, jamais « 0 » ni « — ». */
export function NumberStepper({ label, value, onChange, min = 1, max = 9, placeholder }: { label: string; value: number | null; onChange: (value: number) => void; min?: number; max?: number; placeholder?: string }) {
  const { t } = useLanguage();
  return (
    <View style={{ gap: 6 }}>
      <HText weight="semibold" size={13} color={Palette.textSecondary} numberOfLines={1}>
        {label}
      </HText>
      <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={value === null ? undefined : { now: value, min, max }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 56, borderRadius: 16, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, paddingHorizontal: 6 }}>
        <StepButton symbol="−" label={t('form.minus')} onPress={() => onChange(Math.max(min, (value ?? min + 1) - 1))} disabled={value !== null && value <= min} />
        <HText weight="semibold" size={16} color={value === null ? Palette.textMuted : Palette.textPrimary}>
          {value === null ? (placeholder ?? '') : String(value)}
        </HText>
        <StepButton symbol="+" label={t('form.plus')} onPress={() => onChange(Math.min(max, (value ?? min - 1) + 1))} disabled={value !== null && value >= max} />
      </View>
    </View>
  );
}

/**
 * Prix par jour : − et + (pas de 50), valeur au centre en grand, « MAD / jour » ; on peut aussi taper la valeur. Dessous, des suggestions
 * (semaine, mois) : un tap les applique. Les employés ne voient jamais ce composant (l'écran ne le rend pas).
 */
export function PriceStepper({ label, value, onChange, step = 50, min = 50, suggestions }: { label: string; value: number | null; onChange: (value: number | null) => void; step?: number; min?: number; suggestions?: { label: string; onPress: () => void }[] }) {
  const { t, language } = useLanguage();
  const [focused, setFocused] = useState(false);
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: focused ? 1.5 : 1, borderColor: focused ? Brand.orange : Palette.border, backgroundColor: Brand.white, padding: 6 }}>
      <StepButton symbol="−" label={t('form.minus')} onPress={() => onChange(Math.max(min, (value ?? min + step) - step))} disabled={value !== null && value <= min} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 }}>
        <TextInput
          value={value === null ? '' : formatThousands(String(value))}
          onChangeText={(text) => {
            const digits = digitsOnly(text);
            onChange(digits === '' ? null : Number(digits));
          }}
          keyboardType="number-pad"
          placeholder="ex. 500"
          placeholderTextColor={Palette.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          style={{ minWidth: 70, flexShrink: 1, textAlign: 'center', padding: 0, fontFamily: homeDisplayFont(language, 'bold'), fontSize: 28, color: Brand.graphite }}
        />
        <HText weight="bold" size={13} color={Palette.textSecondary} numberOfLines={1} style={{ flexShrink: 0, fontFamily: homeTextFont(language, 'semibold') }}>
          {t('form.perDay')}
        </HText>
      </View>
      <StepButton symbol="+" label={t('form.plus')} onPress={() => onChange((value ?? min - step) + step)} disabled={false} />
    </View>
  );
  return (
    <View style={{ gap: 8 }}>
      <HText weight="semibold" size={13} color={Palette.textSecondary} numberOfLines={1}>
        {label}
      </HText>
      {focused ? <View style={{ margin: -4, padding: 4, borderRadius: 20, backgroundColor: HALO }}>{body}</View> : body}
      {suggestions && suggestions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((suggestion) => (
            <Pressable key={suggestion.label} onPress={suggestion.onPress} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <View style={{ height: 34, borderRadius: 17, borderWidth: 1, borderColor: Brand.suggestBorder, backgroundColor: Brand.suggestFill, paddingHorizontal: 12, justifyContent: 'center' }}>
                <HText weight="semibold" size={12} color={Brand.orangeUrgentText}>
                  {suggestion.label}
                </HText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
