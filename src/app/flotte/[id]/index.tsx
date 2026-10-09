import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentPreview } from '@/components/document-preview';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { findDocument } from '@/features/storage/documents';
import { VEHICLE_DOCUMENTS_BUCKET } from '@/features/vehicles/api';
import { useVehicle } from '@/features/vehicles/hooks';
import { VEHICLE_DOCUMENT_TYPES } from '@/features/vehicles/types';
import { VehicleStatusBadge } from '@/features/vehicles/vehicle-status-badge';
import { useLanguage } from '@/i18n/use-language';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#e1e5f0] py-3">
      <ThemedText type="default" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const { data: vehicle, isLoading } = useVehicle(id);

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader
          title={vehicle ? `${vehicle.marque} ${vehicle.modele}` : t('vehicle.detailsTitle')}
          showBack
          right={
            vehicle ? (
              <Pressable onPress={() => router.push(`/flotte/${vehicle.id}/modifier`)} hitSlop={8}>
                <ThemedText type="small" themeColor="primary">
                  {t('vehicle.edit')}
                </ThemedText>
              </Pressable>
            ) : undefined
          }
        />

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#1f5eff" />
          </View>
        ) : !vehicle ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('vehicle.notFound')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-6 px-6 pb-10">
            <VehicleStatusBadge status={vehicle.statut} />

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.infoSection')}
              </ThemedText>
              <View className="rounded-3xl border border-[#e1e5f0] bg-white px-4">
                <InfoRow label={t('vehicle.fields.immatriculation')} value={vehicle.immatriculation} />
                <InfoRow label={t('vehicle.fields.marque')} value={vehicle.marque} />
                <InfoRow label={t('vehicle.fields.modele')} value={vehicle.modele} />
                <InfoRow label={t('vehicle.fields.annee')} value={vehicle.annee ? String(vehicle.annee) : '—'} />
                <InfoRow label={t('vehicle.fields.carburant')} value={t(`vehicle.fuel.${vehicle.carburant}`)} />
                <InfoRow
                  label={t('vehicle.fields.kilometrage')}
                  value={`${vehicle.kilometrage.toLocaleString('fr-FR')} ${t('flotte.km')}`}
                />
                <View className="flex-row items-center justify-between py-3">
                  <ThemedText type="default" themeColor="textSecondary">
                    {t('vehicle.fields.prixJour')}
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="primary">
                    {`${vehicle.prixJour.toLocaleString('fr-FR')} ${t('flotte.perDay')}`}
                  </ThemedText>
                </View>
              </View>
            </View>

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.historySection')}
              </ThemedText>
              <View className="rounded-3xl border border-dashed border-[#e1e5f0] bg-white p-4">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.historyPlaceholder')}
                </ThemedText>
              </View>
            </View>

            <View className="gap-4">
              <ThemedText type="smallBold">{t('vehicle.documentsSection')}</ThemedText>
              {VEHICLE_DOCUMENT_TYPES.map((type) => (
                <DocumentPreview
                  key={type}
                  label={t(`vehicle.documents.${type}`)}
                  bucket={VEHICLE_DOCUMENTS_BUCKET}
                  path={findDocument(vehicle.documents, type)?.path}
                  emptyLabel={t('vehicle.noDocuments')}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
