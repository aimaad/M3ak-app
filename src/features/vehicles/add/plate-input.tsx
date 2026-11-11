import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Brand, HomeFonts, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { withAlpha } from '../fleet-style';
import { PLATE_LETTERS, type PlateParts } from './plate';

const PLATE_BOX = { height: 76, backgroundColor: Brand.white, borderWidth: 3, borderColor: Brand.graphite, borderRadius: 12, overflow: 'hidden' as const };
/** Anneau orange autour de la plaque (3 px) et ombre portée. */
function PlateFrame({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ borderWidth: 3, borderColor: Brand.orange, borderRadius: 15, shadowColor: Palette.shadow, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 14 }, elevation: 6 }}>{children}</View>
  );
}
const NUMBER_FONT = { fontFamily: HomeFonts.display.bold, fontSize: 32, color: Brand.graphite, textAlign: 'center' as const, padding: 0 };

/** Les lettres des plaques marocaines en grille : un tap choisit. « ه » est montrée avec son allongement (« هـ »), comme sur la plaque. */
function LetterSheet({ visible, selected, onPick, onClose }: { visible: boolean; selected: string; onPick: (letter: string) => void; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: withAlpha(Brand.graphite, 0.55) }} onPress={onClose} accessibilityLabel={t('vehicleAdd.verify.close')} />
      <View style={{ backgroundColor: Palette.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32, gap: 14 }}>
        <HText font="display" weight="bold" size={18} accessibilityRole="header">
          {t('vehicleAdd.verify.pickLetter')}
        </HText>
        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} style={{ maxHeight: 320 }}>
          {PLATE_LETTERS.map((letter) => (
            <Pressable
              key={letter}
              onPress={() => {
                onPick(letter);
                onClose();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === letter }}
              accessibilityLabel={t('vehicleAdd.verify.letterA11y', { letter })}
              style={{ width: 56, height: 56, borderRadius: 16, borderWidth: 1.5, borderColor: selected === letter ? Brand.orange : Palette.border, backgroundColor: selected === letter ? Palette.primarySoft : Palette.card, alignItems: 'center', justifyContent: 'center' }}
            >
              <HText style={{ fontFamily: HomeFonts.arabic.bold, fontSize: 28, lineHeight: 40 }} color={Brand.graphite}>
                {letter === 'ه' ? 'هـ' : letter}
              </HText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Saisie en forme de vraie plaque marocaine (76 px) : numéro (pavé numérique), lettre arabe (sélecteur) et région (pavé numérique).
 * L'ordre « numéro | lettre | région » ne change jamais, même en arabe ; chaque partie a son libellé pour le lecteur d'écran.
 */
export function PlateInput({ parts, onChange, onDark = true, onSubmit }: { parts: PlateParts; onChange: (parts: PlateParts) => void; onDark?: boolean; onSubmit?: () => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const label = onDark ? Brand.mutedOnDark : Palette.textSecondary;
  return (
    <View style={{ alignItems: 'center', gap: 10, direction: 'ltr' }}>
      <PlateFrame><View style={[PLATE_BOX, { flexDirection: 'row', alignItems: 'stretch' }]}>
        <TextInput
          value={parts.number}
          onChangeText={(number) => onChange({ ...parts, number: number.replace(/\D/g, '').slice(0, 6) })}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="68013"
          placeholderTextColor={Palette.textMuted}
          accessibilityLabel={t('vehicleAdd.verify.numberA11y')}
          style={[NUMBER_FONT, { width: 134 }]}
        />
        <View style={{ width: 3, backgroundColor: Brand.graphite }} />
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={parts.letter ? t('vehicleAdd.verify.letterA11y', { letter: parts.letter }) : t('vehicleAdd.verify.letterEmpty')}
          style={{ width: 72, backgroundColor: Palette.primarySoft, alignItems: 'center', justifyContent: 'center' }}
        >
          <HText style={{ fontFamily: HomeFonts.arabic.bold, fontSize: 30, lineHeight: 44 }} color={parts.letter ? Brand.graphite : Palette.textMuted}>
            {parts.letter ? (parts.letter === 'ه' ? 'هـ' : parts.letter) : 'ب'}
          </HText>
        </Pressable>
        <View style={{ width: 3, backgroundColor: Brand.graphite }} />
        <TextInput
          value={parts.region}
          onChangeText={(region) => onChange({ ...parts, region: region.replace(/\D/g, '').slice(0, 2) })}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="72"
          placeholderTextColor={Palette.textMuted}
          accessibilityLabel={t('vehicleAdd.verify.regionA11y')}
          onSubmitEditing={onSubmit}
          style={[NUMBER_FONT, { width: 72 }]}
        />
      </View></PlateFrame>
      <View style={{ flexDirection: 'row', alignItems: 'center' }} importantForAccessibility="no-hide-descendants">
        {[
          { text: t('vehicleAdd.verify.number'), width: 137 },
          { text: t('vehicleAdd.verify.letter'), width: 72 },
          { text: t('vehicleAdd.verify.region'), width: 75 },
        ].map((item) => (
          <View key={item.text} style={{ width: item.width, alignItems: 'center' }}>
            <MicroLabel size={10} track={0.12} color={label}>
              {item.text}
            </MicroLabel>
          </View>
        ))}
      </View>
      <LetterSheet visible={open} selected={parts.letter} onPick={(letter) => onChange({ ...parts, letter })} onClose={() => setOpen(false)} />
    </View>
  );
}

/** Plaque provisoire « WW » + numéro (pavé numérique). */
export function WwInput({ value, onChange, onSubmit }: { value: string; onChange: (digits: string) => void; onSubmit?: () => void }) {
  const { t } = useLanguage();
  return (
    <View style={{ alignItems: 'center', gap: 10, direction: 'ltr' }}>
      <PlateFrame><View style={[PLATE_BOX, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12 }]}>
        <HText font="display" weight="bold" size={32} color={Brand.orange} style={{ lineHeight: 40 }}>
          WW
        </HText>
        <TextInput
          value={value}
          onChangeText={(digits) => onChange(digits.replace(/\D/g, '').slice(0, 8))}
          keyboardType="number-pad"
          maxLength={8}
          placeholder="123456"
          placeholderTextColor={Palette.textMuted}
          accessibilityLabel={t('vehicleAdd.verify.wwA11y')}
          onSubmitEditing={onSubmit}
          style={[NUMBER_FONT, { width: 170, textAlign: 'left' }]}
        />
      </View></PlateFrame>
      <HText size={12} color={Brand.mutedOnDark}>
        {t('vehicleAdd.verify.wwHint')}
      </HText>
    </View>
  );
}
