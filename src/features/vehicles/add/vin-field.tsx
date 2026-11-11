import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Brand, HomeFonts, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useLanguage } from '@/i18n/use-language';

import { VinScanner } from './vin-scanner';

/**
 * Saisie facultative du numéro de série (VIN) : 17 caractères en majuscules, sans I, O ni Q, avec la lecture du code-barres. Un VIN enregistré
 * permet ensuite de retrouver le véhicule dans « Vérifier » et d'éviter les doublons.
 */
export function VinField({ value, onChange, dark = false, invalid = false }: { value: string; onChange: (vin: string) => void; dark?: boolean; invalid?: boolean }) {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const border = invalid ? (dark ? Brand.errorOnDark : Palette.error) : dark ? Brand.strokeOnDark : Palette.border;
  return (
    <View style={{ gap: 6 }}>
      <HText weight="semibold" size={dark ? 11 : 12} color={dark ? Brand.mutedOnDark : Palette.textSecondary}>
        {t('vehicleAdd.finalize.vin')}
      </HText>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, borderWidth: 1, borderColor: border, backgroundColor: dark ? Brand.graphite : Palette.surface, paddingStart: 14, paddingEnd: 2 }}>
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={17}
          placeholder={t('vehicleAdd.verify.vinPlaceholder')}
          placeholderTextColor={dark ? Brand.mutedOnDark : Palette.textMuted}
          accessibilityLabel={t('vehicleAdd.finalize.vin')}
          style={{ flex: 1, minWidth: 0, fontFamily: HomeFonts.display.bold, fontSize: 15, letterSpacing: 1, color: dark ? Brand.white : Palette.textPrimary, padding: 0 }}
        />
        <Pressable onPress={() => setScanning(true)} accessibilityRole="button" accessibilityLabel={t('vehicleAdd.verify.vinScan')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="barcode-outline" size={22} color={dark ? Brand.white : Palette.textPrimary} />
        </Pressable>
      </View>
      <HText size={11} color={invalid ? (dark ? Brand.errorOnDark : Palette.error) : dark ? Brand.mutedOnDark : Palette.textSecondary} accessibilityLiveRegion="polite">
        {invalid ? t('vehicleAdd.verify.invalidVin') : t('vehicleAdd.finalize.vinHint')}
      </HText>
      <VinScanner visible={scanning} onClose={() => setScanning(false)} onScanned={onChange} />
    </View>
  );
}
