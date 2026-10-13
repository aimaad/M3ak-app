import { scanInCloud, type CloudErrorCode } from '@/features/ocr/cloud-ocr';
import { recognizeLines } from '@/features/ocr/local-ocr';
import { parseRegistrationText } from '@/features/ocr/registration-parser';

import { FUEL_TYPES, VEHICLE_CATEGORIES, type FuelType, type VehicleCategory } from './types';

export type OcrConfidence = 'high' | 'medium' | 'low';
export type OcrField<T> = { value: T | null; confidence: OcrConfidence };

export type VehicleOcrFields = {
  immatriculation: OcrField<string>;
  vin: OcrField<string>;
  marque: OcrField<string>;
  modele: OcrField<string>;
  finition: OcrField<string>;
  annee: OcrField<number>;
  couleur: OcrField<string>;
  nombrePlaces: OcrField<number>;
  carburant: OcrField<FuelType>;
  categorie: OcrField<VehicleCategory>;
};

/** `ocr_unavailable` : module d'OCR local absent (ex. Expo Go) ; `ocr_failed` : la lecture locale a échoué. */
export type ScanErrorCode = 'ocr_unavailable' | 'ocr_failed';

/** `source` : où la lecture a eu lieu ; `cloudError` : l'analyse cloud demandée a échoué et la lecture a été refaite sur l'appareil. */
export type ScanVehicleDocumentResult =
  | { ok: true; fields: VehicleOcrFields; source: 'device' | 'cloud'; cloudError?: CloudErrorCode; debugLines?: string[] }
  | { ok: false; error: ScanErrorCode; cloudError?: CloudErrorCode };

const EMPTY = { value: null, confidence: 'low' } as const;

function readConfidence(raw: unknown): OcrConfidence {
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'low';
}

function read<T>(raw: unknown, accept: (value: unknown) => T | null): OcrField<T> {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY };
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown };
  const accepted = accept(value);
  return accepted === null ? { ...EMPTY } : { value: accepted, confidence: readConfidence(confidence) };
}

const text = (max: number) => (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
const integer = (min: number, max: number) => (value: unknown) => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): T | null =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/** Normalise une réponse d'analyse cloud (déjà validée côté serveur) : défense en profondeur côté app. */
export function normalizeVehicleFields(raw: unknown): VehicleOcrFields {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    immatriculation: read(s.immatriculation, text(40)),
    vin: read(s.vin, text(40)),
    marque: read(s.marque, text(60)),
    modele: read(s.modele, text(60)),
    finition: read(s.finition, text(60)),
    annee: read(s.annee, integer(1950, new Date().getFullYear() + 1)),
    couleur: read(s.couleur, text(40)),
    nombrePlaces: read(s.nombrePlaces, integer(1, 9)),
    carburant: read(s.carburant, oneOf<FuelType>(FUEL_TYPES)),
    categorie: read(s.categorie, oneOf<VehicleCategory>(VEHICLE_CATEGORIES)),
  };
}

/**
 * Lit la carte grise. Par défaut SUR L'APPAREIL (aucune image envoyée). Avec `useCloud` (clé Gemini de
 * l'entreprise + accord du propriétaire), l'image est d'abord analysée par Gemini ; si cela échoue,
 * on retombe sur la lecture locale — jamais sur un autre service. Le résultat reste à vérifier.
 */
export async function scanVehicleDocument(
  localUri: string,
  options: { useCloud?: boolean } = {}
): Promise<ScanVehicleDocumentResult> {
  let cloudError: CloudErrorCode | undefined;
  if (options.useCloud) {
    const cloud = await scanInCloud('carte_grise', localUri);
    if (cloud.ok) return { ok: true, fields: normalizeVehicleFields(cloud.fields), source: 'cloud' };
    cloudError = cloud.error;
  }

  const recognized = await recognizeLines(localUri);
  if (!recognized.ok) return { ok: false, error: recognized.error, ...(cloudError ? { cloudError } : {}) };
  return {
    ok: true,
    fields: parseRegistrationText(recognized.lines),
    source: 'device',
    ...(cloudError ? { cloudError } : {}),
    ...(__DEV__ ? { debugLines: recognized.lines } : {}),
  };
}
