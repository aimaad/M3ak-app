import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

type ButtonProps = Omit<PressableProps, 'children' | 'style' | 'className'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; bgDisabled: string; text: string; border?: string }> = {
  primary: { bg: M3akPalette.mauve, bgDisabled: '#C9B8F5', text: '#FFFFFF' },
  secondary: { bg: '#FFFFFF', bgDisabled: '#FFFFFF', text: M3akPalette.mauve, border: '#EAE5F2' },
  ghost: { bg: 'transparent', bgDisabled: 'transparent', text: M3akPalette.mauve },
  danger: { bg: '#FFFFFF', bgDisabled: '#FFFFFF', text: M3akPalette.danger, border: '#EAE5F2' },
};

export function Button({ label, variant = 'primary', size = 'md', loading, icon, disabled, style, ...rest }: ButtonProps) {
  const palette = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 rounded-2xl ${size === 'sm' ? 'px-4 py-2.5' : 'px-4 py-4'} ${
        palette.border ? 'border' : ''
      }`}
      style={({ pressed }) => [
        {
          backgroundColor: isDisabled ? palette.bgDisabled : palette.bg,
          borderColor: palette.border,
          opacity: isDisabled && variant !== 'primary' ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.98 : 1 }],
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={palette.text} />
      ) : null}
      <ThemedText type={size === 'sm' ? 'small' : 'smallBold'} style={{ color: palette.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}
