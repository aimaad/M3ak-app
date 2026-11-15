import { getSupabase } from '@/lib/supabase';

import type { DueRule, DueRuleKind } from './types';

type Row = { agency_id: string; kind: DueRuleKind; enabled: boolean; repeat_km: number | null; repeat_months: number | null };

export async function listDueRules(): Promise<DueRule[]> {
  const { data, error } = await getSupabase().from('agency_due_rules').select('*');
  if (error) throw error;
  return (data as Row[]).map((row) => ({ kind: row.kind, enabled: row.enabled, repeatKm: row.repeat_km, repeatMonths: row.repeat_months }));
}

/** Enregistre les règles modifiées (une ligne par règle ; le propriétaire et les responsables seulement, côté base aussi). */
export async function saveDueRules(agencyId: string, rules: DueRule[]): Promise<void> {
  const { error } = await getSupabase()
    .from('agency_due_rules')
    .upsert(
      rules.map((rule) => ({ agency_id: agencyId, kind: rule.kind, enabled: rule.enabled, repeat_km: rule.repeatKm, repeat_months: rule.repeatMonths, updated_at: new Date().toISOString() })),
      { onConflict: 'agency_id,kind' }
    );
  if (error) throw error;
}
