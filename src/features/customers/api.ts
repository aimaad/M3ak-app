import { uploadFile } from '@/features/storage/api';
import { getSupabase } from '@/lib/supabase';

import type { Customer, CustomerDocument, CustomerInput, DocumentType } from './types';

export const DOCUMENTS_BUCKET = 'client-documents';

type CustomerRow = {
  id: string;
  agency_id: string;
  nom_complet: string;
  cin_ou_passeport: string | null;
  numero_permis: string | null;
  telephone: string | null;
  email: string | null;
  documents: CustomerDocument[];
  created_at: string;
};

function fromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    agencyId: row.agency_id,
    nomComplet: row.nom_complet,
    cinOuPasseport: row.cin_ou_passeport,
    numeroPermis: row.numero_permis,
    telephone: row.telephone,
    email: row.email,
    documents: row.documents ?? [],
    createdAt: row.created_at,
  };
}

function toRow(input: CustomerInput) {
  return {
    nom_complet: input.nomComplet,
    cin_ou_passeport: input.cinOuPasseport,
    numero_permis: input.numeroPermis,
    telephone: input.telephone,
    email: input.email,
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await getSupabase()
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as CustomerRow[]).map(fromRow);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await getSupabase().from('customers').select('*').eq('id', id).maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as CustomerRow) : null;
}

export async function createCustomer(agencyId: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .insert({ ...toRow(input), agency_id: agencyId })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update(toRow(input))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

export async function updateCustomerDocuments(
  id: string,
  documents: CustomerDocument[]
): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update({ documents })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

export async function uploadCustomerDocument(
  agencyId: string,
  customerId: string,
  type: DocumentType,
  localUri: string
): Promise<CustomerDocument> {
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${agencyId}/${customerId}/${type}-${Date.now()}.${extension}`;

  await uploadFile(DOCUMENTS_BUCKET, path, localUri, contentType);

  return { type, path, uploadedAt: new Date().toISOString() };
}
