import { computeExpiryUrgency, type ExpiryUrgency } from '@/lib/expiry';

import type { CustomerDocument, DocumentInput, DocumentType } from './types';

/** Types qui portent une catégorie de permis (B, C, D…). */
export function isLicenceDocument(type: DocumentType): boolean {
  return type === 'permis';
}

/** CIN et passeport : les pièces d'identité exigées du client contractuel. */
export function isIdentityDocument(type: DocumentType): boolean {
  return type === 'cin' || type === 'passeport';
}

/** Tous les documents d'un type donné (il peut y en avoir plusieurs). */
export function documentsOfType(documents: CustomerDocument[], type: DocumentType): CustomerDocument[] {
  return documents.filter((doc) => doc.type === type);
}

/**
 * Le document le plus pertinent d'un type : celui qui expire le plus tard, un document sans
 * date étant considéré après les autres. Même règle que la vérification avant départ côté serveur.
 */
export function bestDocumentOfType(documents: CustomerDocument[], type: DocumentType): CustomerDocument | null {
  const candidates = documentsOfType(documents, type);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    if (a.expiresAt && b.expiresAt) return b.expiresAt.localeCompare(a.expiresAt);
    if (a.expiresAt) return -1;
    if (b.expiresAt) return 1;
    return b.uploadedAt.localeCompare(a.uploadedAt);
  })[0];
}

export type DocumentExpiryStatus = 'no_date' | 'ok' | 'expiring_soon' | 'expired';

/** État d'expiration d'un document à une date donnée (« no_date » = date à vérifier). */
export function documentExpiryStatus(
  doc: Pick<CustomerDocument, 'expiresAt'>,
  today: Date = new Date(),
  dueSoonDays = 30
): DocumentExpiryStatus {
  const urgency: ExpiryUrgency | null = computeExpiryUrgency(doc.expiresAt, today, dueSoonDays);
  if (urgency === null) return 'no_date';
  if (urgency === 'expire') return 'expired';
  if (urgency === 'bientot') return 'expiring_soon';
  return 'ok';
}

/** Vrai si le document expire avant la fin de la location (ou est déjà expiré). */
export function expiresBefore(doc: Pick<CustomerDocument, 'expiresAt'>, endISO: string): boolean {
  if (!doc.expiresAt) return false;
  return doc.expiresAt.slice(0, 10) < endISO.slice(0, 10);
}

/** Libellé affiché : le libellé libre pour « autre », sinon la clé de traduction du type. */
export function documentLabel(
  doc: Pick<CustomerDocument, 'type' | 'customLabel'>,
  translate: (key: string) => string
): string {
  if (doc.type === 'autre' && doc.customLabel?.trim()) return doc.customLabel.trim();
  return translate(`customer.documentTypes.${doc.type}`);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Accepte AAAA-MM-JJ et JJ/MM/AAAA (saisie courante au Maroc) ; renvoie l'ISO ou null si invalide. */
export function parseDateInput(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let iso: string | null = null;
  if (ISO_DATE.test(value)) {
    iso = value;
  } else {
    const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
    if (match) iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  if (!iso) return null;

  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export type DocumentFormValues = {
  type: DocumentType;
  customLabel: string;
  reference: string;
  issuingAuthority: string;
  categories: string;
  dateDelivrance: string;
  expiresAt: string;
  notes: string;
};

export type DocumentFormErrorCode = 'invalid_date' | 'dates_order' | 'required';
export type DocumentFormErrors = Partial<Record<'dateDelivrance' | 'expiresAt' | 'customLabel', DocumentFormErrorCode>>;

export const EMPTY_DOCUMENT_FORM: DocumentFormValues = {
  type: 'permis',
  customLabel: '',
  reference: '',
  issuingAuthority: '',
  categories: '',
  dateDelivrance: '',
  expiresAt: '',
  notes: '',
};

/**
 * Aucun document n'est obligatoire pour créer une fiche : seules les dates saisies doivent
 * être valides et cohérentes, et « autre document » doit avoir un libellé.
 */
export function validateDocumentForm(values: DocumentFormValues): DocumentFormErrors {
  const errors: DocumentFormErrors = {};

  const delivrance = values.dateDelivrance.trim() ? parseDateInput(values.dateDelivrance) : null;
  const expiry = values.expiresAt.trim() ? parseDateInput(values.expiresAt) : null;

  if (values.dateDelivrance.trim() && !delivrance) errors.dateDelivrance = 'invalid_date';
  if (values.expiresAt.trim() && !expiry) errors.expiresAt = 'invalid_date';
  if (delivrance && expiry && expiry < delivrance) errors.expiresAt = 'dates_order';
  if (values.type === 'autre' && !values.customLabel.trim()) errors.customLabel = 'required';

  return errors;
}

export function isDocumentFormValid(errors: DocumentFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** « B, C1 ; d » → ['B', 'C1', 'D'] (majuscules, sans doublon). */
export function parseCategories(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,;/]+/)) {
    const code = part.trim().toUpperCase();
    if (code) seen.add(code);
  }
  return [...seen];
}

export function toDocumentInput(values: DocumentFormValues): DocumentInput {
  return {
    type: values.type,
    customLabel: values.type === 'autre' ? emptyToNull(values.customLabel) : null,
    reference: emptyToNull(values.reference),
    issuingAuthority: emptyToNull(values.issuingAuthority),
    categories: isLicenceDocument(values.type) ? parseCategories(values.categories) : [],
    dateDelivrance: values.dateDelivrance.trim() ? parseDateInput(values.dateDelivrance) : null,
    expiresAt: values.expiresAt.trim() ? parseDateInput(values.expiresAt) : null,
    notes: emptyToNull(values.notes),
  };
}

export function documentToFormValues(doc: CustomerDocument): DocumentFormValues {
  return {
    type: doc.type,
    customLabel: doc.customLabel ?? '',
    reference: doc.reference ?? '',
    issuingAuthority: doc.issuingAuthority ?? '',
    categories: doc.categories.join(', '),
    dateDelivrance: doc.dateDelivrance ?? '',
    expiresAt: doc.expiresAt ?? '',
    notes: doc.notes ?? '',
  };
}

/**
 * Le client a-t-il une pièce d'identité enregistrée ? Oui s'il a un numéro de CIN / passeport sur sa fiche, ou un
 * document « CIN » / « passeport » (avec un numéro ou un fichier) dans son dossier. Sert à appliquer l'exigence du
 * propriétaire à la création d'une location (le serveur applique la même règle).
 */
export function customerHasIdentity(customer: { cinOuPasseport: string | null; documents?: { type: string; reference: string | null; path: string | null }[] }): boolean {
  if (customer.cinOuPasseport?.trim()) return true;
  return (customer.documents ?? []).some((doc) => (doc.type === 'cin' || doc.type === 'passeport') && (!!doc.reference?.trim() || !!doc.path));
}
