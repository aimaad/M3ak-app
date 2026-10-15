import type { CloudErrorCode } from '@/features/ocr/cloud-ocr';
import { scanCloudCached } from '@/features/ocr/cached-scan';

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

/** Erreurs de l'analyse (voir cloud-ocr.ts) : `ocr_disabled` / `ocr_not_configured` = fonction non active pour l'entreprise. */
export type ScanErrorCode = CloudErrorCode;

export type ScanVehicleDocumentResult =
  | { ok: true; fields: VehicleOcrFields; fromCache?: boolean }
  | { ok: false; error: ScanErrorCode; detail?: string };

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
 * Lit la carte grise par analyse Gemini avec la clé de l'entreprise (fonction `scan-document`). Sans clé ou sans
 * accord du propriétaire, la fonction répond « non active » et rien n'est envoyé à Gemini. Aucun repli
 * automatique : en cas d'échec, l'écran propose la saisie manuelle. Le résultat reste à vérifier.
 */
export async function scanVehicleDocument(localUri: string, options: { agencyId?: string } = {}): Promise<ScanVehicleDocumentResult> {
  const cloud = await scanCloudCached('carte_grise', localUri, options.agencyId);
  if (!cloud.ok) return { ok: false, error: cloud.error, ...(cloud.detail ? { detail: cloud.detail } : {}) };
  return { ok: true, fields: normalizeVehicleFields(cloud.fields), ...(cloud.fromCache ? { fromCache: true } : {}) };
}
