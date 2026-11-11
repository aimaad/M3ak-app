import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Brand, HomeFonts, Palette } from '@/constants/theme';
import { HText, MicroLabel } from '@/features/dashboard/home-ui';
import { useCustomers } from '@/features/customers/hooks';
import { useMaintenanceItems } from '@/features/maintenance/hooks';
import { useRentals } from '@/features/rentals/hooks';
import { AddHeader, BackButton } from '@/features/vehicles/add/add-ui';
import { FoundCard, NotFoundCard, type FoundInfo } from '@/features/vehicles/add/check-result';
import { findExistingVehicle, rentalCount, type ExistingVehicle } from '@/features/vehicles/add/lookup';
import { PlateInput, WwInput } from '@/features/vehicles/add/plate-input';
import { formatPlate, isValidVin, joinPlate, joinWw, splitPlate, vinKey, type PlateParts } from '@/features/vehicles/add/plate';
import type { RecentCheck } from '@/features/vehicles/add/recent-checks';
import { useRecentChecks } from '@/features/vehicles/add/use-recent-checks';
import { VinScanner } from '@/features/vehicles/add/vin-scanner';
import { contextOf, occupancyByVehicle } from '@/features/vehicles/fleet-card';
import { contextTexts } from '@/features/vehicles/fleet-card-text';
import { buildFleetItems } from '@/features/vehicles/fleet-model';
import { useVehicles } from '@/features/vehicles/hooks';
import { useLanguage } from '@/i18n/use-language';

type Tab = 'plate' | 'ww' | 'vin';
const TABS: Tab[] = ['plate', 'ww', 'vin'];
const EMPTY_PARTS: PlateParts = { number: '', letter: '', region: '' };
const TONE_OF = { free: 'free', rented: 'rented', inspect: 'inspect', maintenance: 'inspect', unavailable: 'unavailable' } as const;

type Outcome = { kind: Tab; query: string; existing: ExistingVehicle | null };

/**
 * Outil « Vérifier une plaque » : dit seulement si un véhicule (plaque marocaine, WW ou VIN) est déjà dans la flotte, archivés compris.
 * Ce n'est PAS une méthode d'ajout : rien n'est créé ni modifié. La recherche compare la plaque normalisée (sans espaces ni tirets).
 */
