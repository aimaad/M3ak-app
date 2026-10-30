import { getSignedUrl } from '@/features/storage/api';
import { getCurrentUserId, getSupabase } from '@/lib/supabase';

import { parseSignature, parseSignatureJson, type HandwrittenSignature } from './signature';

export const SIGNATURES_BUCKET = 'signatures';

export const staffSignaturePath = (agencyId: string, userId: string) => `${agencyId}/staff/${userId}.json`;
export const contractSignaturePath = (agencyId: string, contractId: string, who: 'client' | 'agence') =>
  `${agencyId}/contracts/${contractId}/${who}-${Date.now()}.json`;

async function putSignature(path: string, signature: HandwrittenSignature, upsert: boolean): Promise<void> {
  const valid = parseSignature(signature);
  if (!valid) throw new Error('invalid_signature');
  const bytes = new TextEncoder().encode(JSON.stringify(valid));
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { error } = await getSupabase().storage.from(SIGNATURES_BUCKET).upload(path, body, { contentType: 'application/json', upsert });
  if (error) throw error;
}

/** Relit une signature depuis le stockage ; null si le fichier est absent ou invalide. */
export async function loadSignature(path: string | null | undefined): Promise<HandwrittenSignature | null> {
  if (!path) return null;
  const url = await getSignedUrl(SIGNATURES_BUCKET, path);
  const response = await fetch(url);
  if (!response.ok) return null;
  return parseSignatureJson(await response.text());
}

/** Enregistre (ou remplace) la signature personnelle du membre connecté. */
export async function saveMySignature(agencyId: string, memberId: string, signature: HandwrittenSignature): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not_authenticated');
  const path = staffSignaturePath(agencyId, userId);
  await putSignature(path, signature, true);
  const { error } = await getSupabase().from('agency_members').update({ signature_path: path }).eq('id', memberId);
  if (error) throw error;
  return path;
}

export async function removeMySignature(agencyId: string, memberId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not_authenticated');
  const { error } = await getSupabase().from('agency_members').update({ signature_path: null }).eq('id', memberId);
  if (error) throw error;
  await getSupabase().storage.from(SIGNATURES_BUCKET).remove([staffSignaturePath(agencyId, userId)]);
}

/** Dépose les copies figées (client + agence) d'un contrat : ajout seul, jamais remplacées. */
export async function saveContractSignatures(
  agencyId: string,
  contractId: string,
  client: HandwrittenSignature,
  agency: HandwrittenSignature | null
): Promise<{ clientPath: string; agencyPath: string | null }> {
  const clientPath = contractSignaturePath(agencyId, contractId, 'client');
  await putSignature(clientPath, client, false);
  let agencyPath: string | null = null;
  if (agency) {
    agencyPath = contractSignaturePath(agencyId, contractId, 'agence');
    await putSignature(agencyPath, agency, false);
  }
  return { clientPath, agencyPath };
}
