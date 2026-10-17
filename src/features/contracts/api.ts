import { uploadFile } from '@/features/storage/api';
import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import type {
  AccessoryKey,
  Contract,
  ContractCreateInput,
  DepartContractInput,
  RetourContractInput,
  VehicleCondition,
} from './types';

export const CONTRACT_PDFS_BUCKET = 'contract-pdfs';

type ContractRow = {
  id: string;
  agency_id: string;
  rental_id: string;
  numero: string;
  statut: Contract['statut'];
  customer_nom: string;
  customer_telephone: string | null;
  customer_cin: string | null;
  driver_nom: string | null;
  autres_conducteurs: string[] | null;
  vehicle_immatriculation: string;
  vehicle_marque: string;
  vehicle_modele: string;
  date_debut_prevue: string;
  date_fin_prevue: string;
  prix_total: number | null;
  caution_montant: number;
  conditions_particulieres: string | null;
  notes: string | null;
  signed_at: string | null;
  signed_by: string | null;
  client_signature_path: string | null;
  agency_signature_path: string | null;
  client_signed_at: string | null;
  etat_depart: VehicleCondition | null;
  accessoires_depart: AccessoryKey[];
  observations_depart: string | null;
  etat_retour: VehicleCondition | null;
  accessoires_retour: AccessoryKey[];
  observations_retour: string | null;
  retard_minutes: number | null;
  frais_retard_propose: number | null;
  frais_carburant_propose: number | null;
  frais_justification: string | null;
  frais_appliques: boolean;
  pdf_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: ContractRow): Contract {
  return {
    id: row.id,
    agencyId: row.agency_id,
    rentalId: row.rental_id,
    numero: row.numero,
    statut: row.statut,
    customerNom: row.customer_nom,
    customerTelephone: row.customer_telephone,
    customerCin: row.customer_cin,
    driverNom: row.driver_nom,
    autresConducteurs: row.autres_conducteurs ?? [],
    vehicleImmatriculation: row.vehicle_immatriculation,
    vehicleMarque: row.vehicle_marque,
    vehicleModele: row.vehicle_modele,
    dateDebutPrevue: row.date_debut_prevue,
    dateFinPrevue: row.date_fin_prevue,
    prixTotal: row.prix_total != null ? Number(row.prix_total) : null,
    cautionMontant: Number(row.caution_montant),
    conditionsParticulieres: row.conditions_particulieres,
    notes: row.notes,
    signedAt: row.signed_at,
    signedBy: row.signed_by,
    clientSignaturePath: row.client_signature_path,
    agencySignaturePath: row.agency_signature_path,
    clientSignedAt: row.client_signed_at,
    etatDepart: row.etat_depart,
    accessoiresDepart: row.accessoires_depart ?? [],
    observationsDepart: row.observations_depart,
    etatRetour: row.etat_retour,
    accessoiresRetour: row.accessoires_retour ?? [],
    observationsRetour: row.observations_retour,
    retardMinutes: row.retard_minutes,
    fraisRetardPropose: row.frais_retard_propose != null ? Number(row.frais_retard_propose) : null,
    fraisCarburantPropose: row.frais_carburant_propose != null ? Number(row.frais_carburant_propose) : null,
    fraisJustification: row.frais_justification,
    fraisAppliques: row.frais_appliques,
    pdfPath: row.pdf_path,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listContracts(): Promise<Contract[]> {
  const { data, error } = await getSupabase().from('contracts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as ContractRow[]).map(fromRow);
}

export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await getSupabase().from('contracts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ContractRow) : null;
}

export async function getContractForRental(rentalId: string): Promise<Contract | null> {
  const { data, error } = await getSupabase()
    .from('contracts')
    .select('*')
    .eq('rental_id', rentalId)
    .neq('statut', 'annule')
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ContractRow) : null;
}

/**
 * Prend un instantané des données du moment (client, véhicule, conducteur,
 * dates, prix, caution) : une modification ultérieure de ces entités ne
 * modifie jamais ce contrat.
 */
export async function createContract(
  agencyId: string,
  input: ContractCreateInput,
  snapshot: {
    customerNom: string;
    customerTelephone: string | null;
    customerCin: string | null;
    driverNom: string | null;
    autresConducteurs: string[];
    vehicleImmatriculation: string;
    vehicleMarque: string;
    vehicleModele: string;
    dateDebutPrevue: string;
    dateFinPrevue: string;
    prixTotal: number | null;
    cautionMontant: number;
  }
): Promise<Contract> {
  const userId = await getCurrentUserId();

  const { data, error } = await getSupabase()
    .from('contracts')
    .insert({
      agency_id: agencyId,
      rental_id: input.rentalId,
      customer_nom: snapshot.customerNom,
      customer_telephone: snapshot.customerTelephone,
      customer_cin: snapshot.customerCin,
      driver_nom: snapshot.driverNom,
      autres_conducteurs: snapshot.autresConducteurs,
      vehicle_immatriculation: snapshot.vehicleImmatriculation,
      vehicle_marque: snapshot.vehicleMarque,
      vehicle_modele: snapshot.vehicleModele,
      date_debut_prevue: snapshot.dateDebutPrevue,
      date_fin_prevue: snapshot.dateFinPrevue,
      prix_total: snapshot.prixTotal,
      caution_montant: snapshot.cautionMontant,
      conditions_particulieres: input.conditionsParticulieres,
      notes: input.notes,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as ContractRow);
}

export async function markReadyToSign(id: string): Promise<Contract> {
  const { data, error } = await getSupabase().from('contracts').update({ statut: 'pret_a_signer' }).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data as ContractRow);
}

/**
 * Signature : le client a signé à l'écran (copie figée déposée avant), l'employé a sa propre signature collée.
 * Toujours horodatée et attribuée ; la base refuse « signé » sans signature du client.
 */
export async function signContract(id: string, signatures: { clientPath: string; agencyPath: string | null }): Promise<Contract> {
  const userId = await getCurrentUserId();
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('contracts')
    .update({
      statut: 'signe',
      signed_at: now,
      signed_by: userId,
      client_signature_path: signatures.clientPath,
      agency_signature_path: signatures.agencyPath,
      client_signed_at: now,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as ContractRow);
}

export async function cancelContract(id: string): Promise<Contract> {
  const { data, error } = await getSupabase().from('contracts').update({ statut: 'annule' }).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data as ContractRow);
}

/**
 * Départ atomique : rental (statut, km, carburant), véhicule (statut,
 * kilométrage) et contrat (statut, état des lieux) mis à jour ensemble dans
 * une seule transaction côté serveur (RPC `start_rental_with_contract`),
 * avec vérification que le contrat est bien signé et que la location n'a
 * pas déjà été démarrée — voir migrations/0015_contracts.sql.
 */
export async function recordDeparture(
  rentalId: string,
  contractId: string,
  kmDepart: number,
  carburantDepart: number,
  input: DepartContractInput
): Promise<void> {
  const { error } = await getSupabase().rpc('start_rental_with_contract', {
    p_rental_id: rentalId,
    p_contract_id: contractId,
    p_km_depart: kmDepart,
    p_carburant_depart: carburantDepart,
    p_etat_depart: input.etatDepart,
    p_accessoires_depart: input.accessoiresDepart,
    p_observations_depart: input.observationsDepart,
  });
  if (error) throw error;
}

/** Retour atomique, même principe — voir recordDeparture ci-dessus. */
export async function recordReturn(
  rentalId: string,
  contractId: string,
  kmRetour: number,
  carburantRetour: number,
  input: RetourContractInput
): Promise<void> {
  const { error } = await getSupabase().rpc('complete_rental_with_contract', {
    p_rental_id: rentalId,
    p_contract_id: contractId,
    p_km_retour: kmRetour,
    p_carburant_retour: carburantRetour,
    p_etat_retour: input.etatRetour,
    p_accessoires_retour: input.accessoiresRetour,
    p_observations_retour: input.observationsRetour,
    p_retard_minutes: input.retardMinutes,
    p_frais_retard_propose: input.fraisRetardPropose,
    p_frais_carburant_propose: input.fraisCarburantPropose,
    p_frais_justification: input.fraisJustification,
    p_appliquer_frais: input.appliquerFrais,
  });
  if (error) throw error;
}

export async function uploadContractPdf(agencyId: string, contractId: string, localUri: string): Promise<string> {
  const path = `${agencyId}/${contractId}/contrat-${Date.now()}.pdf`;
  await uploadFile(CONTRACT_PDFS_BUCKET, path, localUri, 'application/pdf');

  const { error } = await getSupabase().from('contracts').update({ pdf_path: path }).eq('id', contractId);
  if (error) throw error;

  return path;
}
