import type { CloudErrorCode } from '@/features/ocr/cloud-ocr';
import { scanCloudCached } from '@/features/ocr/cached-scan';

import { FUEL_TYPES, VEHICLE_CATEGORIES, type FuelType, type VehicleCategory } from './types';

export type OcrConfidence = 'high' | 'medium' | 'low';
export type OcrField<T> = { value: T | null; confidence: OcrConfidence };

export type VehicleOcrFields = {
  immatriculation: OcrField<string>;
  immatriculationAnterieure: OcrField<string>;
  /** « Première mise en circulation » (AAAA-MM-JJ). */
  dateMiseEnCirculation: OcrField<string>;
  /** « Fin de validité » de la carte grise (AAAA-MM-JJ). */
  dateFinValidite: OcrField<string>;
  usage: OcrField<string>;
  proprietaire: OcrField<string>;
  type: OcrField<string>;
  genre: OcrField<string>;
  nombreCylindres: OcrField<number>;
  puissanceFiscale: OcrField<number>;
  ptac: OcrField<number>;
  poidsVide: OcrField<number>;
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
const isoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
};
const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown): T | null =>
    typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/** « 68013-ب-72 » (tel qu'imprimé) → « 68013 | ب | 72 » (format de l'app). Toute autre forme est laissée telle quelle. */
export function normalizePlate(value: string): string {
  const match = /^\s*(\d{1,6})\s*[-|/\s]\s*([\u0600-\u06FF])\s*[-|/\s]\s*(\d{1,2})\s*$/.exec(value);
  return match ? `${match[1]} | ${match[2]} | ${match[3]}` : value.trim();
}
const normalizePlateField = (field: OcrField<string>): OcrField<string> => (field.value ? { ...field, value: normalizePlate(field.value) } : field);

/** Normalise une réponse d'analyse cloud (déjà validée côté serveur) : défense en profondeur côté app. */
export function normalizeVehicleFields(raw: unknown): VehicleOcrFields {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    immatriculation: normalizePlateField(read(s.immatriculation, text(40))),
    immatriculationAnterieure: read(s.immatriculationAnterieure, text(40)),
    dateMiseEnCirculation: read(s.dateMiseEnCirculation, isoDate),
    dateFinValidite: read(s.dateFinValidite, isoDate),
    usage: read(s.usage, text(80)),
    proprietaire: read(s.proprietaire, text(120)),
    type: read(s.type, text(60)),
    genre: read(s.genre, text(60)),
    nombreCylindres: read(s.nombreCylindres, integer(1, 16)),
    puissanceFiscale: read(s.puissanceFiscale, integer(1, 60)),
    ptac: read(s.ptac, integer(100, 60000)),
    poidsVide: read(s.poidsVide, integer(100, 60000)),
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


const RANK: Record<OcrConfidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * Fusionne la lecture du recto et celle du verso : pour chaque champ on garde la valeur lue, et en cas de désaccord celle
 * dont la confiance est la plus haute (à égalité, la première). Une face ne « vide » jamais une valeur lue sur l'autre.
 */
export function mergeVehicleFields(a: VehicleOcrFields, b: VehicleOcrFields): VehicleOcrFields {
  const out = { ...a } as Record<string, OcrField<unknown>>;
  for (const key of Object.keys(b) as (keyof VehicleOcrFields)[]) {
    const left = a[key] as OcrField<unknown>;
    const right = b[key] as OcrField<unknown>;
    if (right.value === null) continue;
    if (left.value === null || RANK[right.confidence] > RANK[left.confidence]) out[key] = right;
  }
  return out as unknown as VehicleOcrFields;
}

/** Année de la première mise en circulation si l'année n'a pas été lue directement. */
export function yearFromFields(fields: Pick<VehicleOcrFields, 'annee' | 'dateMiseEnCirculation'>): number | null {
  if (fields.annee.value != null) return fields.annee.value;
  const year = Number(fields.dateMiseEnCirculation.value?.slice(0, 4));
  return Number.isInteger(year) && year >= 1950 ? year : null;
}

export type CardCheck = { code: 'usage_not_rental' | 'card_expired' | 'card_expiring' | 'vin_length'; severity: 'warning' | 'info' };

/** Contrôles de bon sens sur la carte lue : jamais bloquants, ils préviennent l'employé. */
export function checkRegistrationCard(fields: VehicleOcrFields, today: Date = new Date()): CardCheck[] {
  const checks: CardCheck[] = [];
  const usage = fields.usage.value?.toLowerCase() ?? '';
  if (usage && !/lou[eé]|location|sans\s+chauffeur|كراء/.test(usage)) checks.push({ code: 'usage_not_rental', severity: 'warning' });

  const end = fields.dateFinValidite.value;
  if (end) {
    const days = Math.floor((new Date(`${end}T00:00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
    if (days < 0) checks.push({ code: 'card_expired', severity: 'warning' });
    else if (days <= 60) checks.push({ code: 'card_expiring', severity: 'info' });
  }

  const vin = fields.vin.value;
  if (vin && vin.length !== 17) checks.push({ code: 'vin_length', severity: 'info' });
  return checks;
}

export type FaceStatus = { recto: boolean; verso: boolean };

/** Quelles faces de la carte grise ont été lues (d'après les informations trouvées) ? Sert à demander l'autre face. */
export function faceStatus(fields: VehicleOcrFields): FaceStatus {
  return {
    recto: fields.immatriculation.value !== null || fields.dateMiseEnCirculation.value !== null || fields.proprietaire.value !== null,
    verso: fields.marque.value !== null || fields.modele.value !== null || fields.vin.value !== null || fields.carburant.value !== null,
  };
}

/** Nombre de champs renseignés : permet de voir qu'une 2e photo n'a rien apporté (même face reprise). */
export function filledCount(fields: VehicleOcrFields): number {
  return (Object.values(fields) as OcrField<unknown>[]).filter((field) => field.value !== null).length;
}

/** Un résultat vide pour partir de zéro. */
export function emptyVehicleFields(): VehicleOcrFields {
  return normalizeVehicleFields({});
}
