import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

export type FormButtonVariant = 'primary' | 'secondary' | 'link' | 'danger';

/**
 * Bouton du kit : 54 px, pilule. Principal (orange plein, UN seul par écran, léger retour haptique), secondaire (contour graphite),
 * lien (texte orange), supprimer (rouge doux — toujours avec confirmation). `loading` : spinner + « Enregistrement… », non cliquable.
 * `disabled` : gris ; `disabledReason` dit POURQUOI, dessous.
 */
export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, disabledReason, icon, loadingLabel, style, accessibilityLabel }: { label: string; onPress: () => void; variant?: FormButtonVariant; loading?: boolean; disabled?: boolean; disabledReason?: string; icon?: keyof typeof Ionicons.glyphMap; loadingLabel?: string; style?: StyleProp<ViewStyle>; accessibilityLabel?: string }) {
  const { t } = useLanguage();
  const off = disabled || loading;
  const palette = {
    primary: { bg: Brand.orange, ink: Brand.white, border: 'transparent' },
    secondary: { bg: Brand.white, ink: Brand.graphite, border: Brand.graphite },
    link: { bg: 'transparent', ink: Brand.orangeUrgentText, border: 'transparent' },
    danger: { bg: Brand.errorFieldFill, ink: Palette.error, border: Brand.dangerBorder },
  }[variant];
  const height = variant === 'link' ? 48 : 54;
  return (
    <View style={[{ gap: 8 }, style]}>
      <Pressable
        onPress={() => {
          if (off) return;
          if (variant === 'primary') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          onPress();
        }}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: off, busy: loading }}
        style={{
          height,
          borderRadius: height / 2,
          borderWidth: variant === 'secondary' || variant === 'danger' ? 1.5 : 0,
          borderColor: disabled ? 'transparent' : palette.border,
          backgroundColor: disabled && variant !== 'link' ? Palette.border : palette.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          paddingHorizontal: 20,
        }}
      >
        {loading ? <ActivityIndicator size="small" color={palette.ink} /> : icon ? <Ionicons name={icon} size={18} color={disabled ? Palette.textSecondary : palette.ink} /> : null}
        <HText weight="semibold" size={variant === 'link' ? 14 : 15} color={disabled ? Palette.textSecondary : palette.ink}>
          {loading ? (loadingLabel ?? t('form.saving')) : label}
        </HText>
      </Pressable>
      {disabled && disabledReason ? (
        <HText size={12} color={Palette.textSecondary} style={{ textAlign: 'center' }}>
          {disabledReason}
        </HText>
      ) : null}
    </View>
  );
}

/** Lien rouge discret en bas d'un écran (supprimer, archiver, annuler une réservation) : toujours suivi d'une confirmation. */
export function DangerLink({ label, onPress, disabled = false, reason }: { label: string; onPress: () => void; disabled?: boolean; reason?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}>
        <HText weight="semibold" size={13} color={disabled ? Palette.textMuted : Palette.error}>
          {label}
        </HText>
      </Pressable>
      {reason ? (
        <HText size={12} color={Palette.textSecondary} style={{ textAlign: 'center', paddingHorizontal: 12, lineHeight: 17 }}>
          {reason}
        </HText>
      ) : null}
    </View>
  );
}
