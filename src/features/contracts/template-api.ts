import { getSupabase } from '@/lib/supabase';

import { defaultOptions, parseOptions, templateFromOptions, type ContractOptions } from './contract-options';
import { ensureSignatures, parseTemplate, type ContractTemplate } from './template';

export type StoredTemplate = { template: ContractTemplate; options: ContractOptions | null; updatedAt: string };

/** En-tête enregistré dans le modèle : les informations de l'agence sont lues à chaque contrat (champs automatiques). */
const AGENCY_LINES = ['{{agence_nom}}', '{{agence_adresse}}'];

/** Réglages et modèle de l'agence, ou null (= modèle M3ak standard). Un contenu invalide est traité comme absent. */
export async function getContractTemplate(agencyId: string): Promise<StoredTemplate | null> {
  const { data, error } = await getSupabase().from('agency_contract_templates').select('template, options, updated_at').eq('agency_id', agencyId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const template = parseTemplate(data.template);
  return template ? { template: ensureSignatures(template), options: parseOptions(data.options), updatedAt: data.updated_at } : null;
}

/** Enregistre les réglages ET le modèle qui en découle. */
export async function saveContractOptions(agencyId: string, options: ContractOptions): Promise<void> {
  const valid = parseOptions(options) ?? defaultOptions();
  const template = parseTemplate(templateFromOptions(valid, AGENCY_LINES));
  if (!template) throw new Error('invalid_template');
  const { error } = await getSupabase()
    .from('agency_contract_templates')
    .upsert({ agency_id: agencyId, template: ensureSignatures(template), options: valid, source_name: null }, { onConflict: 'agency_id' });
  if (error) throw error;
}

/** Revient au modèle M3ak standard (supprime les réglages de l'agence). */
export async function removeContractTemplate(agencyId: string): Promise<void> {
  const { error } = await getSupabase().from('agency_contract_templates').delete().eq('agency_id', agencyId);
  if (error) throw error;
}
