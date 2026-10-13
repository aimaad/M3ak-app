import {
  documentToFormValues,
  isDocumentFormValid,
  toDocumentInput,
  validateDocumentForm,
  type DocumentFormValues,
} from './documents';
import type { CustomerInput, PendingDocument } from './types';

/** Un document en cours de saisie dans le formulaire de création (le client n'existe pas encore). */
export type PendingEntry = { key: string; values: DocumentFormValues; localUri: string | null };

let entryCounter = 0;
export function newEntryKey(): string {
  entryCounter += 1;
  return `pending-${entryCounter}`;
}

/** Convertit les documents préparés par le scan en entrées modifiables du formulaire. */
export function entriesFromPending(pending: PendingDocument[]): PendingEntry[] {
  return pending.map((doc) => ({
    key: newEntryKey(),
    localUri: doc.localUri,
    values: documentToFormValues({
      id: '',
      type: doc.type,
      customLabel: doc.customLabel,
      reference: doc.reference,
      issuingAuthority: doc.issuingAuthority,
      categories: doc.categories,
      dateDelivrance: doc.dateDelivrance,
      expiresAt: doc.expiresAt,
      path: null,
      notes: doc.notes,
      uploadedAt: '',
      uploadedBy: null,
      uploadedByName: null,
    }),
  }));
}

/** Toutes les entrées ont des dates valides (aucun document n'est obligatoire pour créer la fiche). */
export function entriesAreValid(entries: PendingEntry[]): boolean {
  return entries.every((entry) => isDocumentFormValid(validateDocumentForm(entry.values)));
}

export function entriesToPending(entries: PendingEntry[]): PendingDocument[] {
  return entries.map((entry) => ({ ...toDocumentInput(entry.values), localUri: entry.localUri }));
}

/**
 * Le numéro de permis existe à deux endroits : sur la fiche (recherche, contrat) et sur le document.
 * On les aligne sans jamais écraser une valeur saisie : le numéro de la fiche complète le document
 * et inversement.
 */
export function reconcilePermisNumber(
  input: CustomerInput,
  documents: PendingDocument[]
): { input: CustomerInput; documents: PendingDocument[] } {
  const permis = documents.find((doc) => doc.type === 'permis' && doc.reference);
  const nextInput =
    !input.numeroPermis && permis?.reference ? { ...input, numeroPermis: permis.reference } : input;

  const nextDocuments = documents.map((doc) =>
    doc.type === 'permis' && !doc.reference && nextInput.numeroPermis ? { ...doc, reference: nextInput.numeroPermis } : doc
  );
  return { input: nextInput, documents: nextDocuments };
}
