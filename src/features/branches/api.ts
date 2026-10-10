import { getSupabase } from '@/lib/supabase';

import type { Branch, BranchInput } from './types';

type BranchRow = {
  id: string;
  agency_id: string;
  nom: string;
  ville: string | null;
  adresse: string | null;
  created_at: string;
};

function fromRow(row: BranchRow): Branch {
  return {
    id: row.id,
    agencyId: row.agency_id,
    nom: row.nom,
    ville: row.ville,
    adresse: row.adresse,
    createdAt: row.created_at,
  };
}

export async function listBranches(agencyId: string): Promise<Branch[]> {
  const { data, error } = await getSupabase()
    .from('branches')
    .select('*')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as BranchRow[]).map(fromRow);
}

export async function createBranch(agencyId: string, input: BranchInput): Promise<Branch> {
  const { data, error } = await getSupabase()
    .from('branches')
    .insert({ agency_id: agencyId, nom: input.nom, ville: input.ville, adresse: input.adresse })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as BranchRow);
}

export async function updateBranch(id: string, input: BranchInput): Promise<Branch> {
  const { data, error } = await getSupabase()
    .from('branches')
    .update({ nom: input.nom, ville: input.ville, adresse: input.adresse })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data as BranchRow);
}

export async function deleteBranch(id: string): Promise<void> {
  const { error } = await getSupabase().from('branches').delete().eq('id', id);
  if (error) throw error;
}
