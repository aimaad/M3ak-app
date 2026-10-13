import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  /** Mise en garde non bloquante, par ex. « à vérifier » pour un champ lu par OCR avec un doute. */
  warning?: string;
};

export function TextField({ label, error, warning, className, ...rest }: TextFieldProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor="#B3A6C2"
        className={`rounded-2xl border px-4 py-3 text-base text-[#211A2E] ${
          error ? 'border-[#DC2626]' : warning ? 'border-[#F59E0B]' : 'border-[#EAE5F2]'
        } bg-white ${className ?? ''}`}
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
