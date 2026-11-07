import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Palette } from '@/constants/theme';

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

/**
 * Règles BIBIP : un seul bouton orange plein par écran (`primary`) ; les actions secondaires sont en contour (`secondary`)
 * ou en texte (`ghost`). `danger` (action destructrice) est un contour ou un texte rouge, jamais un bouton plein, et doit
 * toujours être précédé d'une confirmation. Texte blanc sur orange : ≥ 16 px et graisse ≥ 600.
 */
const VARIANT_STYLES: Record<
  ButtonVariant,
  { bg: string; bgDisabled: string; text: string; textDisabled: string; border?: string }
> = {
  primary: { bg: Palette.primary, bgDisabled: Palette.surfaceAlt, text: Palette.onPrimary, textDisabled: Palette.textMuted },
  secondary: { bg: Palette.card, bgDisabled: Palette.card, text: Brand.graphite, textDisabled: Palette.textMuted, border: Palette.border },
  ghost: { bg: 'transparent', bgDisabled: 'transparent', text: Brand.graphite, textDisabled: Palette.textMuted },
  danger: { bg: Palette.card, bgDisabled: Palette.card, text: Palette.error, textDisabled: Palette.textMuted, border: Palette.error },
};

export function Button({ label, variant = 'primary', size = 'md', loading, icon, disabled, style, ...rest }: ButtonProps) {
  const palette = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;
  const textColor = isDisabled ? palette.textDisabled : palette.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      className={`flex-row items-center justify-center gap-2 rounded-2xl ${size === 'sm' ? 'px-4 py-2.5' : 'px-4 py-4'}`}
      style={({ pressed }) => [
        {
          // Appuyé : orange foncé pour le bouton principal, léger voile gris pour les autres.
          backgroundColor: isDisabled
            ? palette.bgDisabled
            : pressed
              ? variant === 'primary'
                ? Palette.primaryPressed
                : variant === 'ghost'
                  ? Palette.surface
                  : Palette.surface
              : palette.bg,
          borderColor: palette.border ?? 'transparent',
          borderWidth: palette.border ? 1 : 0,
          opacity: 1,
          minHeight: 44,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={textColor} />
      ) : null}
      <ThemedText
        type={size === 'sm' && variant !== 'primary' ? 'small' : 'smallBold'}
        // Texte blanc sur orange : 16 px et gras (contraste 4,4:1).
        style={[{ color: textColor }, variant === 'primary' ? { fontSize: 16, lineHeight: 22 } : null]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
