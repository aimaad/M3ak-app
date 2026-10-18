import { FunctionsHttpError } from '@supabase/supabase-js';

import { buildFullName, type PersonName } from '@/features/auth/names';
import { uploadFile, uploadFileWithProgress, type UploadProgress } from '@/features/storage/api';
import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import { logoContentType } from './logo-validation';
import type {
  AgencyDetails,
  AgencyDetailsInput,
  AgencyInvite,
  AgencyMember,
  AgencyMembership,
  AgencyRole,
  CreateInviteInput,
  InviteResult,
  MemberProfile,
  MemberProfileInput,
} from './types';

export const AGENCY_ASSETS_BUCKET = 'agency-assets';
export const MEMBER_AVATARS_BUCKET = 'member-avatars';

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
  stamp_path: string | null;
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
    stampPath: row.stamp_path,
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
  owner: PersonName
): Promise<AgencyMembership> {
  const ownerName = buildFullName(owner);
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
    prenom: owner.prenom.trim(),
    nom: owner.nom.trim(),
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

type AgencyMemberRow = {
  id: string;
  user_id: string;
  role: AgencyRole;
  nom_complet: string | null;
  branch_id: string | null;
  branch: { nom: string } | { nom: string }[] | null;
};

function memberFromRow(row: AgencyMemberRow): AgencyMember {
  const branch = Array.isArray(row.branch) ? row.branch[0] : row.branch;
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    nomComplet: row.nom_complet,
    branchId: row.branch_id,
    branchNom: branch?.nom ?? null,
  };
}

export async function listAgencyMembers(agencyId: string): Promise<AgencyMember[]> {
  const { data, error } = await getSupabase()
    .from('agency_members')
    .select('id, user_id, role, nom_complet, branch_id, branch:branches(nom)')
    .eq('agency_id', agencyId);

  if (error) throw error;
  return (data as AgencyMemberRow[]).map(memberFromRow);
}

