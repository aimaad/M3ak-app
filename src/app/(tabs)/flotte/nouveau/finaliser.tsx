import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Brand, Palette } from '@/constants/theme';
import { useMyAgency, useMyProfile } from '@/features/agency/hooks';
import { useBranches } from '@/features/branches/hooks';
import { HText } from '@/features/dashboard/home-ui';
import { mergeDocuments } from '@/features/storage/documents';
import { AddHeader, BackButton } from '@/features/vehicles/add/add-ui';
import { setCreatedVehicle } from '@/features/vehicles/add/created';
import { deadlineDocuments, DEADLINE_TYPES, digitsOf, essentialProgress, formatDateInput, isValidDeadline, missingAfterCreate, REMINDER_DAYS, statusForRentable, stepPrice, suggestCategory, type DeadlineType } from '@/features/vehicles/add/finalize';
import { ChoiceChips, EssentialCard, GreenSwitch, KmField, PhotoZone, PriceStepper, ProgressRing } from '@/features/vehicles/add/finalize-parts';
import { findExistingVehicle } from '@/features/vehicles/add/lookup';
import { PlateDisplay } from '@/features/vehicles/add/plate-display';
import { RemoteDuplicateNotice } from '@/features/vehicles/add/remote-duplicate';
import { combineDuplicate } from '@/features/vehicles/add/remote-exists';
import { useRemoteExists } from '@/features/vehicles/add/use-remote-exists';
import { PlateInput, WwInput } from '@/features/vehicles/add/plate-input';
import { formatPlate, joinPlate, joinWw, plateKind, splitPlate, vinKey, type PlateParts } from '@/features/vehicles/add/plate';
import { takeVehicleCreationDraft } from '@/features/vehicles/creation-draft';
import { DuplicateVehicleCard } from '@/features/vehicles/duplicate-vehicle-card';
import { uploadVehicleDocument, uploadVehiclePhoto } from '@/features/vehicles/api';
import { suggestDailyPrice } from '@/features/vehicles/pricing-suggestion';
import { useCreateVehicle, useUpdateVehicleDocuments, useUpdateVehiclePhotos, useVehicles } from '@/features/vehicles/hooks';
import { FUEL_TYPES, VEHICLE_CATEGORIES, VEHICLE_TRANSMISSIONS, type FuelType, type PendingVehicleDocument, type VehicleCategory, type VehicleDocument, type VehiclePhoto, type VehicleTransmission } from '@/features/vehicles/types';
import { duplicateVehicleField, toVehicleInput, type VehicleFormValues } from '@/features/vehicles/validation';
import { useLanguage } from '@/i18n/use-language';

async function pickPhotos(source: 'camera' | 'library', multiple = false): Promise<string[] | 'denied'> {
  const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'denied';
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: multiple });
  return result.canceled ? [] : result.assets.map((asset) => asset.uri);
}

const darkInput = { height: 48, borderRadius: 14, borderWidth: 1, borderColor: Brand.strokeOnDark, backgroundColor: Brand.graphite, paddingHorizontal: 14, color: Brand.white, fontSize: 15, fontWeight: '600' as const };

/**
 * Finaliser : seulement ce qui compte. Mode « carte grise » (le véhicule est lu) ou « à la main » (plaque, marque, modèle à saisir).
 * L'essentiel = prix (propriétaire seulement), kilométrage, photo de face ; seul le prix du propriétaire est obligatoire.
 */
