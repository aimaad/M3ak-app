import { uploadFile } from '@/features/storage/api';
import { VEHICLE_DOCUMENTS_BUCKET } from '@/features/vehicles/api';
import { getSupabase } from '@/lib/supabase';

import { DEFAULT_COMPLIANCE_SETTINGS, type ComplianceInput, type ComplianceKind, type ComplianceRecord, type ComplianceSettings } from './types';

type Row = {
  id: string;
  agency_id: string;
  vehicle_id: string;
  kind: ComplianceKind;
  valid_from: string | null;
  valid_until: string;
  reference: string | null;
  provider: string | null;
  amount: number | string | null;
  document_path: string | null;
  notes: string | null;
  period_months?: number | null;
  created_by: string | null;
  created_at: string;
};

const fromRow = (row: Row): ComplianceRecord => ({
  id: row.id,
  agencyId: row.agency_id,
  vehicleId: row.vehicle_id,
  kind: row.kind,
  validFrom: row.valid_from,
  validUntil: row.valid_until,
  reference: row.reference,
  provider: row.provider,
  amount: row.amount === null ? null : Number(row.amount),
  documentPath: row.document_path,
  notes: row.notes,
  periodMonths: row.period_months ?? null,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

/** Le même renouvellement enregistré deux fois (double appui, connexion lente) : contrainte d'unicité de la base. */
export const isAlreadyRecordedError = (error: unknown) => typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';

export async function listVehicleCompliance(vehicleId: string): Promise<ComplianceRecord[]> {
  const { data, error } = await getSupabase().from('vehicle_compliance').select('*').eq('vehicle_id', vehicleId).order('valid_until', { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

/** Toutes les périodes de l'agence (pour les listes et les alertes ; l'accès par filiale est appliqué par la base). */
export async function listAllCompliance(): Promise<ComplianceRecord[]> {
  const { data, error } = await getSupabase().from('vehicle_compliance').select('*').order('valid_until', { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function createComplianceRecord(agencyId: string, input: ComplianceInput): Promise<ComplianceRecord> {
  const { data, error } = await getSupabase()
    .from('vehicle_compliance')
    .insert({
      // L'agence est de toute façon remise à celle du véhicule par la base.
      agency_id: agencyId,
      vehicle_id: input.vehicleId,
      kind: input.kind,
      valid_from: input.validFrom,
      valid_until: input.validUntil,
      reference: input.reference,
      provider: input.provider,
      amount: input.amount,
      document_path: input.documentPath,
      notes: input.notes,
      ...(input.periodMonths != null ? { period_months: input.periodMonths } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data as Row);
}

export type ComplianceCorrection = Partial<Pick<ComplianceInput, 'validFrom' | 'validUntil' | 'reference' | 'provider' | 'amount' | 'documentPath' | 'notes'>>;

/** Correction d'une période de l'historique (propriétaire et responsable : la base refuse les autres). */
export async function updateComplianceRecord(id: string, patch: ComplianceCorrection): Promise<ComplianceRecord> {
  const row = {
    ...(patch.validFrom !== undefined ? { valid_from: patch.validFrom } : {}),
    ...(patch.validUntil !== undefined ? { valid_until: patch.validUntil } : {}),
    ...(patch.reference !== undefined ? { reference: patch.reference } : {}),
    ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
    ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
    ...(patch.documentPath !== undefined ? { document_path: patch.documentPath } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
  };
  const { data, error } = await getSupabase().from('vehicle_compliance').update(row).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data as Row);
}

export async function deleteComplianceRecord(id: string): Promise<void> {
  const { error } = await getSupabase().from('vehicle_compliance').delete().eq('id', id);
  if (error) throw error;
}

/** Photo du papier (attestation, procès-verbal, quittance) dans le stockage des documents du véhicule ; renvoie son chemin. */
export async function uploadComplianceDocument(agencyId: string, vehicleId: string, kind: ComplianceKind, localUri: string): Promise<string> {
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${agencyId}/${vehicleId}/${kind}-${Date.now()}.${extension}`;
  await uploadFile(VEHICLE_DOCUMENTS_BUCKET, path, localUri, contentType);
  return path;
}

export async function getComplianceSettings(agencyId: string): Promise<ComplianceSettings> {
  const { data, error } = await getSupabase().from('agency_compliance_settings').select('visit_interval_months').eq('agency_id', agencyId).maybeSingle();
  if (error) throw error;
  return data ? { visitIntervalMonths: Number((data as { visit_interval_months: number }).visit_interval_months) } : DEFAULT_COMPLIANCE_SETTINGS;
}

export async function saveComplianceSettings(agencyId: string, settings: ComplianceSettings): Promise<ComplianceSettings> {
  const { error } = await getSupabase().from('agency_compliance_settings').upsert({ agency_id: agencyId, visit_interval_months: settings.visitIntervalMonths, updated_at: new Date().toISOString() });
  if (error) throw error;
  return settings;
}
