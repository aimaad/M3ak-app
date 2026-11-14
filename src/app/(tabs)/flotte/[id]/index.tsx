import { useUndo } from '@/components/undo-toast';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { InfoRow } from '@/components/info-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Palette } from '@/constants/theme';
import { HText } from '@/features/dashboard/home-ui';
import { useAllPayments } from '@/features/payments/hooks';
import { canSeePrices, formatDayLabel, occupancyByVehicle } from '@/features/vehicles/fleet-card';
import { lateBadgeText, lateDurationText } from '@/features/vehicles/fleet-card-text';
import { useArchiveVehicle, useReactivateVehicle, useUpdateVehiclePrice, useUpdateVehicleStatus } from '@/features/vehicles/hooks';
import { archiveBlock, blockingCountFromError, isArchiveBlockedError } from '@/features/vehicles/archive-guard';
import { archiveReasonText, ArchiveSection } from '@/features/vehicles/detail/archive-section';
import { calendarDays, cashedLast30, monthlyRevenue, rentalsSinceAdded, revenueLast30, type CalendarTap } from '@/features/vehicles/detail/figures';
import { FourteenDays, KeyFigures } from '@/features/vehicles/detail/figures-view';
import { useVehicleCompliance } from '@/features/compliance/hooks';
import { useVehicleInspections } from '@/features/inspections/hooks';
import { buildDues } from '@/features/vehicles/detail/dues';
import { buildHistory, type HistoryEvent } from '@/features/vehicles/detail/history';
import { DuesSection } from '@/features/vehicles/detail/dues-section';
import { MaintenanceSection } from '@/features/vehicles/detail/maintenance-section';
import { DocumentsRow, HistoryCard, SpecsGrid } from '@/features/vehicles/detail/sections-view';
import { buildSpecs } from '@/features/vehicles/detail/specs';
import { DetailHeader } from '@/features/vehicles/detail/detail-header';
import { displayName } from '@/features/vehicles/detail/names';
import { shareMessage } from '@/features/vehicles/detail/share';
import { MoreMenu, ReasonSheet } from '@/features/vehicles/detail/sheets';
import { StateCardView } from '@/features/vehicles/detail/state-card-view';
import { buildStateCard, statusBadge, type StateAction } from '@/features/vehicles/detail/state-card';
import { useVehicleDetail } from '@/features/vehicles/detail/use-vehicle-detail';
import { parseVehicleSection, useSectionScroll } from '@/features/vehicles/use-section-scroll';
import { availabilityAlertList, availabilityAlerts, isStatusLockedError, statusBlockText, statusChangeBlocked } from '@/features/vehicles/status-guard';
import { useLanguage } from '@/i18n/use-language';