export default function FinaliserVehiculeScreen() {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const netInfo = useNetInfo();
  const offline = netInfo.isConnected === false;
  const [draft] = useState(() => takeVehicleCreationDraft());
  const fromCard = draft?.source === 'scan';

  const agencyQuery = useMyAgency();
  const agencyId = agencyQuery.data?.agencyId;
  const isOwner = agencyQuery.data?.role === 'owner';
  const profileQuery = useMyProfile(agencyId);
  const branches = useBranches(agencyId).data ?? [];
  const canChooseBranch = profileQuery.data?.branchId === null && branches.length > 0;
  const vehiclesQuery = useVehicles();
  const createVehicle = useCreateVehicle();
  const updateDocuments = useUpdateVehicleDocuments();
  const updatePhotos = useUpdateVehiclePhotos();

  // --- saisie
  const initialPlate = draft?.immatriculation ?? '';
  const [wwMode, setWwMode] = useState(() => plateKind(initialPlate) === 'ww');
  const [plateParts, setPlateParts] = useState<PlateParts>(() => splitPlate(initialPlate));
  const [wwDigits, setWwDigits] = useState(() => (plateKind(initialPlate) === 'ww' ? initialPlate.replace(/\D/g, '') : ''));
  const [marque, setMarque] = useState(draft?.marque ?? '');
  const [modele, setModele] = useState(draft?.modele ?? '');
  const [price, setPrice] = useState('');
  const [km, setKm] = useState('');
  const [facePhoto, setFacePhoto] = useState<string | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [category, setCategory] = useState<VehicleCategory | null | undefined>(draft?.categorie);
  const [gearbox, setGearbox] = useState<VehicleTransmission | null>(null);
  const [fuel, setFuel] = useState<FuelType | null>(draft?.carburant ?? null);
  const [deadlines, setDeadlines] = useState<Partial<Record<DeadlineType, string>>>({});
  const [rentable, setRentable] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const plate = fromCard ? (draft?.immatriculation ?? '') : wwMode ? joinWw(wwDigits) : joinPlate(plateParts);
  const vin = draft?.vin ?? '';
  // Catégorie : le choix de l'employé, sinon celle de la carte, sinon une suggestion d'après le genre et le modèle (toujours ajustable).
  const effectiveCategory = category === undefined ? suggestCategory({ genre: draft?.genre, marque, modele }) : category;
  const needsFuel = !fromCard || !draft?.carburant;
  const usual = useMemo(() => suggestDailyPrice(vehiclesQuery.data ?? [], effectiveCategory), [vehiclesQuery.data, effectiveCategory]);
  const progress = essentialProgress({ showPrice: isOwner, price, km, hasPhoto: !!facePhoto });

  // --- doublon : comparaison locale tolérante (véhicules visibles) + contrôle serveur, autre filiale comprise (garde-fou final, quel que soit le chemin)
  const localDuplicate = useMemo(() => (plate ? findExistingVehicle(vehiclesQuery.data ?? [], { plate, vin }) : null), [vehiclesQuery.data, plate, vin]);
  const remote = useRemoteExists(agencyId, plate, vin);
  const duplicate = plate ? combineDuplicate(localDuplicate, remote) : null;

  const deadlineErrors = DEADLINE_TYPES.filter((type) => !!deadlines[type] && !isValidDeadline(deadlines[type] as string));
  const missing = {
    identity: !plate || !marque.trim() || !modele.trim(),
    fuel: needsFuel && !fuel,
    price: isOwner && Number(digitsOf(price)) <= 0,
  };
  const canSubmit = !missing.identity && !missing.fuel && !missing.price && deadlineErrors.length === 0 && !duplicate && !offline && !isSubmitting;

  async function addPhoto(kind: 'face-camera' | 'face-library' | 'more') {
    setPhotoError(false);
    const result = await pickPhotos(kind === 'face-camera' ? 'camera' : 'library', kind === 'more');
    if (result === 'denied') return setPhotoError(true);
    if (result.length === 0) return;
    if (kind === 'more') setExtraPhotos((previous) => [...previous, ...result]);
    else setFacePhoto(result[0]);
  }

  async function handleSubmit() {
    setTouched(true);
    setSubmitError(null);
    if (!canSubmit || !agencyId) return;
    setIsSubmitting(true);
    try {
      const form = {
        marque, modele, immatriculation: formatPlate(plate), vin: vin ? vinKey(vin) : '', finition: draft?.finition ?? '',
        annee: draft?.annee != null ? String(draft.annee) : '', dateMiseEnCirculation: draft?.dateMiseEnCirculation ?? '',
        puissanceFiscale: draft?.puissanceFiscale != null ? String(draft.puissanceFiscale) : '', categorie: effectiveCategory,
        couleur: draft?.couleur ?? '', nombrePlaces: draft?.nombrePlaces != null ? String(draft.nombrePlaces) : '', transmission: gearbox,
        carburant: (fuel ?? draft?.carburant ?? 'essence') as FuelType, kilometrage: digitsOf(km) || '0', niveauCarburant: '',
        // L'employé ne fixe pas le prix : le véhicule est créé à 0 MAD et le propriétaire le complète dans la fiche.
        prixJour: isOwner ? digitsOf(price) : '0', prixSemaine: '', prixMois: '', description: '', statut: statusForRentable(rentable),
      } as VehicleFormValues;
      const input = { ...toVehicleInput(form), ...(canChooseBranch ? { branchId } : {}) };
      const vehicle = await createVehicle.mutateAsync({ agencyId, input });

      // Documents : photos de la carte grise gardées, puis échéances saisies (sans fichier : la date alimente déjà les rappels).
      const pending: PendingVehicleDocument[] = draft?.carteGrisePendingDocuments ?? [];
      let documents: VehicleDocument[] = vehicle.documents;
      try {
        const uploaded = await Promise.all(pending.map((doc) => uploadVehicleDocument(agencyId, vehicle.id, doc.type, doc.localUri, doc.expiresAt)));
        const dated = deadlineDocuments(deadlines);
        if (uploaded.length + dated.length > 0) {
          documents = mergeDocuments(vehicle.documents, [...uploaded, ...dated]);
          await updateDocuments.mutateAsync({ id: vehicle.id, documents });
        }
      } catch {
        // Le véhicule est créé ; l'envoi des documents pourra être refait depuis sa fiche.
      }
      const photoUris = [facePhoto, ...extraPhotos].filter((uri): uri is string => !!uri);
      let photos: VehiclePhoto[] = vehicle.photos;
      let photoSent = false;
      if (photoUris.length > 0) {
        try {
          const uploaded = await Promise.all(photoUris.map((uri) => uploadVehiclePhoto(agencyId, vehicle.id, uri)));
          photos = [...vehicle.photos, ...uploaded];
          await updatePhotos.mutateAsync({ id: vehicle.id, photos });
          photoSent = true;
        } catch {
          // Idem pour les photos.
        }
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      // L'écran « Véhicule ajouté » rappelle ce qui manque (kilométrage, photo, dates, prix pour l'employé).
      setCreatedVehicle({ vehicle: { ...vehicle, documents, photos }, missing: missingAfterCreate({ isOwner, price, km, hasPhoto: photoSent, deadlines }) });
      router.replace('/flotte/nouveau/succes');
    } catch (error) {
      const field = duplicateVehicleField(error);
      setSubmitError(field === 'vin' ? t('vehicle.form.duplicateVinError') : field === 'immatriculation' ? t('vehicle.form.duplicatePlateError') : t('vehicle.form.createError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const highlighted = (key: 'price' | 'km' | 'photo') => progress.next === key;
  const number = (key: 'price' | 'km' | 'photo') => progress.items.findIndex((item) => item.key === key) + 1;
  const done = (key: 'price' | 'km' | 'photo') => !!progress.items.find((item) => item.key === key)?.done;
  const name = `${marque} ${modele}`.trim();
  const checks: { key: 'price' | 'km' | 'photo'; label: string }[] = [...(isOwner ? [{ key: 'price' as const, label: t('vehicleAdd.finalize.checkPrice') }] : []), { key: 'km', label: t('vehicleAdd.finalize.checkKm') }, { key: 'photo', label: t('vehicleAdd.finalize.checkPhoto') }];
  const problem = offline ? t('vehicleAdd.finalize.offline') : duplicate ? t('vehicleAdd.finalize.duplicate') : touched && missing.identity ? t('vehicleAdd.finalize.needPlate') : touched && missing.fuel ? t('vehicleAdd.finalize.needFuel') : touched && missing.price ? t('vehicleAdd.finalize.needPrice') : submitError;

  return (
    <ThemedView className="flex-1" style={{ backgroundColor: Palette.surface }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}>
          <AddHeader radius={36} photo gap={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <BackButton onPress={() => (fromCard ? router.replace('/flotte/nouveau/carte-lue') : router.back())} />
              <ProgressRing done={progress.done} total={progress.total} />
            </View>
            <View style={{ height: fromCard ? 70 : 20 }} />

            {fromCard ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark, borderRadius: 20, padding: 14 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <HText font="display" weight="bold" size={20} color={Brand.white} numberOfLines={2} style={{ lineHeight: 25 }}>
                    {name}
                  </HText>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <PlateDisplay plate={plate} size={13} />
                    <HText size={12} color={Brand.mutedOnDark}>
                      {[fuel ? t(`vehicle.fuel.${fuel}`) : '', draft?.annee ?? ''].filter(Boolean).join(' · ')}
                    </HText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="checkmark" size={12} color={Brand.successOnDark} />
                    <HText weight="semibold" size={11} color={Brand.successOnDark}>
                      {t('vehicleAdd.finalize.fromCard')}
                    </HText>
                  </View>
                </View>
                <Pressable onPress={() => router.replace('/flotte/nouveau/carte-lue')} accessibilityRole="button" style={{ minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: Brand.strokeOnDark, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <HText weight="semibold" size={12} color={Brand.white}>
                    {t('vehicleAdd.finalize.modify')}
                  </HText>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 12, backgroundColor: Brand.surfaceOnDark, borderWidth: 1, borderColor: Brand.strokeOnDark, borderRadius: 20, padding: 14 }}>
                <HText font="display" weight="bold" size={18} color={Brand.white} accessibilityRole="header">
                  {t('vehicleAdd.finalize.whichVehicle')}
                </HText>
                {wwMode ? <WwInput value={wwDigits} onChange={setWwDigits} /> : <PlateInput parts={plateParts} onChange={setPlateParts} />}
                <Pressable onPress={() => setWwMode((on) => !on)} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
                  <HText weight="semibold" size={12} color={Brand.orangeLight}>
                    {wwMode ? t('vehicleAdd.finalize.plateSwitch') : t('vehicleAdd.finalize.wwSwitch')}
                  </HText>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {[
                    { label: t('vehicleAdd.finalize.brand'), value: marque, set: setMarque, placeholder: t('vehicleAdd.finalize.brandPlaceholder') },
                    { label: t('vehicleAdd.finalize.model'), value: modele, set: setModele, placeholder: t('vehicleAdd.finalize.modelPlaceholder') },
                  ].map((entry) => (
                    <View key={entry.label} style={{ flex: 1, gap: 6, minWidth: 0 }}>
                      <HText weight="semibold" size={11} color={Brand.mutedOnDark}>
                        {entry.label}
                      </HText>
                      <TextInput value={entry.value} onChangeText={entry.set} placeholder={entry.placeholder} placeholderTextColor={Brand.mutedOnDark} accessibilityLabel={entry.label} autoCorrect={false} style={darkInput} />
                    </View>
                  ))}
                </View>
              </View>
            )}
          </AddHeader>

          <View style={{ paddingTop: 22, paddingHorizontal: 20, gap: 14 }}>
            {duplicate?.kind === 'visible' ? <DuplicateVehicleCard duplicate={{ field: duplicate.field, vehicle: duplicate.vehicle }} /> : null}
            {duplicate?.kind === 'elsewhere' ? <RemoteDuplicateNotice branchName={duplicate.branchName} /> : null}

            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <HText font="display" weight="bold" size={20} accessibilityRole="header">
                {t('vehicleAdd.finalize.essential')}
              </HText>
              <HText size={12} color={Palette.textSecondary}>
                {progress.total === 1 ? t('vehicleAdd.finalize.essentialSubOne') : t('vehicleAdd.finalize.essentialSub', { n: progress.total })}
              </HText>
            </View>

            {isOwner ? (
              <EssentialCard number={number('price')} title={t('vehicleAdd.finalize.price')} note={t('vehicleAdd.finalize.ownerOnly')} done={done('price')} highlighted={highlighted('price')}>
                <PriceStepper value={price} onChange={setPrice} onMinus={() => setPrice(String(stepPrice(Number(digitsOf(price)), -1)))} onPlus={() => setPrice(String(stepPrice(Number(digitsOf(price)), 1)))} />
                {usual !== null && effectiveCategory ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Ionicons name="trending-up" size={16} color={Brand.orange} />
                    <HText size={12} style={{ flex: 1, lineHeight: 17 }}>
                      {t('vehicleAdd.finalize.usual', { category: t(`vehicle.category.${effectiveCategory}`), price: usual })}
                    </HText>
                    <Pressable onPress={() => setPrice(String(usual))} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                      <View style={{ height: 34, borderRadius: 17, backgroundColor: Brand.graphite, paddingHorizontal: 12, justifyContent: 'center' }}>
                        <HText weight="semibold" size={12} color={Brand.white}>
                          {t('vehicleAdd.finalize.apply')}
                        </HText>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
              </EssentialCard>
            ) : null}

            <EssentialCard number={number('km')} title={t('vehicleAdd.finalize.km')} done={done('km')} highlighted={highlighted('km')}>
              <KmField value={km} onChange={setKm} highlighted={highlighted('km')} />
            </EssentialCard>

            <EssentialCard number={number('photo')} title={t('vehicleAdd.finalize.photo')} note={t('vehicleAdd.finalize.photoShown')} done={done('photo')} highlighted={highlighted('photo')}>
              <PhotoZone uri={facePhoto} extraCount={extraPhotos.length} onTake={() => addPhoto('face-camera')} onGallery={() => addPhoto('face-library')} onMore={() => addPhoto('more')} />
              {photoError ? (
                <HText size={12} color={Palette.error} accessibilityLiveRegion="polite">
                  {t('vehicleAdd.finalize.photoDenied')}
                </HText>
              ) : null}
              {extraPhotos.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  {extraPhotos.map((uri) => (
                    <Image key={uri} source={{ uri }} style={{ width: 48, height: 48, borderRadius: 10 }} />
                  ))}
                </View>
              ) : null}
            </EssentialCard>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10 }}>
              <HText font="display" weight="bold" size={20} accessibilityRole="header">
                {t('vehicleAdd.finalize.features')}
              </HText>
              <HText size={12} color={Palette.textSecondary}>
                {t('vehicleAdd.finalize.featuresSub')}
              </HText>
            </View>
            <View style={{ backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, padding: 16, gap: 16 }}>
              <View style={{ gap: 8 }}>
                <HText weight="semibold" size={12} color={Palette.textSecondary}>
                  {t('vehicleAdd.finalize.category')}
                </HText>
                <ChoiceChips options={VEHICLE_CATEGORIES} selected={effectiveCategory} getLabel={(c) => t(`vehicle.category.${c}`)} onSelect={setCategory} />
              </View>
              <View style={{ gap: 8 }}>
                <HText weight="semibold" size={12} color={Palette.textSecondary}>
                  {t('vehicleAdd.finalize.gearbox')}
                </HText>
                <ChoiceChips options={VEHICLE_TRANSMISSIONS} selected={gearbox} getLabel={(g) => t(`vehicle.transmission.${g}`)} onSelect={setGearbox} />
              </View>
              {needsFuel ? (
                <View style={{ gap: 8 }}>
                  <HText weight="semibold" size={12} color={touched && missing.fuel ? Palette.error : Palette.textSecondary}>
                    {touched && missing.fuel ? t('vehicleAdd.finalize.fuelRequired') : t('vehicleAdd.finalize.fuel')}
                  </HText>
                  <ChoiceChips options={FUEL_TYPES} selected={fuel} getLabel={(f) => t(`vehicle.fuel.${f}`)} onSelect={setFuel} />
                </View>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10 }}>
              <HText font="display" weight="bold" size={20} accessibilityRole="header">
                {t('vehicleAdd.finalize.deadlines')}
              </HText>
              <HText size={12} color={Palette.textSecondary}>
                {t('vehicleAdd.finalize.optional')}
              </HText>
            </View>
            <View style={{ backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 6 }}>
              {DEADLINE_TYPES.map((type, index) => {
                const invalid = deadlineErrors.includes(type);
                return (
                  <View key={type} style={{ paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: Palette.surfaceAlt, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={type === 'assurance' ? 'shield-checkmark-outline' : 'calendar-outline'} size={18} color={Palette.textPrimary} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <HText weight="semibold" size={14}>
                          {t(`vehicleAdd.finalize.${type}`)}
                        </HText>
                        <HText size={11} color={Palette.textSecondary}>
                          {t('vehicleAdd.finalize.reminder', { days: REMINDER_DAYS })}
                        </HText>
                      </View>
                      <TextInput
                        value={deadlines[type] ?? ''}
                        onChangeText={(text) => setDeadlines((previous) => ({ ...previous, [type]: formatDateInput(text) }))}
                        keyboardType="number-pad"
                        maxLength={10}
                        placeholder={t('vehicleAdd.finalize.deadlineDate')}
                        placeholderTextColor={Palette.textMuted}
                        accessibilityLabel={`${t(`vehicleAdd.finalize.${type}`)} · ${t('vehicleAdd.finalize.deadlineDate')}`}
                        style={{ width: 116, height: 44, borderRadius: 12, borderWidth: 1, borderColor: invalid ? Palette.error : Palette.border, backgroundColor: Palette.surface, paddingHorizontal: 10, fontSize: 13, fontWeight: '600', color: Palette.textPrimary, textAlign: 'center' }}
                      />
                    </View>
                    {invalid ? (
                      <HText size={12} color={Palette.error} accessibilityLiveRegion="polite">
                        {t('vehicleAdd.finalize.deadlineInvalid')}
                      </HText>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {canChooseBranch ? (
              <View style={{ backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 20, padding: 14, gap: 8 }}>
                <HText weight="semibold" size={14}>
                  {t('vehicleAdd.finalize.branch')}
                </HText>
                <ChoiceChips options={['', ...branches.map((branch) => branch.id)]} selected={branchId ?? ''} getLabel={(id) => (id === '' ? t('vehicle.fields.allBranches') : (branches.find((branch) => branch.id === id)?.nom ?? ''))} onSelect={(id) => setBranchId(id === '' ? null : id)} />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Palette.card, borderWidth: 1, borderColor: Palette.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <HText weight="semibold" size={14}>
                  {t('vehicleAdd.finalize.rentable')}
                </HText>
                <HText size={12} color={Palette.textSecondary}>
                  {rentable ? t('vehicleAdd.finalize.rentableOn') : t('vehicleAdd.finalize.rentableOff')}
                </HText>
              </View>
              <GreenSwitch value={rentable} onChange={setRentable} label={t('vehicleAdd.finalize.rentable')} />
            </View>
          </View>
        </ScrollView>

        <View style={{ position: 'absolute', start: 0, end: 0, bottom: 0, paddingTop: 14, paddingHorizontal: 20, paddingBottom: insets.bottom + 14, backgroundColor: Palette.card, borderTopWidth: 1, borderTopColor: Palette.border, gap: 10, shadowColor: Palette.shadow, shadowOpacity: 0.06, shadowRadius: 15, shadowOffset: { width: 0, height: -10 } }}>
          {problem ? (
            <HText size={12} color={Palette.error} accessibilityLiveRegion="polite">
              {problem}
            </HText>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {checks.map((check) => {
                const ok = done(check.key);
                return (
                  <View key={check.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ok ? Palette.success : 'transparent', borderWidth: ok ? 0 : 1.5, borderColor: Palette.textMuted }} />
                    <HText weight="semibold" size={12} color={ok ? Palette.success : Palette.textSecondary}>
                      {check.label}
                    </HText>
                  </View>
                );
              })}
            </View>
          )}
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            style={{ height: 54, borderRadius: 27, backgroundColor: canSubmit ? Brand.orange : Palette.textSecondary, alignItems: 'center', justifyContent: 'center', ...(canSubmit ? { shadowColor: Brand.orange, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 8 } } : {}) }}
          >
            <HText weight="semibold" size={15} color={Brand.white}>
              {isSubmitting ? t('vehicleAdd.finalize.adding') : t('vehicleAdd.finalize.add')}
            </HText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}
