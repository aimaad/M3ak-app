import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ZoomableImage } from '@/components/zoomable-image';
import { KeepPhotoChoice } from '@/components/keep-photo-choice';
import { ChipGroup } from '@/components/chip-group';
import { ScreenHeader } from '@/components/screen-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { M3akPalette } from '@/constants/theme';
import { setVehicleCreationDraft } from '@/features/vehicles/creation-draft';
import { DuplicateVehicleCard } from '@/features/vehicles/duplicate-vehicle-card';
import { findDuplicateInList } from '@/features/vehicles/duplicates';
import { useVehicles } from '@/features/vehicles/hooks';
import { scanErrorMessageKey } from '@/features/ocr/availability';
import { useOcrSettings } from '@/features/ocr/hooks';
import { OcrInactiveNotice } from '@/features/ocr/ocr-inactive-notice';
import {
  checkRegistrationCard,
  emptyVehicleFields,
  faceStatus,
  filledCount,
  mergeVehicleFields,
  scanVehicleDocument,
  yearFromFields,
  type OcrConfidence,
  type ScanErrorCode,
  type VehicleOcrFields,
} from '@/features/vehicles/ocr';
import { fromIsoDate } from '@/features/vehicles/validation';
import { FUEL_TYPES, VEHICLE_CATEGORIES, type FuelType, type PendingVehicleDocument, type VehicleCategory } from '@/features/vehicles/types';
import { useLanguage } from '@/i18n/use-language';

type Status = 'idle' | 'processing' | 'result' | 'error';

type EditableFields = {
  immatriculation: string;
  vin: string;
  marque: string;
  modele: string;
  finition: string;
  annee: string;
  dateMiseEnCirculation: string;
  puissanceFiscale: string;
  couleur: string;
  nombrePlaces: string;
  carburant: FuelType | null;
  categorie: VehicleCategory | null;
};

const EMPTY_EDITABLE: EditableFields = {
  immatriculation: '',
  vin: '',
  marque: '',
  modele: '',
  finition: '',
  annee: '',
  dateMiseEnCirculation: '',
  puissanceFiscale: '',
  couleur: '',
  nombrePlaces: '',
  carburant: null,
  categorie: null,
};

function fieldsToEditable(fields: VehicleOcrFields): EditableFields {
  return {
    immatriculation: fields.immatriculation.value ?? '',
    vin: fields.vin.value ?? '',
    marque: fields.marque.value ?? '',
    modele: fields.modele.value ?? '',
    finition: fields.finition.value ?? '',
    annee: yearFromFields(fields) != null ? String(yearFromFields(fields)) : '',
    dateMiseEnCirculation: fromIsoDate(fields.dateMiseEnCirculation.value),
    puissanceFiscale: fields.puissanceFiscale.value != null ? String(fields.puissanceFiscale.value) : '',
    couleur: fields.couleur.value ?? '',
    nombrePlaces: fields.nombrePlaces.value != null ? String(fields.nombrePlaces.value) : '',
    carburant: fields.carburant.value,
    categorie: fields.categorie.value,
  };
}

