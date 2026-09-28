import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextField({ label, error, className, ...rest }: TextFieldProps) {
  return (
    <View className="gap-1.5">
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
      ) : null}
      <TextInput
        placeholderTextColor="#9aa3bd"
        className={`rounded-2xl border px-4 py-3 text-base text-[#101423] ${
          error ? 'border-[#dc2626]' : 'border-[#e1e5f0]'
        } bg-white ${className ?? ''}`}
        {...rest}
      />
      {error ? (
        <ThemedText type="small" style={{ color: '#dc2626' }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
