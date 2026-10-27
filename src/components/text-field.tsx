import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  /** Mise en garde non bloquante, par ex. « à vérifier » pour un champ lu par OCR avec un doute. */
  warning?: string;
};

export function TextField({ label, error, warning, className, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="gap-1.5">
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor="#8A82A0"
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
        <ThemedText type="small" style={{ color: '#DC2626' }}>
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
