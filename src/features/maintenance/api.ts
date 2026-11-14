import { uploadFile } from '@/features/storage/api';
import { getSupabase } from '@/lib/supabase';

import type { MaintenanceCompletionInput, MaintenanceInput, MaintenanceItem } from './types';

export const MAINTENANCE_DOCUMENTS_BUCKET = 'maintenance-documents';

type MaintenanceRow = {
  id: string;
  agency_id: string;
  vehicle_id: string;
  type: MaintenanceItem['type'];
  echeance_date: string | null;
  echeance_km: number | null;
  statut: MaintenanceItem['statut'];
  notes: string | null;
  garage: string | null;
  cout: number | null;
  pieces_remplacees: string | null;
  facture_path: string | null;
  date_intervention: string | null;
  repeat_km: number | null;
  repeat_months: number | null;
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
    garage: row.garage,
    cout: row.cout !== null ? Number(row.cout) : null,
    piecesRemplacees: row.pieces_remplacees,
    facturePath: row.facture_path,
    dateIntervention: row.date_intervention,
    repeatKm: row.repeat_km ?? null,
    repeatMonths: row.repeat_months ?? null,
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

export async function listMaintenanceItemsForVehicle(vehicleId: string): Promise<MaintenanceItem[]> {
  const { data, error } = await getSupabase()
    .from('maintenance_items')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as MaintenanceRow[]).map(fromRow);
}

export async function getMaintenanceItem(id: string): Promise<MaintenanceItem | null> {
  const { data, error } = await getSupabase().from('maintenance_items').select('*').eq('id', id).maybeSingle();

  if (error) throw error;
  return data ? fromRow(data as MaintenanceRow) : null;
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
      // La périodicité n'est envoyée que si elle est réglée : une échéance ponctuelle s'enregistre même si la migration 0071 manque.
      ...(input.repeatKm != null ? { repeat_km: input.repeatKm } : {}),
      ...(input.repeatMonths != null ? { repeat_months: input.repeatMonths } : {}),
      // Une panne est un incident signalé maintenant, pas une échéance à venir :
      // elle démarre directement "en_cours" (le véhicule est immobilisé aussitôt).
      statut: input.type === 'panne' ? 'en_cours' : 'a_venir',
    })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as MaintenanceRow);
}

/** Corrige date, kilométrage et notes d'une échéance pas encore commencée (le statut repart à « à venir » : l'urgence se recalcule). */
export async function updateMaintenanceDue(
  id: string,
  patch: { echeanceDate: string | null; echeanceKm: number | null; notes: string | null; repeatKm?: number | null; repeatMonths?: number | null }
): Promise<MaintenanceItem> {
  const { data, error } = await getSupabase()
    .from('maintenance_items')
    .update({ echeance_date: patch.echeanceDate, echeance_km: patch.echeanceKm, notes: patch.notes, statut: 'a_venir', ...(patch.repeatKm != null ? { repeat_km: patch.repeatKm } : patch.repeatKm === null ? { repeat_km: null } : {}), ...(patch.repeatMonths != null ? { repeat_months: patch.repeatMonths } : patch.repeatMonths === null ? { repeat_months: null } : {}) })
    .eq('id', id)
    .in('statut', ['a_venir', 'due', 'en_retard'])
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as MaintenanceRow);
}

/** Supprime une échéance (propriétaire et responsable seulement, côté base aussi). */
export async function deleteMaintenanceItem(id: string): Promise<void> {
  const { error } = await getSupabase().from('maintenance_items').delete().eq('id', id);
  if (error) throw error;
}

export async function startMaintenanceItem(id: string): Promise<MaintenanceItem> {
  const { data, error } = await getSupabase()
    .from('maintenance_items')
    .update({ statut: 'en_cours' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as MaintenanceRow);
}

export async function completeMaintenanceItem(
  id: string,
  completion: MaintenanceCompletionInput
): Promise<MaintenanceItem> {
  const { data, error } = await getSupabase()
    .from('maintenance_items')
    .update({
      statut: 'effectuee',
      date_intervention: new Date().toISOString().slice(0, 10),
      garage: completion.garage,
      cout: completion.cout,
      pieces_remplacees: completion.piecesRemplacees,
      facture_path: completion.facturePath,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as MaintenanceRow);
}

export async function uploadMaintenanceInvoice(
  agencyId: string,
  maintenanceItemId: string,
  localUri: string
): Promise<string> {
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${agencyId}/${maintenanceItemId}/facture-${Date.now()}.${extension}`;

  await uploadFile(MAINTENANCE_DOCUMENTS_BUCKET, path, localUri, contentType);
  return path;
}
