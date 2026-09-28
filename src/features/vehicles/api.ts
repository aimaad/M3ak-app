import { getSupabase } from '@/lib/supabase';

import type { Vehicle, VehicleInput } from './types';

type VehicleRow = {
  id: string;
  agency_id: string;
  branch_id: string | null;
  immatriculation: string;
  marque: string;
  modele: string;
  annee: number | null;
  carburant: Vehicle['carburant'];
  kilometrage: number;
  statut: Vehicle['statut'];
  prix_jour: number;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

function fromRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    agencyId: row.agency_id,
    branchId: row.branch_id,
    immatriculation: row.immatriculation,
    marque: row.marque,
    modele: row.modele,
    annee: row.annee,
    carburant: row.carburant,
    kilometrage: row.kilometrage,
    statut: row.statut,
    prixJour: Number(row.prix_jour),
    photoUrl: row.photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(input: VehicleInput) {
  return {
    marque: input.marque,
    modele: input.modele,
    immatriculation: input.immatriculation,
    annee: input.annee,
    carburant: input.carburant,
    kilometrage: input.kilometrage,
    statut: input.statut,
    prix_jour: input.prixJour,
  };
}

export async function listVehicles(): Promise<Vehicle[]> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as VehicleRow[]).map(fromRow);
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  const { data, error } = await getSupabase().from('vehicles').select('*').eq('id', id).maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as VehicleRow) : null;
}

export async function createVehicle(agencyId: string, input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .insert({ ...toRow(input), agency_id: agencyId })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  const { data, error } = await getSupabase()
    .from('vehicles')
    .update(toRow(input))
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as VehicleRow);
}
