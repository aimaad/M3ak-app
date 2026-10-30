import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { DocumentPhotoField } from '@/components/document-photo-field';
import { DocumentPreview } from '@/components/document-preview';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { InfoRow } from '@/components/info-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { useMyAgency } from '@/features/agency/hooks';
import { MAINTENANCE_DOCUMENTS_BUCKET, uploadMaintenanceInvoice } from '@/features/maintenance/api';
import {
  useCompleteMaintenanceItem,
  useMaintenanceItem,
  useStartMaintenanceItem,
} from '@/features/maintenance/hooks';
import { isValidMaintenanceCost } from '@/features/maintenance/validation';
import { useVehicle } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data: item, isLoading, isError } = useMaintenanceItem(id);
  const { data: vehicle } = useVehicle(item?.vehicleId);
  const startItem = useStartMaintenanceItem();
  const completeItem = useCompleteMaintenanceItem();

  const [garage, setGarage] = useState('');
  const [cout, setCout] = useState('');
  const [piecesRemplacees, setPiecesRemplacees] = useState('');
  const [factureLocalUri, setFactureLocalUri] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const costError = cout && !isValidMaintenanceCost(cout) ? t('maintenance.form.errors.invalid_number') : undefined;

  async function handleComplete() {
    if (!item || !agencyQuery.data || costError) return;
    setSubmitError(null);
    try {
      let facturePath = item.facturePath;
      if (factureLocalUri) {
        facturePath = await uploadMaintenanceInvoice(agencyQuery.data.agencyId, item.id, factureLocalUri);
      }
      await completeItem.mutateAsync({
        id: item.id,
        completion: {
          garage: garage.trim() || null,
          cout: cout.trim() ? Number(cout) : null,
          piecesRemplacees: piecesRemplacees.trim() || null,
          facturePath,
        },
      });
    } catch {
      setSubmitError(t('maintenance.completeError'));
    }
  }

  if (isLoading || isError || !item) {
    return (
      <ThemedView className="flex-1">
        <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
          <ScreenHeader title={t('maintenance.detailsTitle')} showBack />
          <View className="flex-1 items-center justify-center px-8">
            {isLoading ? (
              <ActivityIndicator color={M3akPalette.mauve} />
            ) : (
              <ThemedText type="default" themeColor="textSecondary" className="text-center">
                {isError ? t('maintenance.loadError') : t('maintenance.notFound')}
              </ThemedText>
            )}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const isPending = item.statut === 'a_venir' || item.statut === 'due' || item.statut === 'en_retard';
  const isInProgress = item.statut === 'en_cours';
  const isDone = item.statut === 'effectuee';

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="w-full flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t(`maintenance.types.${item.type}`)} showBack />

        <ScrollView contentContainerClassName="gap-6 px-6 pb-10" keyboardShouldPersistTaps="handled">
          <Card padded={false} className="px-4">
            <InfoRow label={t('locations.vehicle')} value={vehicle ? `${vehicle.marque} ${vehicle.modele} · ${vehicle.immatriculation}` : '—'} />
            {item.echeanceDate ? <InfoRow label={t('maintenance.form.echeanceDate')} value={item.echeanceDate} /> : null}
            {item.echeanceKm != null ? (
              <InfoRow label={t('maintenance.form.echeanceKm')} value={`${item.echeanceKm.toLocaleString('fr-FR')} km`} />
            ) : null}
            {item.notes ? <InfoRow label={t('maintenance.form.notes')} value={item.notes} /> : null}
          </Card>

          {isPending ? (
            <Button
              label={t('maintenance.startAction')}
              onPress={() => startItem.mutate(item.id)}
              loading={startItem.isPending}
            />
          ) : null}

          {isInProgress ? (
            <View className="gap-4">
              <ThemedText type="smallBold">{t('maintenance.completeSection')}</ThemedText>
              <TextField label={t('maintenance.fields.garage')} value={garage} onChangeText={setGarage} />
              <TextField
                label={t('maintenance.fields.cout')}
                value={cout}
                onChangeText={setCout}
                keyboardType="decimal-pad"
                error={costError}
              />
              <TextField
                label={t('maintenance.fields.piecesRemplacees')}
                value={piecesRemplacees}
                onChangeText={setPiecesRemplacees}
                multiline
                numberOfLines={3}
                className="min-h-20"
              />
              <DocumentPhotoField
                label={t('maintenance.fields.facture')}
                bucket={MAINTENANCE_DOCUMENTS_BUCKET}
                localUri={factureLocalUri}
                existingPath={item.facturePath ?? undefined}
                onPick={setFactureLocalUri}
              />
              {submitError ? (
                <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                  {submitError}
                </ThemedText>
              ) : null}
              <Button
                label={t('maintenance.completeAction')}
                onPress={handleComplete}
                disabled={completeItem.isPending || !!costError}
                loading={completeItem.isPending}
              />
            </View>
          ) : null}

          {isDone ? (
            <View className="gap-3">
              <ThemedText type="smallBold">{t('maintenance.completeSection')}</ThemedText>
              <Card padded={false} className="px-4">
                {item.dateIntervention ? <InfoRow label={t('maintenance.fields.dateIntervention')} value={item.dateIntervention} /> : null}
                {item.garage ? <InfoRow label={t('maintenance.fields.garage')} value={item.garage} /> : null}
                {item.cout != null ? (
                  <InfoRow label={t('maintenance.fields.cout')} value={`${item.cout.toLocaleString('fr-FR')} MAD`} />
                ) : null}
                {item.piecesRemplacees ? (
                  <InfoRow label={t('maintenance.fields.piecesRemplacees')} value={item.piecesRemplacees} />
                ) : null}
              </Card>
              {item.facturePath ? (
                <DocumentPreview
                  label={t('maintenance.fields.facture')}
                  bucket={MAINTENANCE_DOCUMENTS_BUCKET}
                  path={item.facturePath}
                  emptyLabel={t('maintenance.noFacture')}
                />
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}
