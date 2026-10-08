import { getSupabase } from '@/lib/supabase';

import type { MaintenanceInput, MaintenanceItem } from './types';

type MaintenanceRow = {
  id: string;
  agency_id: string;
  vehicle_id: string;
  type: MaintenanceItem['type'];
  echeance_date: string | null;
  echeance_km: number | null;
  statut: MaintenanceItem['statut'];
  notes: string | null;
  created_at: string;
};

function fromRow(row: MaintenanceRow): MaintenanceItem {
  return {
    id: row.id,
    agencyId: row.agency_id,
    vehicleId: row.vehicle_id,
    type: row.type,
    echeanceDate: row.echeance_date,
    echeanceKm: row.echeance_km,
    statut: row.statut,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listMaintenanceItems(): Promise<MaintenanceItem[]> {
  const { data, error } = await getSupabase()
    .from('maintenance_items')
    .select('*')
    .order('echeance_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data as MaintenanceRow[]).map(fromRow);
}

export async function createMaintenanceItem(
  agencyId: string,
  input: MaintenanceInput
): Promise<MaintenanceItem> {
  const { data, error } = await getSupabase()
    .from('maintenance_items')
    .insert({
      agency_id: agencyId,
      vehicle_id: input.vehicleId,
      type: input.type,
      echeance_date: input.echeanceDate,
      echeance_km: input.echeanceKm,
      notes: input.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as MaintenanceRow);
}

export async function markMaintenanceDone(id: string): Promise<MaintenanceItem> {
  const { data, error } = await getSupabase()
    .from('maintenance_items')
    .update({ statut: 'effectuee' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as MaintenanceRow);
}
