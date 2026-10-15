import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { useLanguage } from '@/i18n/use-language';

import type { VehicleDuplicate } from './duplicates';
import { useReactivateVehicle } from './hooks';

/**
 * « Ce véhicule est déjà dans votre flotte » : montre le véhicule existant et laisse l'employé décider.
 * Deux véhicules ne peuvent pas avoir la même plaque ou le même numéro de série (le serveur le refuse) :
 * l'employé peut donc ouvrir le véhicule existant, réactiver un véhicule archivé, ou corriger sa saisie
 * (en cas de mauvaise lecture). `onContinue` (facultatif) lui permet de poursuivre pour corriger.
 */
export function DuplicateVehicleCard({ duplicate, onContinue }: { duplicate: VehicleDuplicate; onContinue?: () => void }) {
  const { t } = useLanguage();
  const role = useMyAgency().data?.role;
  const reactivate = useReactivateVehicle();
  const { vehicle } = duplicate;
  const archived = !!vehicle.archivedAt;
  const canReactivate = archived && (role === 'owner' || role === 'manager');

  function open() {
    router.push(`/flotte/${vehicle.id}`);
  }

  function handleReactivate() {
    reactivate.mutate(vehicle.id, {
      onSuccess: open,
      onError: () => Alert.alert(t('common.appName'), t('vehicle.archiveError')),
    });
  }

  return (
    <View className="gap-3 rounded-2xl px-4 py-3" style={{ backgroundColor: M3akPalette.warningLight }}>
      <ThemedText type="smallBold" style={{ color: M3akPalette.warning }}>
        {t('vehicle.duplicate.title')}
      </ThemedText>
      <ThemedText type="small" style={{ color: M3akPalette.warning }}>
        {duplicate.field === 'vin' ? t('vehicle.duplicate.sameVin') : t('vehicle.duplicate.samePlate')}
      </ThemedText>
      <View className="rounded-xl bg-white px-3 py-2">
        <ThemedText type="smallBold">{`${vehicle.marque} ${vehicle.modele}`.trim()}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {vehicle.immatriculation}
        </ThemedText>
        {archived ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('vehicle.duplicate.archivedNote')}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {t('vehicle.duplicate.fixHint')}
      </ThemedText>
      <View className="gap-2">
        <Button label={t('vehicle.duplicate.view')} size="sm" onPress={open} />
        {canReactivate ? (
          <Button
            label={t('vehicle.duplicate.reactivate')}
            variant="secondary"
            size="sm"
            disabled={reactivate.isPending}
            loading={reactivate.isPending}
            onPress={handleReactivate}
          />
        ) : null}
        {onContinue ? <Button label={t('vehicle.duplicate.continueToFix')} variant="secondary" size="sm" onPress={onContinue} /> : null}
      </View>
    </View>
  );
}
