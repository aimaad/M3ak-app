import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, View, type ImageSourcePropType } from 'react-native';

import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { FormField } from './form-field';
import { colorKey, SWATCH_KEYS, type SwatchKey } from './logic';

type Option<T extends string> = { value: T; label: string };

/** Icône d'une tuile : un nom Ionicons, ou une image (trait noir sur fond transparent, teintée comme le texte). */
export type TileIcon = keyof typeof Ionicons.glyphMap | ImageSourcePropType;

export function TileIconView({ icon, color, size = 22 }: { icon: TileIcon; color: string; size?: number }) {
  if (typeof icon === 'string') return <Ionicons name={icon} size={size} color={color} />;
  return <Image source={icon} accessible={false} style={{ width: size + 10, height: size + 10, tintColor: color }} resizeMode="contain" />;
}

/** Libellé d'un choix, avec « À choisir » en orange quand rien n'est encore sélectionné. */
function ChoiceLabel({ label, needsChoice }: { label: string; needsChoice: boolean }) {
  const { t } = useLanguage();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <HText weight="semibold" size={13} color={Palette.textSecondary} numberOfLines={1}>
        {label}
      </HText>
      {needsChoice ? (
        <HText weight="bold" size={12} color={Brand.orangeUrgentText}>
          {t('form.chooseNeeded')}
        </HText>
      ) : null}
    </View>
  );
}

/**
 * Interrupteur à 2 ou 3 positions (boîte de vitesses). Piste grise, choix en blanc avec une ombre légère. Quand la valeur est inconnue
 * (null) rien n'est présélectionné : « À choisir » s'affiche en orange sous le libellé — on n'écrit jamais une valeur qu'on ne connaît pas.
 */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T | null; onChange: (value: T) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <ChoiceLabel label={label} needsChoice={value === null} />
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', gap: 4, height: 48, borderRadius: 14, backgroundColor: Palette.border, padding: 4 }}>
        {options.map((option) => {
          const on = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              accessibilityLabel={option.label}
              style={{ flex: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? Brand.white : 'transparent', shadowColor: Palette.shadow, shadowOpacity: on ? 0.12 : 0, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: on ? 1 : 0 }}
            >
              <HText weight={on ? 'semibold' : 'medium'} size={14} color={on ? Palette.textPrimary : Palette.textSecondary}>
                {option.label}
              </HText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Tuiles 92 × 72 avec icône, sur UNE seule ligne qui défile ; la tuile choisie est en graphite, texte blanc. */
export function ChoiceTiles<T extends string>({ label, options, value, onChange }: { label: string; options: (Option<T> & { icon: TileIcon })[]; value: T | null; onChange: (value: T) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <ChoiceLabel label={label} needsChoice={value === null} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingEnd: 20 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const on = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, selected: on }}
              accessibilityLabel={option.label}
              style={{ width: 92, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: on ? Brand.graphite : Palette.border, backgroundColor: on ? Brand.graphite : Brand.white }}
            >
              <TileIconView icon={option.icon} color={on ? Brand.white : Brand.graphite} />
              <HText weight="semibold" size={12} color={on ? Brand.white : Palette.textPrimary} numberOfLines={1}>
                {option.label}
              </HText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const SWATCH_COLOR: Record<SwatchKey, string> = { blanc: Brand.swatchBlanc, noir: Brand.swatchNoir, gris: Brand.swatchGris, argent: Brand.swatchArgent, rouge: Brand.swatchRouge, bleu: Brand.swatchBleu, beige: Brand.swatchBeige };

/**
 * Couleur du véhicule : pastilles de 40 px (Blanc, Noir, Gris, Argent, Rouge, Bleu, Beige) + « Autre » (champ texte). La pastille choisie a un
 * anneau orange et son nom s'écrit à côté. Une valeur existante (« BLANC ») s'affiche normalisée (« Blanc ») ; `onChange` n'est appelé que
 * quand l'utilisateur change la couleur : la base n'est jamais réécrite avant.
 */
export function ColorSwatches({ label, value, onChange }: { label: string; value: string | null; onChange: (value: string) => void }) {
  const { t } = useLanguage();
  const [forceOther, setForceOther] = useState(false);
  const key = forceOther ? 'other' : colorKey(value);
  const name = key && key !== 'other' ? t(`form.colors.${key}`) : key === 'other' ? t('form.other') : '';
  return (
    <View style={{ gap: 8 }}>
      <HText weight="semibold" size={13} color={Palette.textSecondary} numberOfLines={1}>
        {label}
      </HText>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
        {SWATCH_KEYS.map((swatch) => {
          const on = key === swatch;
          return (
            <Pressable key={swatch} onPress={() => { setForceOther(false); onChange(t(`form.colors.${swatch}`)); }} accessibilityRole="radio" accessibilityLabel={t(`form.colors.${swatch}`)} accessibilityState={{ checked: on, selected: on }} hitSlop={2} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: SWATCH_COLOR[swatch], borderWidth: 1, borderColor: Brand.swatchEdge }}>
                {on ? <View style={{ position: 'absolute', top: -5, bottom: -5, start: -5, end: -5, borderRadius: 25, borderWidth: 2, borderColor: Brand.orange }} /> : null}
              </View>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setForceOther(true)} accessibilityRole="radio" accessibilityLabel={t('form.other')} accessibilityState={{ checked: key === 'other', selected: key === 'other' }} style={{ minHeight: 44, borderRadius: 22, paddingHorizontal: 14, justifyContent: 'center', borderWidth: key === 'other' ? 2 : 1, borderColor: key === 'other' ? Brand.orange : Palette.border, backgroundColor: Brand.white }}>
          <HText weight="semibold" size={13}>
            {t('form.other')}
          </HText>
        </Pressable>
      </View>
      {name ? (
        <HText weight="semibold" size={13}>
          {name}
        </HText>
      ) : null}
      {key === 'other' ? <FormField label={t('form.otherLabel')} value={colorKey(value) === 'other' ? (value ?? '') : ''} onChangeText={onChange} placeholder={t('form.otherPlaceholder')} /> : null}
    </View>
  );
}
