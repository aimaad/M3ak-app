import { uploadFile } from '@/features/storage/api';
import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import { generateInviteCode, inviteExpiryDate } from './invite-code';
import type {
  AgencyDetails,
  AgencyDetailsInput,
  AgencyInvite,
  AgencyMember,
  AgencyMembership,
  AgencyRole,
} from './types';

export const AGENCY_ASSETS_BUCKET = 'agency-assets';

type AgencyRow = {
  id: string;
  nom: string;
  raison_sociale: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  ville: string | null;
  pays: string;
  devise: string;
  logo_url: string | null;
  created_at: string;
};

function agencyFromRow(row: AgencyRow): AgencyDetails {
  return {
    id: row.id,
    nom: row.nom,
    raisonSociale: row.raison_sociale,
    email: row.email,
    telephone: row.telephone,
    adresse: row.adresse,
    ville: row.ville,
    pays: row.pays,
    devise: row.devise,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

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

export async function getAgencyDetails(agencyId: string): Promise<AgencyDetails> {
  const { data, error } = await getSupabase().from('agencies').select('*').eq('id', agencyId).single();
  if (error) throw error;
  return agencyFromRow(data as AgencyRow);
}

export async function updateAgencyDetails(
  agencyId: string,
  input: AgencyDetailsInput
): Promise<AgencyDetails> {
  const { data, error } = await getSupabase()
    .from('agencies')
    .update({
      nom: input.nom,
      raison_sociale: input.raisonSociale,
      email: input.email,
      telephone: input.telephone,
      adresse: input.adresse,
      ville: input.ville,
      pays: input.pays,
      devise: input.devise,
    })
    .eq('id', agencyId)
    .select()
    .single();

  if (error) throw error;
  return agencyFromRow(data as AgencyRow);
}

export async function uploadAgencyLogo(agencyId: string, localUri: string): Promise<AgencyDetails> {
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${agencyId}/logo.${extension}`;

  await uploadFile(AGENCY_ASSETS_BUCKET, path, localUri, contentType);

  const { data, error } = await getSupabase()
    .from('agencies')
    .update({ logo_url: path })
    .eq('id', agencyId)
    .select()
    .single();

  if (error) throw error;
  return agencyFromRow(data as AgencyRow);
}

export async function updateMemberRole(memberId: string, role: AgencyRole): Promise<AgencyMember> {
  const { data, error } = await getSupabase()
    .from('agency_members')
    .update({ role })
    .eq('id', memberId)
    .select('id, user_id, role, nom_complet')
    .single();

  if (error) throw error;
  return { id: data.id, userId: data.user_id, role: data.role, nomComplet: data.nom_complet };
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await getSupabase().from('agency_members').delete().eq('id', memberId);
  if (error) throw error;
}
