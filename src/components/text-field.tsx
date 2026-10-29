import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/i18n/use-language';

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
        placeholderTextColor="#8A82A0"
        accessibilityLabel={rest.accessibilityLabel ?? shownLabel}
        aria-invalid={error ? true : undefined}
        className={`rounded-2xl border px-4 py-3 text-base text-[#1E1633] ${
          error ? 'border-[#DC2626]' : warning ? 'border-[#F59E0B]' : focused ? 'border-[#7C3AED]' : 'border-[#E4DCF5]'
        } bg-white ${className ?? ''}`}
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
        <ThemedText type="small" accessibilityRole="alert" style={{ color: '#DC2626' }}>
          {error}
        </ThemedText>
      ) : warning ? (
        <ThemedText type="small" style={{ color: '#B45309' }}>
          {warning}
        </ThemedText>
      ) : null}
    </View>
  );
}
