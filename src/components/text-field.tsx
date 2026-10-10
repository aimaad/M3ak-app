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
        placeholderTextColor="#B3A6C2"
        className={`rounded-2xl border px-4 py-3 text-base text-[#211A2E] ${
          error ? 'border-[#DC2626]' : 'border-[#EAE5F2]'
        } bg-white ${className ?? ''}`}
        {...rest}
      />
      {error ? (
        <ThemedText type="small" style={{ color: '#DC2626' }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