export default function VerifierPlaqueScreen() {
  const { t, language } = useLanguage();
  const vehiclesQuery = useVehicles();
  const rentalsQuery = useRentals();
  const maintenanceQuery = useMaintenanceItems();
  const customersQuery = useCustomers();
  const { checks, remember } = useRecentChecks();

  const [tab, setTab] = useState<Tab>('plate');
  const [parts, setParts] = useState<PlateParts>(EMPTY_PARTS);
  const [ww, setWw] = useState('');
  const [vin, setVin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [scanning, setScanning] = useState(false);

  const vehicles = vehiclesQuery.data;
  const loadFailed = vehiclesQuery.isError && !vehicles;

  function reset() {
    setOutcome(null);
    setError(null);
  }

  /** Lance la vérification d'une plaque ou d'un VIN déjà écrit sous sa forme complète. */
  function run(kind: Tab, query: string) {
    if (!vehicles) {
      setError(t(vehiclesQuery.isError ? 'vehicleAdd.verify.loadError' : 'vehicleAdd.verify.loading'));
      return;
    }
    const existing = findExistingVehicle(vehicles, kind === 'vin' ? { vin: query } : { plate: query });
    setError(null);
    setOutcome({ kind, query, existing });
    remember({ query, kind, found: !!existing });
  }

  function submit() {
    if (tab === 'plate') {
      const plate = joinPlate(parts);
      if (!plate) return setError(t('vehicleAdd.verify.invalidPlate'));
      run('plate', plate);
    } else if (tab === 'ww') {
      const plate = joinWw(ww);
      if (!plate) return setError(t('vehicleAdd.verify.invalidWw'));
      run('ww', plate);
    } else {
      if (!isValidVin(vin)) return setError(t('vehicleAdd.verify.invalidVin'));
      run('vin', vinKey(vin));
    }
  }

  function relaunch(check: RecentCheck) {
    setTab(check.kind);
    if (check.kind === 'plate') setParts(splitPlate(check.query));
    else if (check.kind === 'ww') setWw(check.query.replace(/\D/g, ''));
    else setVin(check.query);
    run(check.kind, check.query);
  }

  // Détails du véhicule trouvé : statut du jour et ligne de contexte (mêmes calculs que Ma Flotte), ancienneté, locations, occupation.
  const info = useMemo<FoundInfo | null>(() => {
    const found = outcome?.existing;
    if (!found) return null;
    const { vehicle, archived } = found;
    const rentals = rentalsQuery.data ?? [];
    const maintenance = maintenanceQuery.data ?? [];
    const now = new Date();
    const item = archived ? undefined : buildFleetItems({ vehicles: [vehicle], rentals, maintenance, now })[0];
    const context = item
      ? contextOf(item, { customers: new Map((customersQuery.data ?? []).map((c) => [c.id, c])), rentals: new Map(rentals.map((r) => [r.id, r])), maintenance })
      : null;
    return {
      vehicle,
      archived,
      status: item ? { label: t(`flotte.card.status.${item.late ? 'late' : item.section}`), tone: item.late ? 'late' : TONE_OF[item.section] } : null,
      context: item && context ? { text: contextTexts(context, language, t, now).display, late: !!item.late } : null,
      since: Number.isFinite(new Date(vehicle.createdAt).getTime()) ? new Date(vehicle.createdAt).toLocaleDateString(language === 'ar' ? 'ar-MA' : 'fr-FR', { month: 'long', year: 'numeric' }) : '—',
      rentals: rentalCount(rentals, vehicle.id),
      occupancy: item ? item.occupancy : (occupancyByVehicle(rentals, now).get(vehicle.id) ?? 0),
    };
  }, [outcome, rentalsQuery.data, maintenanceQuery.data, customersQuery.data, language, t]);

  const tabStyle = (on: boolean) => ({ flex: 1, height: 38, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: on ? Brand.white : 'transparent' });

  return (
    <ThemedView className="flex-1" style={{ backgroundColor: Palette.surface }}>
      <StatusBar style="light" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <AddHeader radius={36} glow>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <BackButton />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Brand.textOnDark, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Ionicons name="search" size={12} color={Brand.graphite} />
              <MicroLabel size={10} track={0.14} color={Brand.graphite}>
                {t('vehicleAdd.verify.badge')}
              </MicroLabel>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <HText font="display" weight="bold" size={26} color={Brand.white} style={{ lineHeight: 30 }} accessibilityRole="header">
              {t('vehicleAdd.verify.title')}
            </HText>
            <HText size={13} color={Brand.mutedOnDark}>
              {t('vehicleAdd.verify.subtitle')}
            </HText>
          </View>

          <View style={{ flexDirection: 'row', backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark, borderRadius: 16, padding: 4, gap: 4 }}>
            {TABS.map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  setTab(key);
                  reset();
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                style={tabStyle(tab === key)}
              >
                <HText weight="semibold" size={13} color={tab === key ? Brand.graphite : Brand.mutedOnDark}>
                  {t(`vehicleAdd.verify.tabs.${key}`)}
                </HText>
              </Pressable>
            ))}
          </View>

          {tab === 'plate' ? (
            <PlateInput
              parts={parts}
              onChange={(next) => {
                setParts(next);
                reset();
              }}
              onSubmit={submit}
            />
          ) : null}
          {tab === 'ww' ? (
            <WwInput
              value={ww}
              onChange={(digits) => {
                setWw(digits);
                reset();
              }}
              onSubmit={submit}
            />
          ) : null}
          {tab === 'vin' ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.white, borderRadius: 14, borderWidth: 3, borderColor: Brand.orange, paddingStart: 14, paddingEnd: 1 }}>
                <TextInput
                  value={vin}
                  onChangeText={(text) => {
                    setVin(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17));
                    reset();
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={17}
                  placeholder={t('vehicleAdd.verify.vinPlaceholder')}
                  placeholderTextColor={Palette.textMuted}
                  accessibilityLabel={t('vehicleAdd.verify.vinA11y')}
                  returnKeyType="search"
                  onSubmitEditing={submit}
                  style={{ flex: 1, minWidth: 0, height: 58, fontFamily: HomeFonts.display.bold, fontSize: 20, letterSpacing: 1.2, color: Brand.graphite, padding: 0 }}
                />
                <Pressable onPress={() => setScanning(true)} accessibilityRole="button" accessibilityLabel={t('vehicleAdd.verify.vinScan')} style={{ width: 58, height: 58, borderRadius: 12, backgroundColor: Brand.graphite, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="barcode-outline" size={24} color={Brand.white} />
                </Pressable>
              </View>
              <HText size={12} color={Brand.mutedOnDark}>
                {t('vehicleAdd.verify.vinHint')}
              </HText>
            </View>
          ) : null}

          {error ? (
            <HText size={13} weight="semibold" color={Brand.errorOnDark} accessibilityLiveRegion="polite">
              {error}
            </HText>
          ) : null}
          <Pressable
            onPress={submit}
            accessibilityRole="button"
            style={{ height: 54, borderRadius: 27, backgroundColor: Brand.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: Brand.orange, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } }}
          >
            <Ionicons name="search" size={17} color={Brand.white} />
            <HText weight="semibold" size={15} color={Brand.white}>
              {t('vehicleAdd.verify.check')}
            </HText>
          </Pressable>
        </AddHeader>

        <View style={{ padding: 20, gap: 14 }}>
          {loadFailed ? (
            <HText size={13} color={Palette.error}>
              {t('vehicleAdd.verify.loadError')}
            </HText>
          ) : null}
          {outcome && outcome.existing && info ? <FoundCard info={info} onOpen={() => router.push(`/flotte/${outcome.existing?.vehicle.id}`)} /> : null}
          {outcome && !outcome.existing ? (
            <NotFoundCard
              valueText={outcome.kind === 'vin' ? outcome.query : formatPlate(outcome.query)}
              vin={outcome.kind === 'vin'}
              onAdd={() => router.push({ pathname: '/flotte/nouveau', params: outcome.kind === 'vin' ? { vin: outcome.query } : { plate: formatPlate(outcome.query) } })}
            />
          ) : null}

          {checks.length > 0 ? (
            <View style={{ gap: 8 }}>
              <MicroLabel size={11} track={0.16} color={Palette.textSecondary}>
                {t('vehicleAdd.verify.recent')}
              </MicroLabel>
              {checks.map((check) => (
                <Pressable
                  key={`${check.kind}-${check.query}`}
                  onPress={() => relaunch(check)}
                  accessibilityRole="button"
                  accessibilityLabel={t('vehicleAdd.verify.relaunch', { query: check.query })}
                  style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 14 }}
                >
                  <HText weight="bold" size={13} style={{ writingDirection: 'ltr' }}>
                    {check.query}
                  </HText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: check.found ? Brand.graphite : Palette.success }} />
                    <HText weight="semibold" size={12} color={check.found ? Brand.graphite : Palette.success}>
                      {t(check.found ? 'vehicleAdd.verify.inFleet' : 'vehicleAdd.verify.notWithYou')}
                    </HText>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
      <VinScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={(code) => {
          setVin(code);
          reset();
        }}
      />
    </ThemedView>
  );
}
