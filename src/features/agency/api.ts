import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import { generateInviteCode, inviteExpiryDate } from './invite-code';
import type { AgencyInvite, AgencyMember, AgencyMembership, AgencyRole } from './types';

type AgencyMembersRow = {
  agency_id: string;
  role: AgencyRole;
  nom_complet: string | null;
  agency: { nom: string; ville: string | null } | { nom: string; ville: string | null }[] | null;
};

export async function getMyAgencyMembership(): Promise<AgencyMembership | null> {
  const supabase = getSupabase();
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from('agency_members')
    .select('agency_id, role, nom_complet, agency:agencies(nom, ville)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle<AgencyMembersRow>();

  if (error) throw error;
  if (!data) return null;

  const agency = Array.isArray(data.agency) ? data.agency[0] : data.agency;

  return {
    agencyId: data.agency_id,
    role: data.role,
    memberName: data.nom_complet,
    agencyName: agency?.nom ?? '',
    agencyCity: agency?.ville ?? null,
  };
}

export async function createAgency(
  nom: string,
  ville: string | null,
  ownerName: string
): Promise<AgencyMembership> {
  const supabase = getSupabase();
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Non connecté');

  const { data: agency, error: agencyError } = await supabase
    .from('agencies')
    .insert({ nom, ville, created_by: userId })
    .select()
    .single();
  if (agencyError) throw agencyError;

  const { error: memberError } = await supabase.from('agency_members').insert({
    agency_id: agency.id,
    user_id: userId,
    role: 'owner',
    nom_complet: ownerName,
  });
  if (memberError) throw memberError;

  return {
    agencyId: agency.id,
    role: 'owner',
    memberName: ownerName,
    agencyName: agency.nom,
    agencyCity: agency.ville,
  };
}

export async function redeemInvite(code: string): Promise<AgencyRole> {
  const { data, error } = await getSupabase().rpc('redeem_invite', { invite_code: code });
  if (error) throw error;
  return data as AgencyRole;
}

export async function listAgencyMembers(agencyId: string): Promise<AgencyMember[]> {
  const { data, error } = await getSupabase()
    .from('agency_members')
    .select('id, user_id, role, nom_complet')
    .eq('agency_id', agencyId);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    nomComplet: row.nom_complet,
  }));
}

export async function listAgencyInvites(agencyId: string): Promise<AgencyInvite[]> {
  const { data, error } = await getSupabase()
    .from('agency_invites')
    .select('id, agency_id, code, role, expires_at, used_at, created_at')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    agencyId: row.agency_id,
    code: row.code,
    role: row.role,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  }));
}

export async function createAgencyInvite(agencyId: string, role: AgencyRole): Promise<AgencyInvite> {
  const supabase = getSupabase();
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('agency_invites')
    .insert({
      agency_id: agencyId,
      code: generateInviteCode(),
      role,
      created_by: userId,
      expires_at: inviteExpiryDate().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  return {
    id: data.id,
    agencyId: data.agency_id,
    code: data.code,
    role: data.role,
    expiresAt: data.expires_at,
    usedAt: data.used_at,
    createdAt: data.created_at,
  };
}
