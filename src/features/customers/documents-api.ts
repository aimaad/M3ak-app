import { uploadFile } from '@/features/storage/api';
import { getSupabase } from '@/lib/supabase';

import type { CustomerDocument, DocumentInput, DocumentType } from './types';

export const CUSTOMER_DOCUMENTS_BUCKET = 'client-documents';

/** Ligne de la table customer_documents. */
export type CustomerDocumentRow = {
  id: string;
  agency_id: string;
  customer_id: string | null;
  driver_id: string | null;
  doc_type: DocumentType;
  custom_label: string | null;
  reference: string | null;
  issuing_authority: string | null;
  categories: string[] | null;
  date_delivrance: string | null;
  expires_at: string | null;
  file_path: string | null;
  notes: string | null;
  added_by: string | null;
  added_by_name: string | null;
  created_at: string;
  deleted_at: string | null;
};

export function documentFromRow(row: CustomerDocumentRow): CustomerDocument {
  return {
    id: row.id,
    type: row.doc_type,
    customLabel: row.custom_label,
    reference: row.reference,
    issuingAuthority: row.issuing_authority,
    categories: row.categories ?? [],
    dateDelivrance: row.date_delivrance,
    expiresAt: row.expires_at,
    path: row.file_path,
    notes: row.notes,
    uploadedAt: row.created_at,
    uploadedBy: row.added_by,
    uploadedByName: row.added_by_name,
  };
}

/** Propriétaire d'un document : un client, ou un conducteur (qui n'est pas lui-même un client). */
export type DocumentOwner = { kind: 'customer'; id: string } | { kind: 'driver'; id: string };

function contentTypeFor(uri: string): { extension: string; contentType: string } {
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  if (extension === 'png') return { extension, contentType: 'image/png' };
  if (extension === 'pdf') return { extension, contentType: 'application/pdf' };
  return { extension: 'jpg', contentType: 'image/jpeg' };
}

function toRow(input: DocumentInput) {
  return {
    doc_type: input.type,
    custom_label: input.customLabel,
    reference: input.reference,
    issuing_authority: input.issuingAuthority,
    categories: input.categories,
    date_delivrance: input.dateDelivrance,
    expires_at: input.expiresAt,
    notes: input.notes,
  };
}

export async function listOwnerDocuments(owner: DocumentOwner): Promise<CustomerDocument[]> {
  const column = owner.kind === 'customer' ? 'customer_id' : 'driver_id';
  const { data, error } = await getSupabase()
    .from('customer_documents')
    .select('*')
    .eq(column, owner.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as CustomerDocumentRow[]).map(documentFromRow);
}

async function removeFileQuietly(path: string | null | undefined): Promise<void> {
  if (!path) return;
  // Nettoyage « au mieux » : un fichier orphelin n'est pas visible (aucune ligne ne le référence).
  await getSupabase().storage.from(CUSTOMER_DOCUMENTS_BUCKET).remove([path]).catch(() => undefined);
}

/**
 * Ajoute un document (avec ou sans fichier). Le fichier est validé (type, taille) puis envoyé
 * avant la ligne ; si l'enregistrement échoue, le fichier envoyé est retiré.
 */
export async function addDocument(
  agencyId: string,
  owner: DocumentOwner,
  input: DocumentInput,
  localUri: string | null
): Promise<CustomerDocument> {
  let path: string | null = null;
  if (localUri) {
    const { extension, contentType } = contentTypeFor(localUri);
    path = `${agencyId}/${owner.id}/${input.type}-${Date.now()}.${extension}`;
    await uploadFile(CUSTOMER_DOCUMENTS_BUCKET, path, localUri, contentType);
  }

  const { data, error } = await getSupabase()
    .from('customer_documents')
    .insert({
      agency_id: agencyId,
      customer_id: owner.kind === 'customer' ? owner.id : null,
      driver_id: owner.kind === 'driver' ? owner.id : null,
      file_path: path,
      ...toRow(input),
    })
    .select('*')
    .single();

  if (error) {
    await removeFileQuietly(path);
    throw error;
  }
  return documentFromRow(data as CustomerDocumentRow);
}

/** Corrige les informations d'un document (type, numéro, dates, catégories, notes). */
export async function updateDocument(id: string, input: DocumentInput): Promise<CustomerDocument> {
  const { data, error } = await getSupabase()
    .from('customer_documents')
    .update(toRow(input))
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return documentFromRow(data as CustomerDocumentRow);
}

/** Remplace le fichier d'un document : le nouveau est envoyé d'abord, l'ancien n'est retiré qu'ensuite. */
export async function replaceDocumentFile(
  agencyId: string,
  owner: DocumentOwner,
  doc: Pick<CustomerDocument, 'id' | 'type' | 'path'>,
  localUri: string
): Promise<CustomerDocument> {
  const { extension, contentType } = contentTypeFor(localUri);
  const path = `${agencyId}/${owner.id}/${doc.type}-${Date.now()}.${extension}`;
  await uploadFile(CUSTOMER_DOCUMENTS_BUCKET, path, localUri, contentType);

  const { data, error } = await getSupabase()
    .from('customer_documents')
    .update({ file_path: path })
    .eq('id', doc.id)
    .select('*')
    .single();

  if (error) {
    await removeFileQuietly(path);
    throw error;
  }
  await removeFileQuietly(doc.path);
  return documentFromRow(data as CustomerDocumentRow);
}

/**
 * Suppression douce (responsables uniquement, vérifié côté serveur) : la ligne et son historique
 * restent, le fichier est détaché puis effacé du stockage.
 */
export async function deleteDocument(doc: Pick<CustomerDocument, 'id' | 'path'>): Promise<void> {
  const { error } = await getSupabase()
    .from('customer_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', doc.id);

  if (error) throw error;
  await removeFileQuietly(doc.path);
}

/** Envoie le fichier de chaque document en attente d'un nouveau client, en continuant malgré un échec isolé. */
export async function addPendingDocuments(
  agencyId: string,
  owner: DocumentOwner,
  pending: { input: DocumentInput; localUri: string | null }[]
): Promise<{ saved: number; failed: number }> {
  let saved = 0;
  let failed = 0;
  for (const item of pending) {
    try {
      await addDocument(agencyId, owner, item.input, item.localUri);
      saved += 1;
    } catch {
      failed += 1;
    }
  }
  return { saved, failed };
}
