import { uploadFile } from '@/features/storage/api';
import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import type {
  Customer,
  CustomerDocument,
  CustomerInput,
  CustomerType,
  Driver,
  DriverInput,
  DocumentType,
  PreferredLanguage,
} from './types';

export const DOCUMENTS_BUCKET = 'client-documents';

type CustomerRow = {
  id: string;
  agency_id: string;
  nom_complet: string;
  prenom: string | null;
  nom: string | null;
  cin_ou_passeport: string | null;
  numero_permis: string | null;
  telephone: string | null;
  telephone_secondaire: string | null;
  email: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string;
  date_naissance: string | null;
  langue_preferee: PreferredLanguage | null;
  type_client: CustomerType;
  raison_sociale: string | null;
  ice: string | null;
  notes: string | null;
  documents: CustomerDocument[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    agencyId: row.agency_id,
    nomComplet: row.nom_complet,
    prenom: row.prenom,
    nom: row.nom,
    cinOuPasseport: row.cin_ou_passeport,
    numeroPermis: row.numero_permis,
    telephone: row.telephone,
    telephoneSecondaire: row.telephone_secondaire,
    email: row.email,
    adresse: row.adresse,
    ville: row.ville,
    pays: row.pays,
    dateNaissance: row.date_naissance,
    languePreferee: row.langue_preferee,
    typeClient: row.type_client,
    raisonSociale: row.raison_sociale,
    ice: row.ice,
    notes: row.notes,
    documents: row.documents ?? [],
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: CustomerInput) {
  return {
    nom_complet: input.nomComplet,
    prenom: input.prenom,
    nom: input.nom,
    cin_ou_passeport: input.cinOuPasseport,
    numero_permis: input.numeroPermis,
    telephone: input.telephone,
    telephone_secondaire: input.telephoneSecondaire,
    email: input.email,
    adresse: input.adresse,
    ville: input.ville,
    pays: input.pays,
    date_naissance: input.dateNaissance,
    langue_preferee: input.languePreferee,
    type_client: input.typeClient,
    raison_sociale: input.raisonSociale,
    ice: input.ice,
    notes: input.notes,
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

export async function archiveCustomer(id: string): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

export async function reactivateCustomer(id: string): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update({ archived_at: null })
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
  localUri: string,
  meta: { reference: string | null; dateDelivrance: string | null; expiresAt: string | null }
): Promise<CustomerDocument> {
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${agencyId}/${customerId}/${type}-${Date.now()}.${extension}`;

  await uploadFile(DOCUMENTS_BUCKET, path, localUri, contentType);
  const uploadedBy = await getCurrentUserId();

  return {
    type,
    path,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    reference: meta.reference,
    dateDelivrance: meta.dateDelivrance,
    expiresAt: meta.expiresAt,
  };
}

// ======================================================================
// Conducteurs supplémentaires
// ======================================================================

type DriverRow = {
  id: string;
  agency_id: string;
  customer_id: string;
  nom_complet: string;
  cin_ou_passeport: string | null;
  numero_permis: string | null;
  telephone: string | null;
  documents: CustomerDocument[];
  created_at: string;
};

function driverFromRow(row: DriverRow): Driver {
  return {
    id: row.id,
    agencyId: row.agency_id,
    customerId: row.customer_id,
    nomComplet: row.nom_complet,
    cinOuPasseport: row.cin_ou_passeport,
    numeroPermis: row.numero_permis,
    telephone: row.telephone,
    documents: row.documents ?? [],
    createdAt: row.created_at,
  };
}

export async function listDrivers(customerId: string): Promise<Driver[]> {
  const { data, error } = await getSupabase()
    .from('drivers')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as DriverRow[]).map(driverFromRow);
}

export async function createDriver(
  agencyId: string,
  customerId: string,
  input: DriverInput
): Promise<Driver> {
  const { data, error } = await getSupabase()
    .from('drivers')
    .insert({
      agency_id: agencyId,
      customer_id: customerId,
      nom_complet: input.nomComplet,
      cin_ou_passeport: input.cinOuPasseport,
      numero_permis: input.numeroPermis,
      telephone: input.telephone,
    })
    .select()
    .single();

  if (error) throw error;
  return driverFromRow(data as DriverRow);
}

export async function removeDriver(id: string): Promise<void> {
  const { error } = await getSupabase().from('drivers').delete().eq('id', id);
  if (error) throw error;
}
