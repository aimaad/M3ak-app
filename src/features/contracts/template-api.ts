import { getSupabase } from '@/lib/supabase';

import { ensureSignatures, parseTemplate, type ContractTemplate } from './template';

export type StoredTemplate = { template: ContractTemplate; updatedAt: string };

/** Modèle de contrat de l'agence, ou null (= modèle M3ak standard). Un contenu invalide est traité comme absent. */
export async function getContractTemplate(agencyId: string): Promise<StoredTemplate | null> {
  const { data, error } = await getSupabase().from('agency_contract_templates').select('template, updated_at').eq('agency_id', agencyId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const template = parseTemplate(data.template);
  return template ? { template: ensureSignatures(template), updatedAt: data.updated_at } : null;
}

export async function saveContractTemplate(agencyId: string, template: ContractTemplate): Promise<void> {
  const valid = parseTemplate(template);
  if (!valid) throw new Error('invalid_template');
  const { error } = await getSupabase()
    .from('agency_contract_templates')
    .upsert({ agency_id: agencyId, template: ensureSignatures(valid), source_name: null }, { onConflict: 'agency_id' });
  if (error) throw error;
}

/** Revient au modèle M3ak standard (supprime le modèle de l'agence). */
export async function removeContractTemplate(agencyId: string): Promise<void> {
  const { error } = await getSupabase().from('agency_contract_templates').delete().eq('agency_id', agencyId);
  if (error) throw error;
}
