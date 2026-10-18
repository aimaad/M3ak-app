import type { CloudErrorCode } from '@/features/ocr/cloud-ocr';
import { scanCloudCached } from '@/features/ocr/cached-scan';

import { parseCategories, parseDateInput } from './documents';
import type { PendingDocument } from './types';
import type { CustomerFormValues } from './validation';

export type OcrConfidence = 'high' | 'medium' | 'low';
export type OcrField<T> = { value: T | null; confidence: OcrConfidence };

/** Champs lus sur un permis de conduire. Une valeur absente ou illisible reste null : jamais inventée. */
export type LicenceOcrFields = {
  nom: OcrField<string>;
  prenom: OcrField<string>;
  /** Numéro de la carte d'identité nationale (sur le recto du permis marocain). */
  cin: OcrField<string>;
  numeroPermis: OcrField<string>;
  /** Codes de la colonne « Restrictions » (verso), ex. « 01.01 ». */
  restrictions: OcrField<string>;
  dateDelivrance: OcrField<string>;
  dateExpiration: OcrField<string>;
  categories: OcrField<string[]>;
  dateNaissance: OcrField<string>;
  autorite: OcrField<string>;
};

/** Erreurs de l'analyse (voir cloud-ocr.ts) : `ocr_disabled` / `ocr_not_configured` = fonction non active pour l'entreprise. */
export type LicenceScanErrorCode = CloudErrorCode;

export type LicenceScanResult =
  | { ok: true; fields: LicenceOcrFields; fromCache?: boolean }
  | { ok: false; error: LicenceScanErrorCode; detail?: string };

const EMPTY_FIELD = { value: null, confidence: 'low' } as const;
const MAX_TEXT_LENGTH = 120;

function readConfidence(raw: unknown): OcrConfidence {
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'low';
}

function readText(raw: unknown): OcrField<string> {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY_FIELD };
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown };
  if (typeof value !== 'string') return { value: null, confidence: 'low' };
  const text = value.trim().slice(0, MAX_TEXT_LENGTH);
  return text ? { value: text, confidence: readConfidence(confidence) } : { value: null, confidence: 'low' };
}

function readDate(raw: unknown): OcrField<string> {
  const field = readText(raw);
  if (field.value === null) return field;
  const iso = parseDateInput(field.value);
  // Une date illisible n'est jamais devinée : elle redevient « à saisir ».
  return iso ? { value: iso, confidence: field.confidence } : { value: null, confidence: 'low' };
}

function readCategories(raw: unknown): OcrField<string[]> {
  if (typeof raw !== 'object' || raw === null) return { value: null, confidence: 'low' };
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown };
  const list = Array.isArray(value)
    ? parseCategories(value.filter((v): v is string => typeof v === 'string').join(' '))
    : typeof value === 'string'
      ? parseCategories(value)
      : [];
  return list.length > 0 ? { value: list, confidence: readConfidence(confidence) } : { value: null, confidence: 'low' };
}

/** « Royaume du Maroc » est l'en-tête du document, pas le lieu de délivrance : on ne le garde jamais comme autorité. */
function dropCountry(field: OcrField<string>): OcrField<string> {
  return field.value !== null && /^(le\s+)?royaume(\s+du\s+maroc)?$/i.test(field.value.trim()) ? { value: null, confidence: 'low' } : field;
}

/** CIN marocaine : majuscules, sans espaces ; une valeur qui n'a pas la forme « Z188822 » n'est pas gardée. */
function normalizeCin(field: OcrField<string>): OcrField<string> {
  if (field.value === null) return field;
  const cin = field.value.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{1,2}\d{3,8}$/.test(cin) ? { value: cin, confidence: field.confidence } : { value: null, confidence: 'low' };
}

/** Normalise la réponse du serveur (déjà nettoyée une fois) : défense en profondeur côté app. */
export function normalizeLicenceFields(raw: unknown): LicenceOcrFields {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    nom: readText(source.nom),
    prenom: readText(source.prenom),
    cin: normalizeCin(readText(source.cin)),
    numeroPermis: readText(source.numeroPermis),
    restrictions: readText(source.restrictions),
    dateDelivrance: readDate(source.dateDelivrance),
    dateExpiration: readDate(source.dateExpiration),
    categories: readCategories(source.categories),
    dateNaissance: readDate(source.dateNaissance),
    autorite: dropCountry(readText(source.autorite)),
  };
}

