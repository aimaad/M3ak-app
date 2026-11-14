import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { Brand, homeTextFont, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { digitsOnly, formatThousands } from './logic';

/** Halo orange léger autour d'un champ en cours de saisie (4 px, 14 % d'orange). */
export const HALO = 'rgba(202,83,29,0.14)';

export type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Exemple affiché quand le champ est vide (« ex. Blanc »). Jamais « — » ni « 0 ». */
  placeholder?: string;
  /** Aide sous le champ (12 px). */
  help?: string;
  /** Unité dans une pastille à droite (`km`, `CV`, `MAD / jour`) : jamais dans le libellé. */
  unit?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Nombre : clavier numérique, chiffres seulement (`onChangeText` reçoit les chiffres) et milliers séparés à l'affichage. */
  thousands?: boolean;
  /** Message d'erreur précis. Affiché à la sortie du champ ou quand `showError` est vrai (enregistrement), jamais pendant la frappe. */
  error?: string;
  showError?: boolean;
  /** Verrouillé + la raison (« Vient de la carte grise »). */
  locked?: boolean;
  lockedReason?: string;
  /** Valeur lue par l'IA : badge « Lu par l'IA » jusqu'à ce que l'utilisateur modifie la valeur. */
  aiRead?: boolean;
  /** Suggestions en puces sous le champ pendant la saisie. */
  suggestions?: string[];
  onPickSuggestion?: (suggestion: string) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  maxLength?: number;
  /** Toujours de gauche à droite (plaque, VIN, e-mail) même en interface arabe. */
  ltr?: boolean;
  onBlur?: () => void;
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
};

/**
 * Champ texte du kit BIBIP : 56 px, coins 16, 5 états (vide, en cours, lu par l'IA, erreur, verrouillé). Libellé au-dessus (13 px 600),
 * sur une seule ligne. L'erreur n'apparaît qu'à la sortie du champ ou à l'enregistrement.
 */
export function FormField({ label, value, onChangeText, placeholder, help, unit, keyboardType, thousands = false, error, showError = false, locked = false, lockedReason, aiRead = false, suggestions, onPickSuggestion, autoCapitalize, multiline = false, maxLength, ltr = false, onBlur, onSubmitEditing, accessibilityLabel }: FormFieldProps) {
  const { t, language } = useLanguage();
  const [focused, setFocused] = useState(false);
  const [blurred, setBlurred] = useState(false);
  const [edited, setEdited] = useState(false);
  const visibleError = !!error && (blurred || showError) && !focused;
  const shownBadge = aiRead && !edited && !locked;
  const display = thousands ? formatThousands(value) : value;
  const labelColor = locked ? Palette.textMuted : visibleError ? Palette.error : focused ? Brand.orange : Palette.textSecondary;
  const field = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center',
        minHeight: multiline ? 104 : 56,
        borderRadius: 16,
        borderWidth: focused || visibleError ? 1.5 : 1,
        borderStyle: locked ? 'dashed' : 'solid',
        borderColor: locked ? Brand.lockedBorder : visibleError ? Palette.error : focused ? Brand.orange : Palette.border,
        backgroundColor: locked ? Brand.lockedFill : visibleError ? Brand.errorFieldFill : Brand.white,
        paddingHorizontal: 16,
        paddingEnd: unit || shownBadge ? 8 : 16,
      }}
    >
      <TextInput
        value={display}
        onChangeText={(text) => {
          setEdited(true);
          onChangeText(thousands ? digitsOnly(text) : text);
        }}
        placeholder={placeholder}
        placeholderTextColor={Palette.textMuted}
        keyboardType={thousands ? 'number-pad' : keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        maxLength={maxLength}
        editable={!locked}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setBlurred(true);
          onBlur?.();
        }}
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: locked }}
        aria-invalid={visibleError ? true : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: multiline ? 104 : 56,
          paddingVertical: multiline ? 14 : 0,
          fontFamily: homeTextFont(language, 'semibold'),
          fontSize: 16,
          color: locked ? Palette.textSecondary : Brand.graphite,
          textAlignVertical: multiline ? 'top' : 'center',
          ...(ltr ? { textAlign: 'left' as const, writingDirection: 'ltr' as const } : {}),
        }}
      />
      {shownBadge ? (
        <View accessible accessibilityLabel={t('form.aiRead')} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: Brand.aiBadgeFill }}>
          <Ionicons name="sparkles" size={12} color={Brand.orangeUrgentText} />
          <HText weight="bold" size={11} color={Brand.orangeUrgentText}>
            {t('form.aiRead')}
          </HText>
        </View>
      ) : null}
      {unit ? (
        <View style={{ borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: Palette.surface }}>
          <HText weight="bold" size={13} color={Palette.textSecondary}>
            {unit}
          </HText>
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={{ gap: 6 }}>
      <HText weight="semibold" size={13} color={labelColor} numberOfLines={1}>
        {label}
      </HText>
      {focused ? <View style={{ margin: -4, padding: 4, borderRadius: 20, backgroundColor: HALO }}>{field}</View> : field}
      {focused && suggestions && suggestions.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {suggestions.map((suggestion) => (
            <Pressable key={suggestion} onPress={() => onPickSuggestion?.(suggestion)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <View style={{ height: 34, borderRadius: 17, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, paddingHorizontal: 12, justifyContent: 'center' }}>
                <HText weight="semibold" size={13}>
                  {suggestion}
                </HText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {visibleError ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="alert-circle-outline" size={14} color={Palette.error} />
          <HText weight="semibold" size={12} color={Palette.error} style={{ flex: 1 }}>
            {error}
          </HText>
        </View>
      ) : locked && lockedReason ? (
        <HText size={12} color={Palette.textSecondary}>
          {lockedReason}
        </HText>
      ) : help ? (
        <HText size={12} color={Palette.textSecondary}>
          {help}
        </HText>
      ) : null}
    </View>
  );
}
