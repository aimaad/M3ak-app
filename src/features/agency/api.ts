import { getSupabase } from '@/lib/supabase';

import type { AgencyMembership, AgencyRole } from './types';

type AgencyMembersRow = {
  agency_id: string;
  role: AgencyRole;
  agency: { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
};

export async function getMyAgencyMembership(): Promise<AgencyMembership | null> {
  const supabase = getSupabase();
  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('agency_members')
    .select('agency_id, role, agency:agencies(nom, ville)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle<AgencyMembersRow>();

  if (error) throw error;
  if (!data) return null;

  const agency = Array.isArray(data.agency) ? data.agency[0] : data.agency;

  return {
    agencyId: data.agency_id,
    role: data.role,
    agencyName: agency?.nom ?? '',
    agencyCity: agency?.ville ?? null,
  };
}
