import { useUndo } from '@/components/undo-toast';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card, PressableCard } from '@/components/card';
import { DocumentPreview } from '@/components/document-preview';
import { InfoRow } from '@/components/info-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { findDocument } from '@/features/storage/documents';
import { computeExpiryUrgency, type ExpiryUrgency } from '@/lib/expiry';
import { deleteVehiclePhotoFile, VEHICLE_DOCUMENTS_BUCKET } from '@/features/vehicles/api';
import { canSeePrices, formatDayLabel } from '@/features/vehicles/fleet-card';
import { lateBadgeText, lateDurationText } from '@/features/vehicles/fleet-card-text';
import { useArchiveVehicle, useReactivateVehicle, useUpdateVehiclePhotos, useUpdateVehicleStatus } from '@/features/vehicles/hooks';
import { hasActiveRental, isArchiveBlockedError } from '@/features/vehicles/archive-guard';
import { DetailHeader } from '@/features/vehicles/detail/detail-header';
import { displayName } from '@/features/vehicles/detail/names';
import { shareMessage } from '@/features/vehicles/detail/share';
import { MoreMenu, ReasonSheet } from '@/features/vehicles/detail/sheets';
import { StateCardView } from '@/features/vehicles/detail/state-card-view';
import { buildStateCard, statusBadge, type StateAction } from '@/features/vehicles/detail/state-card';
import { useVehicleDetail } from '@/features/vehicles/detail/use-vehicle-detail';
import { VEHICLE_DOCUMENT_TYPES, type VehiclePhoto } from '@/features/vehicles/types';
import { parseVehicleSection, useSectionScroll } from '@/features/vehicles/use-section-scroll';
import { VehiclePhotoGallery } from '@/features/vehicles/vehicle-photo-gallery';
import { useLanguage } from '@/i18n/use-language';

const URGENCY_COLOR: Record<ExpiryUrgency, string> = {
  ok: Palette.textSecondary,
  bientot: Palette.warning,
  expire: Palette.error,
};

