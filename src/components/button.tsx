import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { M3akPalette, Shadows } from '@/constants/theme';

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
  // Émeraude Kriha + texte très foncé : 6,2:1 (le blanc sur #00B884 n'atteint que 2,56:1).
  primary: { bg: M3akPalette.emerald, bgDisabled: '#A8E8D3', text: M3akPalette.onEmerald },
  secondary: { bg: '#FFFFFF', bgDisabled: '#FFFFFF', text: M3akPalette.mauveDeep, border: M3akPalette.border },
  ghost: { bg: 'transparent', bgDisabled: 'transparent', text: M3akPalette.mauve },
  danger: { bg: M3akPalette.dangerLight, bgDisabled: M3akPalette.dangerLight, text: '#B91C1C', border: '#FECACA' },
};

export function Button({ label, variant = 'primary', size = 'md', loading, icon, disabled, style, ...rest }: ButtonProps) {
  const palette = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 rounded-2xl active:opacity-90 ${size === 'sm' ? 'px-4 py-2.5' : 'px-4 py-4'}`}
      style={[
        {
          backgroundColor: isDisabled ? palette.bgDisabled : palette.bg,
          borderColor: palette.border ?? 'transparent',
          borderWidth: palette.border ? 1 : 0,
          opacity: isDisabled && variant !== 'primary' ? 0.5 : 1,
          minHeight: 44,
        },
        variant === 'primary' && !isDisabled ? Shadows.button : null,
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
