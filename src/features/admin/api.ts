import { getSupabase } from '@/lib/supabase';

import { parseAgencyKeyRows, type AgencyOcrKeyRow } from './ocr-keys';

export async function isPlatformAdmin(): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_platform_admin');
  if (error) return false; // migration absente ou erreur réseau : on n'affiche rien
  return data === true;
}

export async function listOcrAgencies(): Promise<AgencyOcrKeyRow[]> {
  const { data, error } = await getSupabase().rpc('admin_list_ocr_agencies');
  if (error) throw error;
  return parseAgencyKeyRows(data);
}

export async function setOcrKey(agencyId: string, key: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_set_ocr_key', { p_agency_id: agencyId, p_key: key.trim() });
  if (error) throw error;
}

export async function clearOcrKey(agencyId: string): Promise<void> {
  const { error } = await getSupabase().rpc('admin_clear_ocr_key', { p_agency_id: agencyId });
  if (error) throw error;
}
