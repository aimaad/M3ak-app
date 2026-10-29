import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card, PressableCard } from '@/components/card';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { setVehicleCreationDraft } from '@/features/vehicles/creation-draft';
import { findDuplicateVehicle } from '@/features/vehicles/api';
import type { Vehicle } from '@/features/vehicles/types';
import { useOcrSettings } from '@/features/ocr/hooks';
import { OcrInactiveNotice } from '@/features/ocr/ocr-inactive-notice';
import { useLanguage } from '@/i18n/use-language';

function OptionCard({
  icon,
  title,
  subtitle,
  highlighted,
  disabled,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  highlighted?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <PressableCard
      onPress={disabled ? undefined : onPress}
      className="flex-row items-center gap-3"
      style={[highlighted ? { borderColor: M3akPalette.mauve, borderWidth: 1.5 } : null, disabled ? { opacity: 0.5 } : null]}
    >
      <View
        className="h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: highlighted ? M3akPalette.mauve : M3akPalette.mauveLight }}
      >
        <Ionicons name={icon} size={22} color={highlighted ? '#ffffff' : M3akPalette.mauve} />
      </View>
      <View className="flex-1 gap-0.5">
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8A82A0" />
    </PressableCard>
  );
}

export default function NouveauVehiculeScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { availability } = useOcrSettings();
  const scanActive = availability === 'active';

  const [showPlateForm, setShowPlateForm] = useState(false);
  const [immatriculation, setImmatriculation] = useState('');
  const [vin, setVin] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ field: 'immatriculation' | 'vin'; vehicle: Vehicle } | null>(null);

  function goManual() {
    setVehicleCreationDraft({});
    router.push('/flotte/nouveau/finaliser');
  }

  function goScan() {
    router.push('/flotte/nouveau/scan');
  }

  async function handleContinuePlate() {
    if (!immatriculation.trim() || !agencyQuery.data) return;
    setIsChecking(true);
    setCheckError(null);
    setDuplicate(null);

    try {
      const found = await findDuplicateVehicle(agencyQuery.data.agencyId, immatriculation.trim(), vin.trim() || null);
      if (found) {
        setDuplicate(found);
        return;
      }
      setVehicleCreationDraft({
        immatriculation: immatriculation.trim(),
        vin: vin.trim() || undefined,
      });
      router.push('/flotte/nouveau/finaliser');
    } catch {
      setCheckError(t('vehicle.quickCreate.checkError'));
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.form.newTitle')} subtitle={t('vehicle.quickCreate.subtitle')} showBack />

        <ScrollView contentContainerClassName="gap-3 px-6 pb-10" keyboardShouldPersistTaps="handled">
          <OptionCard
            icon="camera"
            title={t('vehicle.quickCreate.scanTitle')}
            subtitle={t('vehicle.quickCreate.scanSubtitle')}
            highlighted={scanActive}
            disabled={!scanActive}
            onPress={goScan}
          />
          <OcrInactiveNotice availability={availability} />
          <OptionCard
            icon="search"
            title={t('vehicle.quickCreate.plateTitle')}
            subtitle={t('vehicle.quickCreate.plateSubtitle')}
            onPress={() => setShowPlateForm((prev) => !prev)}
          />

          {showPlateForm ? (
            <Card className="gap-3">
              <TextField
                label={t('vehicle.fields.immatriculation')}
                value={immatriculation}
                onChangeText={(v) => {
                  setImmatriculation(v);
                  setDuplicate(null);
                }}
                autoCapitalize="characters"
              />
              <TextField
                label={t('vehicle.fields.vin')}
                value={vin}
                onChangeText={(v) => {
                  setVin(v);
                  setDuplicate(null);
                }}
                autoCapitalize="characters"
                optional
              />

              {duplicate ? (
                <View className="gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: M3akPalette.warningLight }}>
                  <ThemedText type="small" style={{ color: M3akPalette.warning }}>
                    {duplicate.field === 'vin'
                      ? t('vehicle.quickCreate.duplicateVin')
                      : t('vehicle.quickCreate.duplicatePlate')}
                  </ThemedText>
                  <Button
                    label={t('vehicle.quickCreate.viewExisting')}
                    variant="secondary"
                    size="sm"
                    onPress={() => router.push(`/flotte/${duplicate.vehicle.id}`)}
                  />
                </View>
              ) : null}

              {checkError ? (
                <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                  {checkError}
                </ThemedText>
              ) : null}

              <Button
                label={isChecking ? t('vehicle.quickCreate.checking') : t('vehicle.quickCreate.continue')}
                onPress={handleContinuePlate}
                disabled={isChecking || !immatriculation.trim()}
                loading={isChecking}
              />
            </Card>
          ) : null}

          <OptionCard
            icon="create-outline"
            title={t('vehicle.quickCreate.manualTitle')}
            subtitle={t('vehicle.quickCreate.manualSubtitle')}
            onPress={goManual}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
