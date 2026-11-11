import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Brand, Palette } from '@/constants/theme';
import { ArrowIcon, HText, MicroLabel } from '@/features/dashboard/home-ui';
import { OcrInactiveNotice } from '@/features/ocr/ocr-inactive-notice';
import { useOcrSettings } from '@/features/ocr/hooks';
import { AddHeader, BackButton } from '@/features/vehicles/add/add-ui';
import { setVehicleCreationDraft } from '@/features/vehicles/creation-draft';
import { withAlpha } from '@/features/vehicles/fleet-style';
import { useLanguage } from '@/i18n/use-language';

/**
 * Ajouter un véhicule : deux méthodes (scanner la carte grise, saisir à la main) et, à part, l'outil « Vérifier une plaque » qui ne
 * fait que dire si le véhicule est déjà dans la flotte. Une plaque ou un VIN venus de l'outil (`?plate=` / `?vin=`) sont gardés.
 */
export default function ChoixAjoutScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { plate, vin } = useLocalSearchParams<{ plate?: string; vin?: string }>();
  const { availability } = useOcrSettings();
  const scanActive = availability === 'active';

  function goManual() {
    setVehicleCreationDraft({ ...(plate ? { immatriculation: plate } : {}), ...(vin ? { vin } : {}) });
    router.push('/flotte/nouveau/finaliser');
  }

  function goScan() {
    router.push('/flotte/nouveau/scan');
  }

  return (
    <ThemedView className="flex-1" style={{ backgroundColor: Palette.surface }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 }} keyboardShouldPersistTaps="handled">
        <AddHeader photo>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BackButton onPress={() => router.replace('/flotte')} />
          </View>
          <View style={{ gap: 8, paddingEnd: 90 }}>
            <HText font="display" weight="bold" size={30} color={Brand.white} style={{ lineHeight: 33 }} accessibilityRole="header">
              {t('vehicleAdd.choice.title')}
            </HText>
            <HText size={14} color={Brand.mutedOnDark} style={{ lineHeight: 20 }}>
              {t('vehicleAdd.choice.subtitle')}
            </HText>
          </View>

          {/* Méthode recommandée : toute la carte est touchable */}
          <Pressable
            onPress={scanActive ? goScan : undefined}
            disabled={!scanActive}
            accessibilityRole="button"
            accessibilityState={{ disabled: !scanActive }}
            accessibilityLabel={t('vehicleAdd.choice.scanA11y')}
            style={{
              backgroundColor: Brand.surfaceOnDark,
              borderWidth: 1.5,
              borderColor: Brand.orange,
              borderRadius: 24,
              padding: 18,
              gap: 16,
              opacity: scanActive ? 1 : 0.55,
              shadowColor: Brand.orange,
              shadowOpacity: 0.25,
              shadowRadius: 17,
              shadowOffset: { width: 0, height: 14 },
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center', shadowColor: Brand.orange, shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } }}>
                <Ionicons name="scan-outline" size={26} color={Brand.white} />
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <View style={{ backgroundColor: Brand.warningOnDark, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <MicroLabel size={10} track={0.1} color={Brand.graphite}>
                    {t('vehicleAdd.choice.recommended')}
                  </MicroLabel>
                </View>
                <View style={{ backgroundColor: Brand.strokeOnDark, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <MicroLabel size={10} track={0.1} color={Brand.textOnDark}>
                    {t('vehicleAdd.choice.seconds')}
                  </MicroLabel>
                </View>
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <HText font="display" weight="bold" size={20} color={Brand.white}>
                {t('vehicleAdd.choice.scanTitle')}
              </HText>
              <HText size={13} color={Brand.mutedOnDark} style={{ lineHeight: 19 }}>
                {t('vehicleAdd.choice.scanBody')}
              </HText>
            </View>
            <View style={{ height: 48, borderRadius: 24, backgroundColor: Brand.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <HText weight="semibold" size={15} color={Brand.white}>
                {t('vehicleAdd.choice.scanCta')}
              </HText>
              <ArrowIcon color={Brand.white} size={16} />
            </View>
          </Pressable>
          {!scanActive ? <OcrInactiveNotice availability={availability} /> : null}

          <Pressable
            onPress={goManual}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: withAlpha(Brand.surfaceOnDark, 0.6), borderWidth: 1, borderColor: Brand.strokeOnDark, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Brand.borderOnDark, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="create-outline" size={20} color={Brand.white} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <HText weight="semibold" size={15} color={Brand.white}>
                {t('vehicleAdd.choice.manualTitle')}
              </HText>
              <HText size={12} color={Brand.mutedOnDark}>
                {t('vehicleAdd.choice.manualBody')}
              </HText>
            </View>
            <ArrowIcon color={Brand.mutedOnDark} size={18} />
          </Pressable>
        </AddHeader>

        {/* Outil à part : ni carte, ni icône colorée. Il ne ressemble pas à une méthode d'ajout. */}
        <View style={{ paddingTop: 26, paddingHorizontal: 20, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
            <MicroLabel size={11} track={0.16} color={Palette.textSecondary}>
              {t('vehicleAdd.choice.doubt')}
            </MicroLabel>
            <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
          </View>
          <Pressable
            onPress={() => router.push('/flotte/nouveau/verifier')}
            accessibilityRole="button"
            accessibilityLabel={t('vehicleAdd.choice.verifyA11y')}
            style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 28, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, paddingStart: 18, paddingEnd: 8, shadowColor: Palette.shadow, shadowOpacity: 0.05, shadowRadius: 9, shadowOffset: { width: 0, height: 6 } }}
          >
            <Ionicons name="search" size={18} color={Palette.textSecondary} />
            <HText size={14} color={Palette.textSecondary} style={{ flex: 1 }} numberOfLines={1}>
              {t('vehicleAdd.choice.verifyPlaceholder')}
            </HText>
            <View style={{ height: 40, borderRadius: 20, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 12, justifyContent: 'center' }}>
              <HText weight="semibold" size={12}>
                {t('vehicleAdd.choice.verifyButton')}
              </HText>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 6 }}>
            <Ionicons name="information-circle-outline" size={16} color={Palette.textSecondary} style={{ marginTop: 1 }} />
            <HText size={12} color={Palette.textSecondary} style={{ flex: 1, lineHeight: 17 }}>
              {t('vehicleAdd.choice.verifyNote')}
            </HText>
          </View>
        </View>
      </ScrollView>

      <View pointerEvents="none" style={{ position: 'absolute', start: 0, end: 0, bottom: insets.bottom + 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Ionicons name="lock-closed-outline" size={14} color={Palette.textSecondary} />
        <HText size={12} color={Palette.textSecondary}>
          {t('vehicleAdd.choice.privacy')}
        </HText>
      </View>
    </ThemedView>
  );
}
