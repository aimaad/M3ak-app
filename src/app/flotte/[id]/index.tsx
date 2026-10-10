import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentPreview } from '@/components/document-preview';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyAgency } from '@/features/agency/hooks';
import { findDocument } from '@/features/storage/documents';
import { deleteVehiclePhotoFile, VEHICLE_DOCUMENTS_BUCKET } from '@/features/vehicles/api';
import {
  useArchiveVehicle,
  useReactivateVehicle,
  useUpdateVehiclePhotos,
  useVehicle,
} from '@/features/vehicles/hooks';
import { VEHICLE_DOCUMENT_TYPES, type VehiclePhoto } from '@/features/vehicles/types';
import { VehiclePhotoGallery } from '@/features/vehicles/vehicle-photo-gallery';
import { VehicleStatusBadge } from '@/features/vehicles/vehicle-status-badge';
import { useLanguage } from '@/i18n/use-language';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-[#EAE5F2] py-3">
      <ThemedText type="default" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

function isExpiringSoon(expiresAt: string | null, withinDays = 30): boolean {
  if (!expiresAt) return false;
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);
  return new Date(expiresAt).getTime() <= limit.getTime();
}

export default function VehicleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useLanguage();
  const agencyQuery = useMyAgency();
  const { data: vehicle, isLoading, isError } = useVehicle(id);
  const updatePhotos = useUpdateVehiclePhotos();
  const archiveVehicle = useArchiveVehicle();
  const reactivateVehicle = useReactivateVehicle();

  const isManager = agencyQuery.data?.role === 'owner' || agencyQuery.data?.role === 'manager';

  async function handleDeletePhoto(photo: VehiclePhoto) {
    if (!vehicle) return;
    try {
      await deleteVehiclePhotoFile(photo.path);
      await updatePhotos.mutateAsync({
        id: vehicle.id,
        photos: vehicle.photos.filter((p) => p.path !== photo.path),
      });
    } catch {
      Alert.alert(t('common.appName'), t('vehicle.photoDeleteError'));
    }
  }

  function handleArchive() {
    if (!vehicle) return;
    Alert.alert(t('vehicle.archiveConfirmTitle'), t('vehicle.archiveConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vehicle.archive'),
        style: 'destructive',
        onPress: () => {
          archiveVehicle.mutate(vehicle.id, {
            onError: () => Alert.alert(t('common.appName'), t('vehicle.archiveError')),
          });
        },
      },
    ]);
  }

  function handleReactivate() {
    if (!vehicle) return;
    reactivateVehicle.mutate(vehicle.id, {
      onError: () => Alert.alert(t('common.appName'), t('vehicle.archiveError')),
    });
  }

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
            <ActivityIndicator color="#7C3AED" />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary" className="text-center">
              {t('vehicle.loadError')}
            </ThemedText>
          </View>
        ) : !vehicle ? (
          <View className="flex-1 items-center justify-center px-8">
            <ThemedText type="default" themeColor="textSecondary">
              {t('vehicle.notFound')}
            </ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerClassName="gap-6 px-6 pb-10">
            <View className="flex-row items-center gap-2">
              <VehicleStatusBadge status={vehicle.statut} />
              {vehicle.archivedAt ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.archivedBadge')}
                </ThemedText>
              ) : null}
            </View>

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.infoSection')}
              </ThemedText>
              <View className="rounded-3xl border border-[#EAE5F2] bg-white px-4">
                <InfoRow label={t('vehicle.fields.immatriculation')} value={vehicle.immatriculation} />
                <InfoRow label={t('vehicle.fields.marque')} value={vehicle.marque} />
                <InfoRow label={t('vehicle.fields.modele')} value={vehicle.modele} />
                <InfoRow label={t('vehicle.fields.annee')} value={vehicle.annee ? String(vehicle.annee) : '—'} />
                <InfoRow label={t('vehicle.fields.couleur')} value={vehicle.couleur ?? '—'} />
                <InfoRow
                  label={t('vehicle.fields.kilometrage')}
                  value={`${vehicle.kilometrage.toLocaleString('fr-FR')} ${t('flotte.km')}`}
                />
              </View>
            </View>

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.sections.caracteristiques')}
              </ThemedText>
              <View className="rounded-3xl border border-[#EAE5F2] bg-white px-4">
                <InfoRow
                  label={t('vehicle.fields.categorie')}
                  value={vehicle.categorie ? t(`vehicle.category.${vehicle.categorie}`) : '—'}
                />
                <InfoRow
                  label={t('vehicle.fields.transmission')}
                  value={vehicle.transmission ? t(`vehicle.transmission.${vehicle.transmission}`) : '—'}
                />
                <InfoRow label={t('vehicle.fields.carburant')} value={t(`vehicle.fuel.${vehicle.carburant}`)} />
                <InfoRow
                  label={t('vehicle.fields.nombrePlaces')}
                  value={vehicle.nombrePlaces ? String(vehicle.nombrePlaces) : '—'}
                />
                <InfoRow
                  label={t('vehicle.fields.niveauCarburant')}
                  value={vehicle.niveauCarburant !== null ? `${vehicle.niveauCarburant}%` : '—'}
                />
              </View>
            </View>

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.sections.tarification')}
              </ThemedText>
              <View className="rounded-3xl border border-[#EAE5F2] bg-white px-4">
                <View className="flex-row items-center justify-between py-3">
                  <ThemedText type="default" themeColor="textSecondary">
                    {t('vehicle.fields.prixJour')}
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="primary">
                    {`${vehicle.prixJour.toLocaleString('fr-FR')} ${t('flotte.perDay')}`}
                  </ThemedText>
                </View>
                <InfoRow
                  label={t('vehicle.fields.prixSemaine')}
                  value={vehicle.prixSemaine !== null ? `${vehicle.prixSemaine.toLocaleString('fr-FR')} MAD` : '—'}
                />
                <InfoRow
                  label={t('vehicle.fields.prixMois')}
                  value={vehicle.prixMois !== null ? `${vehicle.prixMois.toLocaleString('fr-FR')} MAD` : '—'}
                />
              </View>
            </View>

            {vehicle.description ? (
              <View>
                <ThemedText type="smallBold" className="mb-2">
                  {t('vehicle.fields.description')}
                </ThemedText>
                <View className="rounded-3xl border border-[#EAE5F2] bg-white p-4">
                  <ThemedText type="default">{vehicle.description}</ThemedText>
                </View>
              </View>
            ) : null}

            <View className="gap-3">
              <ThemedText type="smallBold">{t('vehicle.sections.photos')}</ThemedText>
              <VehiclePhotoGallery
                photos={vehicle.photos}
                canDelete={isManager}
                onDelete={handleDeletePhoto}
                emptyLabel={t('vehicle.noPhotos')}
              />
            </View>

            <View className="gap-4">
              <ThemedText type="smallBold">{t('vehicle.documentsSection')}</ThemedText>
              {VEHICLE_DOCUMENT_TYPES.map((type) => {
                const doc = findDocument(vehicle.documents, type);
                return (
                  <View key={type} className="gap-1">
                    <DocumentPreview
                      label={t(`vehicle.documents.${type}`)}
                      bucket={VEHICLE_DOCUMENTS_BUCKET}
                      path={doc?.path}
                      emptyLabel={t('vehicle.noDocuments')}
                    />
                    {doc?.expiresAt ? (
                      <ThemedText
                        type="small"
                        style={{ color: isExpiringSoon(doc.expiresAt) ? '#DC2626' : '#81778F' }}
                      >
                        {t('vehicle.documentExpiry', {
                          date: new Date(doc.expiresAt).toLocaleDateString('fr-FR'),
                        })}
                      </ThemedText>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.historySection')}
              </ThemedText>
              <View className="gap-1 rounded-3xl border border-dashed border-[#EAE5F2] bg-white p-4">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.historyPlaceholder')}
                </ThemedText>
              </View>
            </View>

            {isManager ? (
              <Pressable
                onPress={vehicle.archivedAt ? handleReactivate : handleArchive}
                className="items-center rounded-2xl border border-[#EAE5F2] bg-white px-4 py-4"
              >
                <ThemedText type="smallBold" themeColor={vehicle.archivedAt ? 'primary' : undefined}>
                  {vehicle.archivedAt ? t('vehicle.reactivate') : t('vehicle.archive')}
                </ThemedText>
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}
