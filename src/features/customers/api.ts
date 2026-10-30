import { getSupabase } from '@/lib/supabase';

import type {
  Customer,
  CustomerInput,
  CustomerType,
  Driver,
  DriverInput,
  PreferredLanguage,
} from './types';
import { documentFromRow, type CustomerDocumentRow } from './documents-api';

export const DOCUMENTS_BUCKET = 'client-documents';

/** Fiche client + ses documents actifs (les documents supprimés ne sont jamais renvoyés). */
const CUSTOMER_SELECT = '*, customer_documents(*)';

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
  consentement_donnees: boolean;
  consentement_date: string | null;
  customer_documents?: CustomerDocumentRow[] | null;
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
    consentementDonnees: row.consentement_donnees,
    consentementDate: row.consentement_date,
    documents: (row.customer_documents ?? []).filter((doc) => !doc.deleted_at).map(documentFromRow),
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
  };
}

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await getSupabase()
    .from('customers')
    .select(CUSTOMER_SELECT)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as CustomerRow[]).map(fromRow);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await getSupabase().from('customers').select(CUSTOMER_SELECT).eq('id', id).maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as CustomerRow) : null;
}

export async function createCustomer(agencyId: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .insert({ ...toRow(input), agency_id: agencyId })
    .select(CUSTOMER_SELECT)
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update(toRow(input))
    .eq('id', id)
    .select(CUSTOMER_SELECT)
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

export async function archiveCustomer(id: string): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .select(CUSTOMER_SELECT)
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

export async function reactivateCustomer(id: string): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update({ archived_at: null })
    .eq('id', id)
    .select(CUSTOMER_SELECT)
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

export async function setCustomerConsent(id: string, consent: boolean): Promise<Customer> {
  const { data, error } = await getSupabase()
    .from('customers')
    .update({
      consentement_donnees: consent,
      consentement_date: consent ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select(CUSTOMER_SELECT)
    .single();

  if (error) throw error;
  return fromRow(data as CustomerRow);
}

// ======================================================================
// Conducteurs
// ======================================================================

type DriverRow = {
  id: string;
  agency_id: string;
  customer_id: string;
  linked_customer_id: string | null;
  nom_complet: string;
  prenom: string | null;
  nom: string | null;
  cin_ou_passeport: string | null;
  numero_permis: string | null;
  telephone: string | null;
  created_at: string;
};

export function driverFromRow(row: DriverRow): Driver {
  return {
    id: row.id,
    agencyId: row.agency_id,
    customerId: row.customer_id,
    linkedCustomerId: row.linked_customer_id,
    nomComplet: row.nom_complet,
    prenom: row.prenom,
    nom: row.nom,
    cinOuPasseport: row.cin_ou_passeport,
    numeroPermis: row.numero_permis,
    telephone: row.telephone,
    createdAt: row.created_at,
  };
}

const DRIVER_COLUMNS =
  'id, agency_id, customer_id, linked_customer_id, nom_complet, prenom, nom, cin_ou_passeport, numero_permis, telephone, created_at';

/** Conducteurs supplémentaires d'un client (la ligne technique d'un client « conducteur lié » n'en fait pas partie). */
export async function listDrivers(customerId: string): Promise<Driver[]> {
  const { data, error } = await getSupabase()
    .from('drivers')
    .select(DRIVER_COLUMNS)
    .eq('customer_id', customerId)
    .is('linked_customer_id', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as DriverRow[]).map(driverFromRow);
}

/** Tous les conducteurs de l'agence (recherche transversale lors d'une réservation). */
export async function listAllDrivers(): Promise<Driver[]> {
  const { data, error } = await getSupabase()
    .from('drivers')
    .select(DRIVER_COLUMNS)
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
      prenom: input.prenom ?? null,
      nom: input.nom ?? null,
      cin_ou_passeport: input.cinOuPasseport,
      numero_permis: input.numeroPermis,
      telephone: input.telephone,
    })
    .select(DRIVER_COLUMNS)
    .single();

  if (error) throw error;
  return driverFromRow(data as DriverRow);
}

/** Réutilise (ou crée une seule fois) la ligne « conducteur » d'une fiche client existante. */
export async function ensureCustomerDriver(customerId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('ensure_customer_driver', { p_customer_id: customerId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function removeDriver(id: string): Promise<void> {
  const { error } = await getSupabase().from('drivers').delete().eq('id', id);
  if (error) throw error;
}