async function pickImage(source: 'library' | 'camera'): Promise<string | null> {
  const permission =
    source === 'library'
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result =
    source === 'library'
      ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchCameraAsync({ quality: 0.8 });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

type Face = 'recto' | 'verso';
type ScanItem = { face: Face; uri: string; fields: VehicleOcrFields };

const CONFIDENCE_KEYS = [
  'immatriculation', 'vin', 'marque', 'modele', 'finition', 'annee', 'dateMiseEnCirculation', 'puissanceFiscale', 'couleur', 'nombrePlaces', 'carburant', 'categorie',
] as const;

function confidencesOf(fields: VehicleOcrFields): Partial<Record<keyof EditableFields, OcrConfidence>> {
  return Object.fromEntries(CONFIDENCE_KEYS.map((key) => [key, fields[key].confidence])) as Partial<Record<keyof EditableFields, OcrConfidence>>;
}

/** Photos de la carte grise rangées par face : le recto porte la date de fin de validité (alerte d'expiration), le verso a son propre document. */
function pendingCardDocuments(scans: ScanItem[], expiresAt: string | null): PendingVehicleDocument[] {
  return scans.map((item) =>
    item.face === 'recto'
      ? { type: 'carte_grise', localUri: item.uri, expiresAt }
      : { type: 'carte_grise_verso', localUri: item.uri, expiresAt: null }
  );
}

export default function ScannerCarteGriseScreen() {
  const { t } = useLanguage();
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [errorCode, setErrorCode] = useState<ScanErrorCode | null>(null);
  const [photos, setPhotos] = useState<Record<Face, string | null>>({ recto: null, verso: null });
  const [emptyFaces, setEmptyFaces] = useState<Face[]>([]);
  const [keepPhoto, setKeepPhoto] = useState(true);
  const { availability, agencyId } = useOcrSettings();
  const vehiclesQuery = useVehicles();
  const [fromCache, setFromCache] = useState(false);
  const [duplicateDismissed, setDuplicateDismissed] = useState(false);
  const [confidences, setConfidences] = useState<Partial<Record<keyof EditableFields, OcrConfidence>>>({});
  const [values, setValues] = useState<EditableFields>(EMPTY_EDITABLE);

  const merged = scans.reduce<VehicleOcrFields>((acc, item) => mergeVehicleFields(acc, item.fields), emptyVehicleFields());
  const faces = faceStatus(merged);
  const checks = checkRegistrationCard(merged);

  function update<K extends keyof EditableFields>(key: K, value: EditableFields[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** Choisit la photo d'une face : rien n'est analysé tant que l'employé n'a pas lancé l'analyse. */
  async function choosePhoto(face: Face, source: 'library' | 'camera') {
    const uri = await pickImage(source);
    if (uri) setPhotos((prev) => ({ ...prev, [face]: uri }));
  }

  /** Analyse le recto et le verso en même temps, puis fusionne les deux lectures. */
  async function analyze() {
    const entries = (['recto', 'verso'] as const).flatMap((face) => (photos[face] ? [{ face, uri: photos[face] as string }] : []));
    if (entries.length === 0) return;
    setStatus('processing');
    setErrorCode(null);
    setEmptyFaces([]);
    setFromCache(false);
    setDuplicateDismissed(false);

    const results = await Promise.all(entries.map((entry) => scanVehicleDocument(entry.uri, { agencyId })));
    const nextScans: ScanItem[] = [];
    let firstError: ScanErrorCode | null = null;
    results.forEach((result, index) => {
      if (result.ok) nextScans.push({ ...entries[index], fields: result.fields });
      else firstError ??= result.error;
    });
    if (nextScans.length === 0) {
      setErrorCode(firstError);
      setStatus('error');
      return;
    }

    const after = nextScans.reduce<VehicleOcrFields>((acc, item) => mergeVehicleFields(acc, item.fields), emptyVehicleFields());
    setEmptyFaces(nextScans.filter((item) => filledCount(item.fields) === 0).map((item) => item.face));
    const nextValues = fieldsToEditable(after);
    setValues(nextValues);
    setScans(nextScans);
    setErrorCode(firstError);
    setFromCache(results.every((result) => result.ok && result.fromCache === true));
    setConfidences(confidencesOf(after));
    setStatus('result');
  }

  function restart() {
    setScans([]);
    setStatus('idle');
    setEmptyFaces([]);
    setErrorCode(null);
    setValues(EMPTY_EDITABLE);
  }

  function continueWithDraft(useValues: boolean) {
    const expiresAt = merged.dateFinValidite.value;
    setVehicleCreationDraft({
      immatriculation: useValues && values.immatriculation.trim() ? values.immatriculation.trim() : undefined,
      vin: useValues && values.vin.trim() ? values.vin.trim() : undefined,
      marque: useValues && values.marque.trim() ? values.marque.trim() : undefined,
      modele: useValues && values.modele.trim() ? values.modele.trim() : undefined,
      finition: useValues && values.finition.trim() ? values.finition.trim() : undefined,
      annee: useValues && values.annee.trim() ? Number(values.annee) : undefined,
      dateMiseEnCirculation: useValues && values.dateMiseEnCirculation.trim() ? values.dateMiseEnCirculation.trim() : undefined,
      puissanceFiscale: useValues && values.puissanceFiscale.trim() ? Number(values.puissanceFiscale) : undefined,
      couleur: useValues && values.couleur.trim() ? values.couleur.trim() : undefined,
      nombrePlaces: useValues && values.nombrePlaces.trim() ? Number(values.nombrePlaces) : undefined,
      carburant: useValues ? (values.carburant ?? undefined) : undefined,
      categorie: useValues ? (values.categorie ?? undefined) : undefined,
      carteGrisePendingDocuments: keepPhoto && scans.length > 0 ? pendingCardDocuments(scans, expiresAt) : undefined,
    });
    router.replace('/flotte/nouveau/finaliser');
  }

  const scanDuplicate = findDuplicateInList(vehiclesQuery.data ?? [], { immatriculation: values.immatriculation, vin: values.vin });
  const hasAnyDetectedValue = Object.values(values).some((v) => (typeof v === 'string' ? v.trim() !== '' : v !== null));

  return (
    <ThemedView className="flex-1">
      <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
        <ScreenHeader title={t('vehicle.quickCreate.scanTitle')} showBack />

        <ScrollView contentContainerClassName="gap-4 px-6 pb-10" keyboardShouldPersistTaps="handled">
          {status === 'idle' && availability === 'loading' ? <ActivityIndicator color={M3akPalette.mauve} /> : null}

          {status === 'idle' && availability !== 'loading' && availability !== 'active' ? (
            <Card className="gap-4">
              <OcrInactiveNotice availability={availability} />
              <Button label={t('vehicle.quickCreate.manualTitle')} onPress={() => continueWithDraft(false)} />
            </Card>
          ) : null}

          {status === 'idle' && availability === 'active' ? (
            <Card className="gap-4 py-6">
              <ThemedText type="small" themeColor="textSecondary" className="text-center">
                {t('vehicle.quickCreate.scanHint')}
              </ThemedText>
              {(['recto', 'verso'] as const).map((face) => (
                <View key={face} className="gap-2">
                  <ThemedText type="smallBold">{t(`vehicle.quickCreate.face.${face}`)}</ThemedText>
                  {photos[face] ? (
                    <Image source={{ uri: photos[face] as string }} style={{ width: '100%', height: 150, borderRadius: 16 }} resizeMode="cover" />
                  ) : null}
                  <View className="flex-row gap-2">
                    <Button
                      label={photos[face] ? t('vehicle.quickCreate.photoChange') : t('common.camera')}
                      variant={photos[face] ? 'secondary' : 'primary'}
                      size="sm"
                      onPress={() => choosePhoto(face, 'camera')}
                      style={{ flex: 1 }}
                    />
                    <Button label={t('common.gallery')} variant="secondary" size="sm" onPress={() => choosePhoto(face, 'library')} style={{ flex: 1 }} />
                  </View>
                </View>
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                {!photos.recto && !photos.verso
                  ? t('vehicle.quickCreate.photoMissing')
                  : photos.recto && photos.verso
                    ? ''
                    : t('vehicle.quickCreate.photoOneOnly')}
              </ThemedText>
              <Button label={t('vehicle.quickCreate.analyzeBoth')} disabled={!photos.recto && !photos.verso} onPress={analyze} />
              <View className="w-full gap-3">
                <KeepPhotoChoice value={keepPhoto} onChange={setKeepPhoto} />
                <View className="rounded-2xl bg-[#FAF9FF] px-4 py-3">
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('ocr.privacyCloud')}
                  </ThemedText>
                </View>
              </View>
            </Card>
          ) : null}

          {status === 'result' && scans.length > 0 ? (
            <View className="gap-1">
              <View className="flex-row gap-2" style={{ height: 150 }}>
                {scans.map((item) => (
                  <ZoomableImage key={item.face} uri={item.uri} label={t(`vehicle.quickCreate.face.${item.face}`)} style={{ borderRadius: 16 }} />
                ))}
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {t('common.zoomHint')}
              </ThemedText>
            </View>
          ) : null}

          {status === 'processing' ? (
            <Card className="items-center gap-3 py-8">
              <ActivityIndicator color={M3akPalette.mauve} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('vehicle.quickCreate.analyzingBoth')}
              </ThemedText>
            </Card>
          ) : null}

          {status === 'error' ? (
            <Card className="gap-3">
              <ThemedText type="smallBold">{t(scanErrorMessageKey(errorCode))}</ThemedText>
              <View className="flex-row gap-2">
                <Button
                  label={t('vehicle.quickCreate.retake')}
                  variant="secondary"
                  size="sm"
                  onPress={restart}
                  style={{ flex: 1 }}
                />
                <Button
                  label={t('vehicle.quickCreate.manualTitle')}
                  size="sm"
                  onPress={() => continueWithDraft(false)}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ) : null}

          {status === 'result' ? (
            <View className="gap-4">
              {!hasAnyDetectedValue ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.quickCreate.nothingDetected')}
                </ThemedText>
              ) : (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.quickCreate.reviewHint')}
                </ThemedText>
              )}

              {fromCache ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('ocr.fromCache')}
                </ThemedText>
              ) : null}

              <View className="gap-2 rounded-2xl bg-[#FAF9FF] px-4 py-3">
                <View className="flex-row flex-wrap gap-2">
                  {(['recto', 'verso'] as const).map((face) => (
                    <View key={face} className="flex-row items-center gap-1 rounded-full px-3 py-1" style={{ backgroundColor: faces[face] ? M3akPalette.successLight : M3akPalette.warningLight }}>
                      <ThemedText type="small" style={{ color: faces[face] ? M3akPalette.success : M3akPalette.warning }}>
                        {faces[face] ? '✓ ' : '• '}
                        {t(`vehicle.quickCreate.face.${face}`)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                {scans.length < 2 ? (
                  <ThemedText type="small">{t(scans[0]?.face === 'recto' ? 'vehicle.quickCreate.faceMissingVerso' : 'vehicle.quickCreate.faceMissingRecto')}</ThemedText>
                ) : faces.recto && faces.verso ? (
                  <ThemedText type="small" style={{ color: M3akPalette.success }}>
                    {t('vehicle.quickCreate.bothFaces')}
                  </ThemedText>
                ) : null}
                {emptyFaces.map((face) => (
                  <ThemedText key={face} type="small" style={{ color: M3akPalette.warning }}>
                    {t('vehicle.quickCreate.nothingNewFace', { face: t(`vehicle.quickCreate.face.${face}`) })}
                  </ThemedText>
                ))}
                {errorCode ? (
                  <ThemedText type="small" style={{ color: M3akPalette.danger }}>
                    {t(scanErrorMessageKey(errorCode))}
                  </ThemedText>
                ) : null}
              </View>

              {checks.map((check) => (
                <View key={check.code} className="rounded-2xl px-4 py-3" style={{ backgroundColor: check.severity === 'warning' ? M3akPalette.warningLight : '#EDE9FE' }}>
                  <ThemedText type="small" style={{ color: check.severity === 'warning' ? M3akPalette.warning : '#5B21B6' }}>
                    {t(`vehicle.quickCreate.checks.${check.code}`)}
                  </ThemedText>
                </View>
              ))}

              {scanDuplicate && !duplicateDismissed ? (
                <DuplicateVehicleCard duplicate={scanDuplicate} onContinue={() => setDuplicateDismissed(true)} />
              ) : null}

              <ReviewField
                label={t('vehicle.fields.immatriculation')}
                value={values.immatriculation}
                onChangeText={(v) => update('immatriculation', v)}
                confidence={confidences.immatriculation}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.vin')}
                value={values.vin}
                onChangeText={(v) => update('vin', v)}
                confidence={confidences.vin}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.marque')}
                value={values.marque}
                onChangeText={(v) => update('marque', v)}
                confidence={confidences.marque}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.modele')}
                value={values.modele}
                onChangeText={(v) => update('modele', v)}
                confidence={confidences.modele}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.finition')}
                value={values.finition}
                onChangeText={(v) => update('finition', v)}
                confidence={confidences.finition}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.annee')}
                value={values.annee}
                onChangeText={(v) => update('annee', v)}
                confidence={confidences.annee}
                keyboardType="number-pad"
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.dateMiseEnCirculation')}
                value={values.dateMiseEnCirculation}
                onChangeText={(v) => update('dateMiseEnCirculation', v)}
                confidence={confidences.dateMiseEnCirculation}
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.puissanceFiscale')}
                value={values.puissanceFiscale}
                onChangeText={(v) => update('puissanceFiscale', v)}
                confidence={confidences.puissanceFiscale}
                keyboardType="number-pad"
                t={t}
              />
              <ReviewField
                label={t('vehicle.fields.couleur')}
                value={values.couleur}
                onChangeText={(v) => update('couleur', v)}
                confidence={confidences.couleur}
                t={t}
              />

              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.fields.carburant')}
                  {confidences.carburant === 'medium' ? ` · ${t('vehicle.quickCreate.toVerify')}` : ''}
                </ThemedText>
                <ChipGroup
                  options={FUEL_TYPES}
                  selected={values.carburant}
                  getLabel={(f) => t(`vehicle.fuel.${f}`)}
                  onSelect={(f) => update('carburant', f)}
                />
              </View>

              <View className="gap-1.5">
                <ThemedText type="small" themeColor="textSecondary">
                  {t('vehicle.fields.categorie')}
                  {confidences.categorie === 'medium' ? ` · ${t('vehicle.quickCreate.toVerify')}` : ''}
                </ThemedText>
                <ChipGroup
                  options={VEHICLE_CATEGORIES}
                  selected={values.categorie}
                  getLabel={(c) => t(`vehicle.category.${c}`)}
                  onSelect={(c) => update('categorie', c)}
                />
              </View>

              <RegistrationInfo fields={merged} t={t} />

              <View className="flex-row gap-2">
                <Pressable onPress={restart} className="flex-1 items-center rounded-2xl border border-[#EAE5F2] bg-white px-4 py-3">
                  <ThemedText type="small">{t('vehicle.quickCreate.retake')}</ThemedText>
                </Pressable>
              </View>
              <Button label={t('vehicle.quickCreate.continue')} onPress={() => continueWithDraft(true)} />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Informations lues sur la carte mais qui n'ont pas de champ propre : affichées pour contrôle (non modifiables ici). */
function RegistrationInfo({ fields, t }: { fields: VehicleOcrFields; t: (key: string) => string }) {
  const rows: [string, string | null][] = [
    [t('vehicle.quickCreate.info.proprietaire'), fields.proprietaire.value],
    [t('vehicle.quickCreate.info.usage'), fields.usage.value],
    [t('vehicle.quickCreate.info.finValidite'), fromIsoDate(fields.dateFinValidite.value) || null],
    [t('vehicle.quickCreate.info.immatriculationAnterieure'), fields.immatriculationAnterieure.value],
    [t('vehicle.quickCreate.info.genre'), fields.genre.value],
    [t('vehicle.quickCreate.info.type'), fields.type.value],
    [t('vehicle.quickCreate.info.cylindres'), fields.nombreCylindres.value != null ? String(fields.nombreCylindres.value) : null],
    [t('vehicle.quickCreate.info.ptac'), fields.ptac.value != null ? `${fields.ptac.value} kg` : null],
    [t('vehicle.quickCreate.info.poidsVide'), fields.poidsVide.value != null ? `${fields.poidsVide.value} kg` : null],
  ];
  const shown = rows.filter((row): row is [string, string] => !!row[1]);
  if (shown.length === 0) return null;
  return (
    <Card className="gap-1">
      <ThemedText type="smallBold">{t('vehicle.quickCreate.info.title')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('vehicle.quickCreate.info.help')}
      </ThemedText>
      {shown.map(([label, value]) => (
        <ThemedText key={label} type="small">
          {label} : <ThemedText type="smallBold">{value}</ThemedText>
        </ThemedText>
      ))}
    </Card>
  );
}

function ReviewField({
  label,
  value,
  onChangeText,
  confidence,
  keyboardType,
  t,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  confidence?: OcrConfidence;
  keyboardType?: 'number-pad';
  t: (key: string) => string;
}) {
  if (!value && confidence === undefined) return null;
  return (
    <View className="gap-1">
      <TextField label={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} />
      {confidence === 'medium' ? (
        <ThemedText type="small" style={{ color: M3akPalette.warning }}>
          {t('vehicle.quickCreate.toVerify')}
        </ThemedText>
      ) : null}
    </View>
  );
}
