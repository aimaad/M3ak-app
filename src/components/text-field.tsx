import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';
import { Palette } from '@/constants/theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  /** Ajoute « (facultatif) » au libellé : mieux qu'un texte indicatif qui disparaît dès qu'on tape. */
  optional?: boolean;
  error?: string;
  /** Mise en garde non bloquante, par ex. « à vérifier » pour un champ lu par OCR avec un doute. */
  warning?: string;
  /** Classes du conteneur (libellé + champ), par ex. « flex-1 » pour deux champs côte à côte. `className` reste celui du champ. */
  containerClassName?: string;
};

export function TextField({ label, optional, error, warning, className, containerClassName, onFocus, onBlur, ...rest }: TextFieldProps) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  const shownLabel = label && optional ? `${label} (${t('common.optional')})` : label;
  return (
    <View className={`gap-1.5 ${containerClassName ?? ''}`}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {shownLabel}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor={Palette.textMuted}
        accessibilityLabel={rest.accessibilityLabel ?? shownLabel}
        aria-invalid={error ? true : undefined}
        className={`rounded-2xl border px-4 py-3 text-base text-content ${
          error ? 'border-error' : warning ? 'border-warning' : focused ? 'border-primary' : 'border-border'
        } bg-card ${className ?? ''}`}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
      {error ? (
        <ThemedText type="small" accessibilityRole="alert" style={{ color: Palette.error }}>
          {error}
        </ThemedText>
      ) : warning ? (
        <ThemedText type="small" style={{ color: Palette.warning }}>
          {warning}
        </ThemedText>
      ) : null}
    </View>
  );
}