export type CustomerFormFieldKey = keyof CustomerFormValues;

/** Brouillon transmis de l'écran de scan au formulaire de création (voir customer-creation-draft). */
export type CustomerCreationDraft = {
  values: Partial<CustomerFormValues>;
  pendingDocuments: PendingDocument[];
  /** Champs à vérifier en priorité (confiance moyenne). */
  uncertainFields: CustomerFormFieldKey[];
  /** Champs du permis (dans le document) à vérifier. */
  uncertainDocumentFields: ('reference' | 'dateDelivrance' | 'expiresAt' | 'categories' | 'issuingAuthority')[];
  /** Vrai si les champs ont été préremplis par une lecture automatique. */
  fromOcr: boolean;
  /** Contrôles de bon sens sur le permis lu (expiré, catégorie B absente…), affichés en haut du formulaire. */
  warnings?: LicenceCheck['code'][];
  /** Vrai si le résultat vient du cache de l'appareil (même photo déjà lue : aucun nouvel envoi). */
  fromCache?: boolean;
};

const RANK: Record<OcrConfidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * Fusionne la lecture du recto et celle du verso : on garde la valeur lue, et en cas de désaccord celle dont la
 * confiance est la plus haute. Les catégories des deux faces s'additionnent. Une face ne vide jamais l'autre.
 */
export function mergeLicenceFields(a: LicenceOcrFields, b: LicenceOcrFields): LicenceOcrFields {
  const out = { ...a } as Record<string, OcrField<unknown>>;
  for (const key of Object.keys(b) as (keyof LicenceOcrFields)[]) {
    const left = a[key] as OcrField<unknown>;
    const right = b[key] as OcrField<unknown>;
    if (right.value === null) continue;
    if (key === 'categories' && left.value !== null) {
      const union = parseCategories([...(left.value as string[]), ...(right.value as string[])].join(' '));
      out[key] = { value: union, confidence: RANK[left.confidence] >= RANK[right.confidence] ? left.confidence : right.confidence };
    } else if (left.value === null || RANK[right.confidence] > RANK[left.confidence]) out[key] = right;
  }
  return out as unknown as LicenceOcrFields;
}

export function emptyLicenceFields(): LicenceOcrFields {
  return normalizeLicenceFields({});
}

export type LicenceFaceStatus = { recto: boolean; verso: boolean };

/** Quelles faces du permis ont été lues (d'après les informations trouvées) ? */
export function licenceFaceStatus(fields: LicenceOcrFields): LicenceFaceStatus {
  return {
    recto: fields.nom.value !== null || fields.prenom.value !== null || fields.numeroPermis.value !== null || fields.dateNaissance.value !== null,
    verso: fields.dateExpiration.value !== null || fields.restrictions.value !== null,
  };
}

export function licenceFilledCount(fields: LicenceOcrFields): number {
  return (Object.values(fields) as OcrField<unknown>[]).filter((field) => field.value !== null).length;
}

export type LicenceCheck = { code: 'licence_expired' | 'licence_expiring' | 'no_category_b'; severity: 'warning' | 'info' };

