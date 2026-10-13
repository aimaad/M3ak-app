import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ChipGroup } from '@/components/chip-group';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { DEFAULT_DEPARTURE_POLICY, type DeparturePolicy } from '@/features/rentals/departure-check';
import { useDeparturePolicy, useSaveDeparturePolicy } from '@/features/rentals/hooks';
import { useLanguage } from '@/i18n/use-language';

type BooleanKey =
  | 'blockDeparture'
  | 'requireCustomerIdDocument'
  | 'requireDriverLicence'
  | 'requireLicenceValidUntilEnd'
  | 'requireManualConfirmation';

const TOGGLES: BooleanKey[] = [
  'requireDriverLicence',
  'requireLicenceValidUntilEnd',
  'requireCustomerIdDocument',
  'requireManualConfirmation',
];

function Toggle({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (next: boolean) => void }) {
  const { t } = useLanguage();
  return (
    <Pressable onPress={() => onChange(!value)} className="flex-row items-center justify-between gap-3 py-2">
      <View className="flex-1 gap-0.5">
        <ThemedText type="smallBold">{label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      </View>
      <View className={`rounded-full px-3 py-1 ${value ? 'bg-[#7C3AED]' : 'bg-[#EAE5F2]'}`}>
        <ThemedText type="small" style={{ color: value ? '#ffffff' : '#81778F' }}>
          {value ? t('common.yes') : t('common.no')}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * Politique de départ : exigences de l'agence avant la remise d'un véhicule. Les valeurs proposées sont
 * des modèles d'exigences MÉTIER — l'application n'affirme aucune règle juridique : à faire valider.
 */
export default function PolitiqueDepartScreen() {
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const policyQuery = useDeparturePolicy(agencyId);
  const save = useSaveDeparturePolicy(agencyId);
  // Modifications en cours ; tant qu'il n'y en a pas, on affiche la politique enregistrée (ou les valeurs par défaut).
  const [edits, setEdits] = useState<DeparturePolicy | null>(null);
  const [saved, setSaved] = useState(false);
  const policy = edits ?? policyQuery.data ?? DEFAULT_DEPARTURE_POLICY;

  if (agencyQuery.data && agencyQuery.data.role !== 'owner') {
    return <Redirect href="/entreprise" />;
  }

  function update<K extends keyof DeparturePolicy>(key: K, value: DeparturePolicy[K]) {
    setSaved(false);
    setEdits({ ...policy, [key]: value });
  }

  async function handleSave() {
    try {
      await save.mutateAsync(policy);
      setSaved(true);
    } catch {
      Alert.alert(t('common.appName'), t('entreprise.departurePolicy.saveError'));
    }
  }

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('entreprise.departurePolicy.title')} subtitle={t('entreprise.departurePolicy.subtitle')} showBack />

        {policyQuery.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={M3akPalette.mauve} />
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-4 px-6 pb-10">
            <View className="gap-1 rounded-2xl px-4 py-3" style={{ backgroundColor: M3akPalette.warningLight }}>
              <ThemedText type="smallBold" style={{ color: M3akPalette.warning }}>
                {t('entreprise.departurePolicy.validationTitle')}
              </ThemedText>
              <ThemedText type="small" style={{ color: M3akPalette.warning }}>
                {t('entreprise.departurePolicy.validationBody')}
              </ThemedText>
            </View>

            <Card className="gap-1">
              <Toggle
                label={t('entreprise.departurePolicy.block.label')}
                hint={t('entreprise.departurePolicy.block.hint')}
                value={policy.blockDeparture}
                onChange={(next) => update('blockDeparture', next)}
              />
            </Card>

            <Card className="gap-1">
              <ThemedText type="smallBold">{t('entreprise.departurePolicy.requirements')}</ThemedText>
              {TOGGLES.map((key) => (
                <Toggle
                  key={key}
                  label={t(`entreprise.departurePolicy.${key}.label`)}
                  hint={t(`entreprise.departurePolicy.${key}.hint`)}
                  value={policy[key]}
                  onChange={(next) => update(key, next)}
                />
              ))}
            </Card>

            <Card className="gap-3">
              <ThemedText type="smallBold">{t('entreprise.departurePolicy.confirmationRole.label')}</ThemedText>
              <ChipGroup<'employee' | 'manager'>
                options={['employee', 'manager']}
                selected={policy.confirmationRole}
                getLabel={(role) => t(`entreprise.departurePolicy.confirmationRole.${role}`)}
                onSelect={(role) => update('confirmationRole', role)}
              />
              <TextField
                label={t('entreprise.departurePolicy.maxAdditional')}
                value={String(policy.maxAdditionalDrivers)}
                keyboardType="number-pad"
                onChangeText={(v) => {
                  const parsed = Number(v.replace(/\D/g, ''));
                  update('maxAdditionalDrivers', Math.min(10, Number.isFinite(parsed) ? parsed : 0));
                }}
              />
            </Card>

            {saved ? (
              <ThemedText type="small" style={{ color: M3akPalette.success }}>
                {t('entreprise.departurePolicy.saved')}
              </ThemedText>
            ) : null}

            <Button
              label={save.isPending ? t('entreprise.saving') : t('entreprise.save')}
              onPress={handleSave}
              disabled={save.isPending}
              loading={save.isPending}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