export default function VehicleDetailScreen() {
  const { id, section: sectionParam } = useLocalSearchParams<{ id: string; section?: string }>();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { scrollRef, onSectionLayout: onSectionLayoutAuto, onScrollBeginDrag } = useSectionScroll(parseVehicleSection(sectionParam));
  const detail = useVehicleDetail(id);
  const { vehicle, rentals, maintenance: maintenanceItems, customers, role, isManager, item, context, now } = detail;
  const showPrice = canSeePrices(role);
  const updatePhotos = useUpdateVehiclePhotos();
  const updateStatus = useUpdateVehicleStatus();
  const archiveVehicle = useArchiveVehicle();
  const reactivateVehicle = useReactivateVehicle();
  const { showUndo } = useUndo();
  const archiveBlocked = !!vehicle && hasActiveRental(vehicle, rentals);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  // Positions des sections (pour « Voir l'entretien ») : relevées à la mise en page
  const [entretienY, setEntretienY] = useState(0);
  const onSectionLayout = (name: 'photos' | 'documents' | 'entretien') => (event: Parameters<ReturnType<typeof onSectionLayoutAuto>>[0]) => {
    if (name === 'entretien') setEntretienY(event.nativeEvent.layout.y);
    onSectionLayoutAuto(name)(event);
  };

  const totalMaintenanceCost = maintenanceItems.filter((entry) => entry.statut === 'effectuee' && entry.cout != null).reduce((sum, entry) => sum + (entry.cout ?? 0), 0);
  const name = vehicle ? displayName(vehicle) : '';

  const card = vehicle && item && context
    ? buildStateCard({
        vehicle, item, context, rentals, customers, maintenance: maintenanceItems, role, now,
        day: (key) => formatDayLabel(key, language, 'short', now),
        lateBadge: (late) => lateBadgeText(late, t),
        lateDuration: (late) => lateDurationText(late, t),
      })
    : null;

  async function handleDeletePhoto(photo: VehiclePhoto) {
    if (!vehicle) return;
    try {
      await deleteVehiclePhotoFile(photo.path);
      await updatePhotos.mutateAsync({ id: vehicle.id, photos: vehicle.photos.filter((p) => p.path !== photo.path) });
    } catch {
      Alert.alert(t('common.appName'), t('vehicle.photoDeleteError'));
    }
  }

  function handleArchive() {
    if (!vehicle) return;
    if (archiveBlocked) {
      Alert.alert(t('common.appName'), t('vehicle.archiveBlockedActiveRentals'));
      return;
    }
    const vehicleId = vehicle.id;
    // Archive tout de suite (réversible) puis laisse quelques secondes pour annuler.
    archiveVehicle.mutate(vehicleId, {
      onSuccess: () =>
        showUndo({
          message: t('undoToast.vehicleArchived'),
          actionLabel: t('undoToast.undo'),
          onUndo: () => reactivateVehicle.mutateAsync(vehicleId),
          onUndoError: () => Alert.alert(t('common.appName'), t('undoToast.failed')),
        }),
      onError: (error) => Alert.alert(t('common.appName'), t(isArchiveBlockedError(error) ? 'vehicle.archiveBlockedActiveRentals' : 'vehicle.archiveError')),
    });
  }

  function handleReactivate() {
    if (!vehicle) return;
    reactivateVehicle.mutate(vehicle.id, { onError: () => Alert.alert(t('common.appName'), t('vehicle.archiveError')) });
  }

  function setStatus(statut: 'disponible' | 'indisponible', motif?: string) {
    if (!vehicle) return;
    setStatusError(null);
    updateStatus.mutate(
      { id: vehicle.id, statut, motif },
      {
        onSuccess: () => setReasonOpen(false),
        onError: () => (statut === 'indisponible' ? setStatusError(t('vehicleDetail.reason.error')) : Alert.alert(t('common.appName'), t('vehicleDetail.reason.error'))),
      }
    );
  }

  /** Les boutons de la carte d'état : chacun suit l'action choisie par la carte (droits déjà appliqués). */
  function runAction(action: StateAction) {
    switch (action.id) {
      case 'call':
        if (action.phone) void Linking.openURL(`tel:${action.phone.replace(/[^\d+]/g, '')}`).catch(() => action.href && router.push(action.href as never));
        else if (action.href) router.push(action.href as never);
        return;
      case 'seeMaintenance':
        scrollRef.current?.scrollTo({ y: Math.max(0, entretienY - 12), animated: true });
        return;
      case 'makeAvailable':
        setStatus('disponible');
        return;
      case 'makeUnavailable':
        setStatusError(null);
        setReasonOpen(true);
        return;
      default:
        if (action.href) router.push(action.href as never);
    }
  }

  function shareSheet() {
    if (!vehicle) return;
    void Share.share({ message: shareMessage(vehicle, { showPrice, perDay: t('flotte.perDay') }) }).catch(() => undefined);
  }

  const goEdit = () => vehicle && router.push(`/flotte/${vehicle.id}/modifier`);
  const goPhotos = () => vehicle && router.push({ pathname: '/flotte/[id]/modifier', params: { id: vehicle.id, section: 'photos' } });

  return (
    <ThemedView className="flex-1" style={{ backgroundColor: Palette.surface }}>
      <StatusBar style="light" />
      {detail.isLoading ? (
        <View className="flex-1 items-center justify-center" style={{ backgroundColor: Brand.graphite }}>
          <ActivityIndicator color={Brand.orange} />
        </View>
      ) : detail.isError ? (
        <View className="flex-1 items-center justify-center gap-4 px-8" style={{ backgroundColor: Brand.graphite }}>
          <HText color={Brand.textOnDark} style={{ textAlign: 'center' }}>
            {t('vehicleDetail.loadError')}
          </HText>
          <Pressable onPress={detail.refetch} accessibilityRole="button" style={{ minHeight: 48, borderRadius: 24, paddingHorizontal: 22, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
            <HText weight="semibold" color={Brand.white}>
              {t('vehicleDetail.retry')}
            </HText>
          </Pressable>
        </View>
      ) : !vehicle ? (
        <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: Brand.graphite }}>
          <HText color={Brand.textOnDark}>{t('vehicleDetail.notFound')}</HText>
        </View>
      ) : (
        <ScrollView ref={scrollRef} onScrollBeginDrag={onScrollBeginDrag} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <DetailHeader
            vehicle={vehicle}
            badge={item ? statusBadge(item) : null}
            photoCount={vehicle.photos.length}
            onBack={() => (router.canGoBack() ? router.back() : router.replace('/flotte'))}
            onShare={shareSheet}
            onMore={() => setMenuOpen(true)}
            onPhotos={goPhotos}
          >
            {vehicle.archivedAt ? (
              <View style={{ borderRadius: 22, padding: 16, gap: 12, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark }}>
                <HText size={14} color={Brand.textOnDark} style={{ lineHeight: 20 }}>
                  {t('vehicleDetail.archivedBanner')}
                </HText>
                {role === 'owner' ? (
                  <Pressable onPress={handleReactivate} accessibilityRole="button" style={{ minHeight: 52, borderRadius: 26, backgroundColor: Brand.orange, alignItems: 'center', justifyContent: 'center' }}>
                    <HText weight="semibold" color={Brand.white}>
                      {t('vehicleDetail.restore')}
                    </HText>
                  </Pressable>
                ) : null}
              </View>
            ) : card ? (
              <StateCardView card={card} name={name} onAction={runAction} />
            ) : null}
          </DetailHeader>

          <View className="gap-6 px-6 pb-10 pt-6">
            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.infoSection')}
              </ThemedText>
              <Card padded={false} className="px-4">
                <InfoRow label={t('vehicle.fields.immatriculation')} value={vehicle.immatriculation} />
                <InfoRow label={t('vehicle.fields.marque')} value={vehicle.marque} />
                <InfoRow label={t('vehicle.fields.modele')} value={vehicle.modele} />
                <InfoRow label={t('vehicle.fields.annee')} value={vehicle.annee ? String(vehicle.annee) : '—'} />
                <InfoRow label={t('vehicle.fields.couleur')} value={vehicle.couleur ?? '—'} />
                <InfoRow
                  label={t('vehicle.fields.kilometrage')}
                  value={`${vehicle.kilometrage.toLocaleString('fr-FR')} ${t('flotte.km')}`}
                />
              </Card>
            </View>

            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.sections.caracteristiques')}
              </ThemedText>
              <Card padded={false} className="px-4">
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
              </Card>
            </View>

            {showPrice ? (
            <View>
              <ThemedText type="smallBold" className="mb-2">
                {t('vehicle.sections.tarification')}
              </ThemedText>
              <Card padded={false} className="px-4">
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
              </Card>
            </View>
            ) : null}

            {vehicle.description ? (
              <View>
                <ThemedText type="smallBold" className="mb-2">
                  {t('vehicle.fields.description')}
                </ThemedText>
                <Card>
                  <ThemedText type="default">{vehicle.description}</ThemedText>
                </Card>
              </View>
            ) : null}

            <View className="gap-3" onLayout={onSectionLayout('photos')}>
              <ThemedText type="smallBold">{t('vehicle.sections.photos')}</ThemedText>
              <VehiclePhotoGallery
                photos={vehicle.photos}
                canDelete={isManager}
                onDelete={handleDeletePhoto}
                emptyLabel={t('vehicle.noPhotos')}
              />
            </View>

            <View className="gap-4" onLayout={onSectionLayout('documents')}>
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
                        style={{ color: URGENCY_COLOR[computeExpiryUrgency(doc.expiresAt) ?? 'ok'] }}
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

            <View className="gap-2" onLayout={onSectionLayout('entretien')}>
              <ThemedText type="smallBold">{t('maintenance.title')}</ThemedText>
              {totalMaintenanceCost > 0 ? (
                <View className="flex-row items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('maintenance.totalCost')}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ fontSize: 18, lineHeight: 24 }}>
                    {totalMaintenanceCost.toLocaleString('fr-FR')} MAD
                  </ThemedText>
                </View>
              ) : null}
              {maintenanceItems.length === 0 ? (
                <View className="gap-1 rounded-3xl border border-dashed border-border bg-card p-4">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('maintenance.empty')}
                  </ThemedText>
                </View>
              ) : (
                <View className="gap-2">
                  {maintenanceItems.map((item) => (
                    <PressableCard
                      key={item.id}
                      onPress={() => router.push(`/maintenance/${item.id}`)}
                      padded={false}
                      className="flex-row items-center justify-between px-4 py-3"
                    >
                      <View className="flex-1 gap-0.5">
                        <ThemedText type="small">{t(`maintenance.types.${item.type}`)}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {(item.dateIntervention ?? item.echeanceDate)
                            ? new Date((item.dateIntervention ?? item.echeanceDate) as string).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
                            : '—'}
                          {' · '}
                          {item.statut === 'effectuee'
                            ? t('maintenance.done')
                            : item.statut === 'en_cours'
                              ? t('maintenance.status.en_cours')
                              : t(`maintenance.urgency.${item.statut}`)}
                        </ThemedText>
                      </View>
                      <ThemedText type="smallBold">
                        {item.cout != null ? `${item.cout.toLocaleString('fr-FR')} MAD` : '—'}
                      </ThemedText>
                    </PressableCard>
                  ))}
                </View>
              )}
            </View>

            {isManager && !vehicle.archivedAt && archiveBlocked ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('vehicle.archiveBlockedActiveRentals')}
              </ThemedText>
            ) : isManager ? (
              <Button
                label={vehicle.archivedAt ? t('vehicle.reactivate') : t('vehicle.archive')}
                variant={vehicle.archivedAt ? 'secondary' : 'danger'}
                onPress={vehicle.archivedAt ? handleReactivate : handleArchive}
              />
            ) : null}
          </View>
        </ScrollView>
      )}

      <MoreMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { key: 'edit', label: t('vehicleDetail.menu.edit'), onPress: goEdit },
          ...(isManager && vehicle && !vehicle.archivedAt ? [{ key: 'archive', label: t('vehicleDetail.menu.archive'), onPress: handleArchive, danger: true }] : []),
        ]}
      />
      <ReasonSheet visible={reasonOpen} onClose={() => setReasonOpen(false)} onConfirm={(reason) => setStatus('indisponible', reason)} busy={updateStatus.isPending} error={statusError} />
    </ThemedView>
  );
}