type AgencyInviteRow = {
  id: string;
  agency_id: string;
  email: string | null;
  prenom: string | null;
  nom: string | null;
  role: AgencyRole;
  branch_id: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export async function listAgencyInvites(agencyId: string): Promise<AgencyInvite[]> {
  const { data, error } = await getSupabase()
    .from('agency_invites')
    .select('id, agency_id, email, prenom, nom, role, branch_id, expires_at, used_at, revoked_at, created_at')
    .eq('agency_id', agencyId)
    .not('email', 'is', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as AgencyInviteRow[]).map((row) => ({
    id: row.id,
    agencyId: row.agency_id,
    email: row.email ?? '',
    prenom: row.prenom,
    nom: row.nom,
    role: row.role,
    branchId: row.branch_id,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  }));
}

type InvitePayload = {
  id: string;
  code: string;
  email: string;
  prenom: string;
  nom: string;
  role: AgencyRole;
  branch_name: string | null;
  agency_name: string;
  inviter_name: string | null;
  expires_at: string;
};

type InviteFunctionResponse = {
  invite: InvitePayload;
  emailSent: boolean;
  emailError: string | null;
};

function resultFromPayload(payload: InvitePayload, emailSent: boolean, emailError: string | null): InviteResult {
  return {
    inviteId: payload.id,
    code: payload.code,
    email: payload.email,
    prenom: payload.prenom,
    nom: payload.nom,
    role: payload.role,
    agencyName: payload.agency_name,
    branchName: payload.branch_name,
    inviterName: payload.inviter_name,
    expiresAt: payload.expires_at,
    emailSent,
    emailError,
  };
}

/**
 * Appelle la fonction serveur « send-invite » (création + envoi de l'e-mail).
 * Renvoie null si elle n'est pas déployée / injoignable : l'appelant retombe alors
 * sur la fonction SQL directe (sans e-mail, partage WhatsApp / copie seulement).
 * Les refus métier (droits, doublon…) sont remontés comme des erreurs à code court.
 */
async function callInviteFunction(body: Record<string, unknown>): Promise<InviteFunctionResponse | null> {
  const { data, error } = await getSupabase().functions.invoke('send-invite', { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      if (error.context.status === 404) return null;
      const parsed = (await error.context.json().catch(() => null)) as { error?: string } | null;
      throw new Error(parsed?.error ?? 'invite_failed');
    }
    return null;
  }
  return data as InviteFunctionResponse;
}

export async function createAgencyInvite(input: CreateInviteInput): Promise<InviteResult> {
  const viaFunction = await callInviteFunction({ action: 'create', ...input });
  if (viaFunction) {
    return resultFromPayload(viaFunction.invite, viaFunction.emailSent, viaFunction.emailError);
  }

  const { data, error } = await getSupabase().rpc('create_agency_invite', {
    p_agency_id: input.agencyId,
    p_email: input.email,
    p_prenom: input.prenom,
    p_nom: input.nom,
    p_role: input.role,
    p_branch_id: input.branchId,
  });
  if (error) throw new Error(error.message);
  return resultFromPayload(data as InvitePayload, false, 'function_unavailable');
}

export async function resendAgencyInvite(inviteId: string): Promise<InviteResult> {
  const viaFunction = await callInviteFunction({ action: 'resend', inviteId });
  if (viaFunction) {
    return resultFromPayload(viaFunction.invite, viaFunction.emailSent, viaFunction.emailError);
  }

  const { data, error } = await getSupabase().rpc('resend_agency_invite', { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
  return resultFromPayload(data as InvitePayload, false, 'function_unavailable');
}

export async function revokeAgencyInvite(inviteId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoke_agency_invite', { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
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

export async function uploadAgencyLogo(
  agencyId: string,
  localUri: string,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal
): Promise<AgencyDetails> {
  const contentType = logoContentType({ uri: localUri, mimeType: null }) ?? 'image/jpeg';
  const extension = contentType === 'image/png' ? 'png' : 'jpg';
  // Nom unique à chaque envoi : l'ancien logo ne reste pas affiché (image mise en cache sous l'ancien nom).
  const path = `${agencyId}/logo-${Date.now()}.${extension}`;

  const { data: before } = await getSupabase().from('agencies').select('logo_url').eq('id', agencyId).maybeSingle();
  const previousPath = (before as { logo_url: string | null } | null)?.logo_url ?? null;

  if (onProgress) await uploadFileWithProgress(AGENCY_ASSETS_BUCKET, path, localUri, contentType, onProgress, signal);
  else await uploadFile(AGENCY_ASSETS_BUCKET, path, localUri, contentType);

  const { data, error } = await getSupabase().from('agencies').update({ logo_url: path }).eq('id', agencyId).select().single();
  if (error) throw error;

  // Nettoyage de l'ancien fichier (sans importance s'il échoue).
  if (previousPath && previousPath !== path) {
    getSupabase().storage.from(AGENCY_ASSETS_BUCKET).remove([previousPath]).catch(() => undefined);
  }
  return agencyFromRow(data as AgencyRow);
}

/** Cachet de l'agence (photo ou scan du tampon). Réservé au propriétaire (RLS + déclencheur de chemin). */
export async function uploadAgencyStamp(agencyId: string, localUri: string): Promise<AgencyDetails> {
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase();
  const isPng = extension === 'png';
  const path = `${agencyId}/stamp.${isPng ? 'png' : 'jpg'}`;

  await uploadFile(AGENCY_ASSETS_BUCKET, path, localUri, isPng ? 'image/png' : 'image/jpeg');

  const { data, error } = await getSupabase().from('agencies').update({ stamp_path: path }).eq('id', agencyId).select().single();
  if (error) throw error;
  return agencyFromRow(data as AgencyRow);
}

export async function removeAgencyStamp(agencyId: string): Promise<AgencyDetails> {
  const { data, error } = await getSupabase().from('agencies').update({ stamp_path: null }).eq('id', agencyId).select().single();
  if (error) throw error;
  return agencyFromRow(data as AgencyRow);
}

export async function updateMemberRole(memberId: string, role: AgencyRole): Promise<AgencyMember> {
  const { data, error } = await getSupabase()
    .from('agency_members')
    .update({ role })
    .eq('id', memberId)
    .select('id, user_id, role, nom_complet, branch_id, branch:branches(nom)')
    .single<AgencyMemberRow>();

  if (error) throw error;
  return memberFromRow(data);
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await getSupabase().from('agency_members').delete().eq('id', memberId);
  if (error) throw error;
}

// ======================================================================
// Profil du membre connecté
// ======================================================================

type MemberProfileRow = {
  id: string;
  agency_id: string;
  user_id: string;
  role: AgencyRole;
  prenom: string | null;
  nom: string | null;
  nom_complet: string | null;
  photo_path: string | null;
  signature_path: string | null;
  branch_id: string | null;
  branch: { nom: string } | { nom: string }[] | null;
  created_at: string;
};

function profileFromRow(row: MemberProfileRow): MemberProfile {
  const branch = Array.isArray(row.branch) ? row.branch[0] : row.branch;
  return {
    id: row.id,
    agencyId: row.agency_id,
    userId: row.user_id,
    role: row.role,
    prenom: row.prenom,
    nom: row.nom,
    nomComplet: row.nom_complet,
    photoPath: row.photo_path,
    signaturePath: row.signature_path,
    branchId: row.branch_id,
    branchNom: branch?.nom ?? null,
    createdAt: row.created_at,
  };
}

export async function getMyMemberProfile(agencyId: string): Promise<MemberProfile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await getSupabase()
    .from('agency_members')
    .select('id, agency_id, user_id, role, prenom, nom, nom_complet, photo_path, signature_path, branch_id, branch:branches(nom), created_at')
    .eq('agency_id', agencyId)
    .eq('user_id', userId)
    .maybeSingle<MemberProfileRow>();

  if (error) throw error;
  return data ? profileFromRow(data) : null;
}

export async function updateMyProfile(memberId: string, input: MemberProfileInput): Promise<MemberProfile> {
  const nomComplet = `${input.prenom.trim()} ${input.nom.trim()}`.trim();

  const { data, error } = await getSupabase()
    .from('agency_members')
    .update({ prenom: input.prenom.trim() || null, nom: input.nom.trim() || null, nom_complet: nomComplet || null })
    .eq('id', memberId)
    .select('id, agency_id, user_id, role, prenom, nom, nom_complet, photo_path, signature_path, branch_id, branch:branches(nom), created_at')
    .single<MemberProfileRow>();

  if (error) throw error;
  return profileFromRow(data);
}

export async function uploadMemberAvatar(agencyId: string, memberId: string, localUri: string): Promise<MemberProfile> {
  const userId = await getCurrentUserId();
  const extension = localUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const contentType = extension === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${agencyId}/${userId}/avatar-${Date.now()}.${extension}`;

  await uploadFile(MEMBER_AVATARS_BUCKET, path, localUri, contentType);

  const { data, error } = await getSupabase()
    .from('agency_members')
    .update({ photo_path: path })
    .eq('id', memberId)
    .select('id, agency_id, user_id, role, prenom, nom, nom_complet, photo_path, signature_path, branch_id, branch:branches(nom), created_at')
    .single<MemberProfileRow>();

  if (error) throw error;
  return profileFromRow(data);
}