export default function VehicleDetailScreen() {
  const { id, section: sectionParam, edit: editParam } = useLocalSearchParams<{ id: string; section?: string; edit?: string }>();
  const { t, language } = useLanguage();
  // Anciens liens « ?edit=… » : l'édition se fait maintenant dans « Modifier la fiche technique ».
  useEffect(() => {
    if (id && (editParam === 'specs' || editParam === 'documents')) router.replace({ pathname: '/flotte/[id]/modifier', params: editParam === 'documents' ? { id, field: 'carburant' } : { id } });
  }, [id, editParam]);
  const insets = useSafeAreaInsets();
  const { scrollRef, onSectionLayout: onSectionLayoutAuto, onScrollBeginDrag } = useSectionScroll(parseVehicleSection(sectionParam));
  const detail = useVehicleDetail(id);
  const { vehicle, rentals, maintenance: maintenanceItems, customers, role, isManager, item, context, now } = detail;
  const showPrice = canSeePrices(role);
  const updateStatus = useUpdateVehicleStatus();
  const updatePrice = useUpdateVehiclePrice();
  const archiveVehicle = useArchiveVehicle();
  const reactivateVehicle = useReactivateVehicle();
  const { showUndo } = useUndo();
  const paymentsQuery = useAllPayments(showPrice);
  const figures = useMemo(() => {
    if (!vehicle) return null;
    return {
      occupation: occupancyByVehicle(rentals, now).get(vehicle.id) ?? 0,
      rentals: rentalsSinceAdded(rentals),
      revenue: revenueLast30(rentals, now),
      curve: monthlyRevenue(rentals, now),
      cashed: cashedLast30(paymentsQuery.data ?? [], rentals, now),
      cashedKnown: paymentsQuery.data !== undefined,
      days: vehicle.archivedAt ? [] : calendarDays({ vehicle, rentals, maintenance: maintenanceItems, now }),
      dues: buildDues({ vehicle, maintenance: maintenanceItems, now }),
    };
  }, [vehicle, rentals, maintenanceItems, now, paymentsQuery.data]);
  const inspectionsQuery = useVehicleInspections(id);
  const complianceQuery = useVehicleCompliance(id);
  const history = useMemo(
    () => buildHistory({ rentals, inspections: inspectionsQuery.data ?? [], maintenance: maintenanceItems, compliance: complianceQuery.data ?? [], customers, showAmounts: showPrice }),
    [rentals, inspectionsQuery.data, maintenanceItems, complianceQuery.data, customers, showPrice]
  );
  const block = vehicle ? archiveBlock(vehicle, rentals, customers, now) : null;
  const [menuOpen, setMenuOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  // Positions des sections (pour « Voir l'entretien ») : relevées à la mise en page
  const [entretienY, setEntretienY] = useState(0);
  const onSectionLayout = (name: 'photos' | 'documents' | 'entretien') => (event: Parameters<ReturnType<typeof onSectionLayoutAuto>>[0]) => {
    if (name === 'entretien') setEntretienY(event.nativeEvent.layout.y);
    onSectionLayoutAuto(name)(event);
  };

  const name = vehicle ? displayName(vehicle) : '';

  const card = vehicle && item && context
    ? buildStateCard({
        vehicle, item, context, rentals, customers, maintenance: maintenanceItems, role, now,
        day: (key) => formatDayLabel(key, language, 'short', now),
        lateBadge: (late) => lateBadgeText(late, t),
        lateDuration: (late) => lateDurationText(late, t),
      })
    : null;

  function archiveNow() {
    if (!vehicle) return;
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
      onError: (error) => {
        if (!isArchiveBlockedError(error)) return Alert.alert(t('common.appName'), t('vehicle.archiveError'));
        const count = blockingCountFromError(error);
        Alert.alert(t('common.appName'), count === null ? t('vehicleDetail.archive.serverRefusedNoCount') : t(count === 1 ? 'vehicleDetail.archive.serverRefused' : 'vehicleDetail.archive.serverRefusedMany', { count }));
      },
    });
  }

  function handleArchive() {
    if (!vehicle) return;
    if (block) {
      Alert.alert(t('common.appName'), archiveReasonText(block, t, language, now));
      return;
    }
    Alert.alert(t('vehicleDetail.archive.confirmTitle'), t('vehicleDetail.archive.confirmBody'), [
      { text: t('vehicleDetail.archive.cancel'), style: 'cancel' },
      { text: t('vehicleDetail.archive.confirm'), style: 'destructive', onPress: archiveNow },
    ]);
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
        onError: (error) => {
          const message = isStatusLockedError(error) ? t('vehicleDetail.statusBlock.server') : t('vehicleDetail.reason.error');
          if (statut === 'indisponible' && !isStatusLockedError(error)) setStatusError(message);
          else Alert.alert(t('common.appName'), message);
        },
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
      case 'makeAvailable': {
        // Échéances en alerte : jamais bloquant, une simple alerte ; on peut passer outre en confirmant.
        const alerts = vehicle ? availabilityAlerts(vehicle, complianceQuery.data ?? [], maintenanceItems, now) : [];
        if (alerts.length === 0) return setStatus('disponible');
        Alert.alert(t('vehicleDetail.availability.title'), t('vehicleDetail.availability.body', { list: availabilityAlertList(alerts, t) }), [
          { text: t('vehicleDetail.availability.cancel'), style: 'cancel' },
          { text: t('vehicleDetail.availability.confirm'), onPress: () => setStatus('disponible') },
        ]);
        return;
      }
      case 'makeUnavailable':
        // Réservée ou en location : le statut ne se change pas ; on dit chez qui elle est.
        if (block && statusChangeBlocked(vehicle as NonNullable<typeof vehicle>, 'indisponible', block)) {
          Alert.alert(t('vehicleDetail.statusBlock.title'), statusBlockText(block, t, language, now), [{ text: t('vehicleDetail.statusBlock.ok') }]);
          return;
        }
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

  function openEvent(event: HistoryEvent) {
    if (event.kind === 'compliance') return;
    if (event.kind === 'maintenance') router.push({ pathname: '/maintenance/[id]', params: { id: event.maintenanceId } });
    else router.push({ pathname: '/locations/[id]', params: { id: event.rentalId } });
  }

  /** Prix par jour modifié sur place : vrai si c'est enregistré. */
  async function savePrice(prixJour: number): Promise<boolean> {
    if (!vehicle) return false;
    try {
      await updatePrice.mutateAsync({ id: vehicle.id, prixJour });
      return true;
    } catch {
      return false;
    }
  }

  function openCalendarTap(tap: NonNullable<CalendarTap>) {
    if (!vehicle) return;
    if (tap.type === 'rental') router.push({ pathname: '/locations/[id]', params: { id: tap.rentalId } });
    else router.push({ pathname: '/locations/nouveau', params: { vehicleId: vehicle.id, date: tap.day } });
  }

  /** La fiche technique et les documents se modifient dans l'écran « Modifier la fiche technique » (pas d'éditeur sur place). */
  const goEdit = () => vehicle && router.push(`/flotte/${vehicle.id}/modifier`);
  /** Les documents sont en bas de l'écran de modification : on le fait défiler jusqu'au dernier champ juste au-dessus. */
  const goDocuments = () => vehicle && router.push({ pathname: '/flotte/[id]/modifier', params: { id: vehicle.id, field: 'carburant' } });
  const goPhotos = () => vehicle && router.push({ pathname: '/flotte/[id]/photos', params: { id: vehicle.id } });

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
                {isManager ? (
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
            {figures ? (
              <>
                <KeyFigures
                  occupation={figures.occupation}
                  rentals={figures.rentals}
                  money={showPrice ? { revenue: figures.revenue, curve: figures.curve, cashed: figures.cashedKnown ? figures.cashed : null, pricePerDay: vehicle.prixJour, onSavePrice: savePrice } : undefined}
                />
                <FourteenDays days={figures.days} now={now} onTap={openCalendarTap} />
              </>
            ) : null}
            <DuesSection vehicle={vehicle} rows={figures?.dues ?? []} now={now} />
            <SpecsGrid tiles={buildSpecs(vehicle)} description={vehicle.description?.trim() || null} onEdit={goEdit} onTile={goEdit} />
            <HistoryCard events={history.slice(0, 4)} onOpen={openEvent} onSeeAll={() => router.push({ pathname: '/flotte/[id]/historique', params: { id: vehicle.id } })} />
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
                  value={vehicle.prixSemaine != null ? `${vehicle.prixSemaine.toLocaleString('fr-FR')} MAD` : '—'}
                />
                <InfoRow
                  label={t('vehicle.fields.prixMois')}
                  value={vehicle.prixMois != null ? `${vehicle.prixMois.toLocaleString('fr-FR')} MAD` : '—'}
                />
              </Card>
            </View>
            ) : null}

            <View onLayout={onSectionLayout('documents')}>
              <DocumentsRow vehicle={vehicle} onAdd={goDocuments} />
            </View>
            <View onLayout={onSectionLayout('entretien')}>
              <MaintenanceSection vehicle={vehicle} items={maintenanceItems} now={now} showCost={showPrice} />
            </View>

            {isManager && !vehicle.archivedAt ? <ArchiveSection block={block} now={now} onArchive={handleArchive} /> : null}
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