/** Contrôles de bon sens : jamais bloquants, ils préviennent l'employé (un permis expiré ne doit pas être loué sans le savoir). */
export function checkLicence(fields: LicenceOcrFields, today: Date = new Date()): LicenceCheck[] {
  const checks: LicenceCheck[] = [];
  const end = fields.dateExpiration.value;
  if (end) {
    const days = Math.floor((new Date(`${end}T00:00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
    if (days < 0) checks.push({ code: 'licence_expired', severity: 'warning' });
    else if (days <= 60) checks.push({ code: 'licence_expiring', severity: 'info' });
  }
  const categories = fields.categories.value;
  if (categories && !categories.includes('B')) checks.push({ code: 'no_category_b', severity: 'warning' });
  return checks;
}

export const EMPTY_CREATION_DRAFT: CustomerCreationDraft = {
  values: {},
  pendingDocuments: [],
  uncertainFields: [],
  uncertainDocumentFields: [],
  fromOcr: false,
};

/**
 * Transforme le résultat OCR en brouillon modifiable. Seuls les champs lus avec une confiance
 * suffisante sont préremplis ; les champs « medium » sont signalés à vérifier ; « low » ou
 * absents restent vides — l'employé les saisit.
 */
export function licenceFieldsToDraft(
  fields: LicenceOcrFields,
  localUri: string | null,
  options: { fromCache?: boolean; versoUri?: string | null } = {}
): CustomerCreationDraft {
  const values: Partial<CustomerFormValues> = {};
  const uncertainFields: CustomerFormFieldKey[] = [];
  const uncertainDocumentFields: CustomerCreationDraft['uncertainDocumentFields'] = [];

  function keep<T>(field: OcrField<T>): T | null {
    return field.value !== null && field.confidence !== 'low' ? field.value : null;
  }

  const prenom = keep(fields.prenom);
  const nom = keep(fields.nom);
  if (prenom) values.prenom = prenom;
  if (nom) values.nom = nom;
  if (prenom && fields.prenom.confidence === 'medium') uncertainFields.push('prenom');
  if (nom && fields.nom.confidence === 'medium') uncertainFields.push('nom');

  const cin = keep(fields.cin);
  if (cin) {
    values.cinOuPasseport = cin;
    if (fields.cin.confidence === 'medium') uncertainFields.push('cinOuPasseport');
  }

  const numero = keep(fields.numeroPermis);
  if (numero) {
    values.numeroPermis = numero;
    if (fields.numeroPermis.confidence === 'medium') {
      uncertainFields.push('numeroPermis');
      uncertainDocumentFields.push('reference');
    }
  }

  const naissance = keep(fields.dateNaissance);
  if (naissance) {
    values.dateNaissance = naissance;
    if (fields.dateNaissance.confidence === 'medium') uncertainFields.push('dateNaissance');
  }

  const delivrance = keep(fields.dateDelivrance);
  const expiration = keep(fields.dateExpiration);
  const categories = keep(fields.categories);
  const autorite = keep(fields.autorite);
  if (delivrance && fields.dateDelivrance.confidence === 'medium') uncertainDocumentFields.push('dateDelivrance');
  if (expiration && fields.dateExpiration.confidence === 'medium') uncertainDocumentFields.push('expiresAt');
  if (categories && fields.categories.confidence === 'medium') uncertainDocumentFields.push('categories');
  if (autorite && fields.autorite.confidence === 'medium') uncertainDocumentFields.push('issuingAuthority');

  const restrictions = keep(fields.restrictions);
  const versoUri = options.versoUri ?? null;
  const hasDocumentData = !!(numero || delivrance || expiration || categories || autorite || localUri || versoUri);
  const pendingDocuments: PendingDocument[] = hasDocumentData
    ? [
        {
          type: 'permis',
          customLabel: null,
          reference: numero,
          issuingAuthority: autorite,
          categories: categories ?? [],
          dateDelivrance: delivrance,
          expiresAt: expiration,
          notes: restrictions ? `Restrictions : ${restrictions}` : null,
          localUri,
          localUriVerso: versoUri,
        },
      ]
    : [];

  const warnings = checkLicence(fields).map((check) => check.code);
  return { values, pendingDocuments, uncertainFields, uncertainDocumentFields, fromOcr: true, ...(warnings.length > 0 ? { warnings } : {}), ...(options.fromCache ? { fromCache: true } : {}) };
}

/** Vrai si au moins un champ a pu être lu : sinon on propose directement la saisie manuelle. */
export function hasAnyOcrValue(fields: LicenceOcrFields): boolean {
  return Object.values(fields).some((field) => field.value !== null && field.confidence !== 'low');
}

/**
 * Lit le permis par analyse Gemini avec la clé de l'entreprise (fonction `scan-document`). Sans clé ou sans
 * accord du propriétaire, la fonction répond « non active » et rien n'est envoyé à Gemini. Aucun repli
 * automatique : en cas d'échec, l'écran propose la saisie manuelle. Le résultat reste à vérifier.
 */
export async function scanLicence(localUri: string, options: { agencyId?: string } = {}): Promise<LicenceScanResult> {
  const cloud = await scanCloudCached('permis', localUri, options.agencyId);
  if (!cloud.ok) return { ok: false, error: cloud.error, ...(cloud.detail ? { detail: cloud.detail } : {}) };
  return { ok: true, fields: normalizeLicenceFields(cloud.fields), ...(cloud.fromCache ? { fromCache: true } : {}) };
}
