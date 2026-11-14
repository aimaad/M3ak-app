/**
 * Briques de formulaire de la fiche véhicule (modification sur place et formulaire complet) : un seul style, celui de la marque —
 * cartes blanches, champs de 52 px à coins arrondis (focus orange, erreur rouge avec icône), pastilles de choix, boutons de 52 px.
 * Les composants communs de l'application (TextField, ChipGroup) ne sont pas modifiés : d'autres écrans s'en servent.
 */
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState, type ReactNode } from 'react';
import { Image, Pressable, TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import { Brand, homeTextFont, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useSignedUrl } from '@/features/storage/hooks';
import { useLanguage } from '@/i18n/use-language';

type IconName = keyof typeof Ionicons.glyphMap;

// ------------------------------------------------------------------ carte et titres

/** Carte blanche d'un groupe de champs : titre (et sous-titre) puis les champs, 16 px d'écart. */
export function FormCard({ title, subtitle, children, gap = 16 }: { title?: string; subtitle?: string; children: ReactNode; gap?: number }) {
  return (
    <View style={{ backgroundColor: Brand.white, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 16, gap }}>
      {title ? (
        <View style={{ gap: 2 }}>
          <HText font="display" weight="bold" size={17} accessibilityRole="header">
            {title}
          </HText>
          {subtitle ? (
            <HText size={12} color={Palette.textSecondary} style={{ lineHeight: 17 }}>
              {subtitle}
            </HText>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Petit titre de groupe dans une carte (« PÉRIODE », « DOCUMENTS »…). */
export function GroupLabel({ children }: { children: string }) {
  return (
    <HText weight="semibold" size={11} track={0.14} color={Palette.textSecondary}>
      {children.toLocaleUpperCase()}
    </HText>
  );
}

// ------------------------------------------------------------------ champ

export type FieldProps = Pick<TextInputProps, 'autoCapitalize' | 'autoFocus' | 'editable' | 'multiline' | 'onSubmitEditing' | 'placeholder' | 'maxLength'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Ajoute « (facultatif) » au libellé. */
  optional?: boolean;
  error?: string;
  hint?: string;
  /** Texte à droite du champ : « MAD », « km »… */
  unit?: string;
  keyboardType?: KeyboardTypeOptions;
  /** Gros chiffres (kilométrage, prix) : 20 px au lieu de 16. */
  large?: boolean;
  /** Contenu toujours écrit de gauche à droite (plaque, numéro de série, dates) même dans une interface en arabe. */
  ltr?: boolean;
};

/** Champ de saisie : libellé au-dessus, 52 px, coins 14, bordure orange au focus, rouge avec icône et message en cas d'erreur. */
export function Field({ label, value, onChangeText, optional, error, hint, unit, keyboardType, large = false, ltr = false, multiline = false, ...rest }: FieldProps) {
  const { t, language } = useLanguage();
  const [focused, setFocused] = useState(false);
  const shownLabel = optional ? `${label} (${t('common.optional')})` : label;
  const borderColor = error ? Palette.error : focused ? Brand.orange : Palette.border;
  return (
    <View style={{ gap: 6 }}>
      <HText weight="semibold" size={12} color={Palette.textSecondary}>
        {shownLabel}
      </HText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: multiline ? 96 : 52,
          borderRadius: 14,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          backgroundColor: focused ? Brand.white : Palette.surface,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={Palette.textMuted}
          accessibilityLabel={shownLabel}
          aria-invalid={error ? true : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            paddingVertical: multiline ? 12 : 0,
            minHeight: multiline ? 96 : 52,
            fontFamily: homeTextFont(language, large ? 'semibold' : 'medium'),
            fontSize: large ? 20 : 16,
            color: Brand.graphite,
            textAlignVertical: multiline ? 'top' : 'center',
            ...(ltr ? { textAlign: 'left' as const, writingDirection: 'ltr' as const } : {}),
          }}
        />
        {unit ? (
          <HText weight="semibold" size={13} color={Palette.textSecondary} style={{ marginStart: 8 }}>
            {unit}
          </HText>
        ) : null}
      </View>
      {error ? (
        <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="alert-circle" size={14} color={Palette.error} />
          <HText size={12} color={Palette.error} style={{ flex: 1 }}>
            {error}
          </HText>
        </View>
      ) : hint ? (
        <HText size={11} color={Palette.textSecondary}>
          {hint}
        </HText>
      ) : null}
    </View>
  );
}

/** Libellé + contenu libre (pastilles, photo…) avec le même espacement qu'un champ. */
export function FieldGroup({ label, children, onLayout }: { label: string; children: ReactNode; onLayout?: (event: import('react-native').LayoutChangeEvent) => void }) {
  return (
    <View style={{ gap: 8 }} onLayout={onLayout}>
      <HText weight="semibold" size={12} color={Palette.textSecondary}>
        {label}
      </HText>
      {children}
    </View>
  );
}

// ------------------------------------------------------------------ pastilles de choix

/** Pastilles de choix : une seule active (graphite, avec coche), 44 px de haut. */
export function Chips<T extends string>({ options, selected, getLabel, onSelect, disabled = false }: { options: readonly T[]; selected: T | null; getLabel: (option: T) => string; onSelect: (option: T) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => {
        const on = option === selected;
        return (
          <Pressable
            key={option}
            onPress={() => !disabled && onSelect(option)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityState={{ selected: on, disabled }}
            style={{
              minHeight: 44,
              borderRadius: 22,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: on ? Brand.graphite : Brand.white,
              borderWidth: 1,
              borderColor: on ? Brand.graphite : Palette.border,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {on ? <Ionicons name="checkmark" size={14} color={Brand.white} /> : null}
            <HText weight="semibold" size={13} color={on ? Brand.white : Palette.textPrimary}>
              {getLabel(option)}
            </HText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------ messages et boutons

/** Bandeau d'erreur (rouge très clair, icône) — pour une erreur qui concerne tout le formulaire. */
export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Palette.errorSoft, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }}>
      <Ionicons name="alert-circle" size={16} color={Palette.error} style={{ marginTop: 1 }} />
      <HText size={13} color={Palette.error} style={{ flex: 1, lineHeight: 18 }}>
        {children}
      </HText>
    </View>
  );
}

/** « Annuler » (contour) et « Enregistrer » (orange plein, un seul par formulaire), 52 px ; l'erreur éventuelle s'affiche au-dessus. */
export function FormActions({ onSave, onCancel, busy = false, disabled = false, error }: { onSave: () => void; onCancel: () => void; busy?: boolean; disabled?: boolean; error?: string | null }) {
  const { t } = useLanguage();
  const off = busy || disabled;
  return (
    <View style={{ gap: 12 }}>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel={t('vehicleDetail.editor.cancel')} style={{ flex: 1, minHeight: 52, borderRadius: 26, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' }}>
          <HText weight="semibold" size={15}>
            {t('vehicleDetail.editor.cancel')}
          </HText>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={off}
          accessibilityRole="button"
          accessibilityState={{ disabled: off, busy }}
          accessibilityLabel={t('vehicleDetail.editor.save')}
          style={{ flex: 1.5, minHeight: 52, borderRadius: 26, backgroundColor: disabled && !busy ? Palette.surfaceAlt : Brand.orange, opacity: busy ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {!busy && !disabled ? <Ionicons name="checkmark" size={18} color={Brand.white} /> : null}
          <HText weight="semibold" size={15} color={disabled && !busy ? Palette.textMuted : Brand.white}>
            {busy ? t('vehicleDetail.editor.saving') : t('vehicleDetail.editor.save')}
          </HText>
        </Pressable>
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ photo d'un papier

async function pickImage(source: 'camera' | 'library'): Promise<string | null> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Photo d'un papier (carte grise, attestation…) : aperçu ou cadre en pointillés, puis « Caméra » et « Galerie ». */
export function PaperPhotoField({ label, bucket, localUri, existingPath, onPick }: { label: string; bucket: string; localUri: string | null; existingPath?: string; onPick: (uri: string) => void }) {
  const { t } = useLanguage();
  const { data: signedUrl } = useSignedUrl(bucket, localUri ? undefined : existingPath);
  const preview = localUri ?? signedUrl ?? null;
  const button = (icon: IconName, text: string, source: 'camera' | 'library') => (
    <Pressable
      onPress={async () => {
        const uri = await pickImage(source);
        if (uri) onPick(uri);
      }}
      accessibilityRole="button"
      style={{ flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: Palette.border, backgroundColor: Brand.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
    >
      <Ionicons name={icon} size={17} color={Brand.graphite} />
      <HText weight="semibold" size={14}>
        {text}
      </HText>
    </Pressable>
  );
  return (
    <FieldGroup label={label}>
      {preview ? (
        <View style={{ height: 150, borderRadius: 16, overflow: 'hidden', backgroundColor: Brand.graphite }}>
          <Image source={{ uri: preview }} accessibilityLabel={label} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
          {localUri ? (
            <View style={{ position: 'absolute', end: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Brand.orange }}>
              <Ionicons name="cloud-upload-outline" size={12} color={Brand.white} />
              <HText weight="bold" size={11} color={Brand.white}>
                {t('vehicleDetail.editor.toSend')}
              </HText>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ height: 96, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Palette.textMuted, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Ionicons name="document-text-outline" size={24} color={Palette.textSecondary} />
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {button('camera-outline', t('common.camera'), 'camera')}
        {button('images-outline', t('common.gallery'), 'library')}
      </View>
    </FieldGroup>
  );
}
