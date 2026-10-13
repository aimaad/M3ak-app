import { recognizeLines } from '@/features/ocr/local-ocr';
import { parseLicenceText } from '@/features/ocr/licence-parser';

import { parseCategories, parseDateInput } from './documents';
import type { PendingDocument } from './types';
import type { CustomerFormValues } from './validation';

export type OcrConfidence = 'high' | 'medium' | 'low';
export type OcrField<T> = { value: T | null; confidence: OcrConfidence };

/** Champs lus sur un permis de conduire. Une valeur absente ou illisible reste null : jamais inventée. */
export type LicenceOcrFields = {
  nom: OcrField<string>;
  prenom: OcrField<string>;
  numeroPermis: OcrField<string>;
  dateDelivrance: OcrField<string>;
  dateExpiration: OcrField<string>;
  categories: OcrField<string[]>;
  dateNaissance: OcrField<string>;
  autorite: OcrField<string>;
};

/** `ocr_unavailable` : module d'OCR local absent (ex. Expo Go) ; `ocr_failed` : la lecture locale a échoué. */
export type LicenceScanErrorCode = 'ocr_unavailable' | 'ocr_failed';

/** `debugLines` : texte lu, fourni UNIQUEMENT dans une version de développement (jamais en production, jamais journalisé). */
export type LicenceScanResult =
  | { ok: true; fields: LicenceOcrFields; debugLines?: string[] }
  | { ok: false; error: LicenceScanErrorCode };

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

/** Normalise la réponse du serveur (déjà nettoyée une fois) : défense en profondeur côté app. */
export function normalizeLicenceFields(raw: unknown): LicenceOcrFields {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    nom: readText(source.nom),
    prenom: readText(source.prenom),
    numeroPermis: readText(source.numeroPermis),
    dateDelivrance: readDate(source.dateDelivrance),
    dateExpiration: readDate(source.dateExpiration),
    categories: readCategories(source.categories),
    dateNaissance: readDate(source.dateNaissance),
    autorite: readText(source.autorite),
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
};

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
export function licenceFieldsToDraft(fields: LicenceOcrFields, localUri: string | null): CustomerCreationDraft {
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
  if (prenom || nom) {
    values.nomComplet = [prenom, nom].filter(Boolean).join(' ');
    if (fields.prenom.confidence === 'medium' || fields.nom.confidence === 'medium') {
      uncertainFields.push('nomComplet');
    }
    if (prenom && fields.prenom.confidence === 'medium') uncertainFields.push('prenom');
    if (nom && fields.nom.confidence === 'medium') uncertainFields.push('nom');
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

  const hasDocumentData = !!(numero || delivrance || expiration || categories || autorite || localUri);
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
          notes: null,
          localUri,
        },
      ]
    : [];

  return { values, pendingDocuments, uncertainFields, uncertainDocumentFields, fromOcr: true };
}

/** Vrai si au moins un champ a pu être lu : sinon on propose directement la saisie manuelle. */
export function hasAnyOcrValue(fields: LicenceOcrFields): boolean {
  return Object.values(fields).some((field) => field.value !== null && field.confidence !== 'low');
}

/**
 * Lit le permis par OCR LOCAL (sur l'appareil) : la photo n'est envoyée à aucun service d'analyse.
 * Le résultat reste à vérifier par l'employé avant tout enregistrement.
 */
export async function scanLicence(localUri: string): Promise<LicenceScanResult> {
  const recognized = await recognizeLines(localUri);
  if (!recognized.ok) return { ok: false, error: recognized.error };
  return {
    ok: true,
    fields: normalizeLicenceFields(parseLicenceText(recognized.lines)),
    ...(__DEV__ ? { debugLines: recognized.lines } : {}),
  };
}
