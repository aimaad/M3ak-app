import type { AgencyRole } from '@/features/agency/types';
import { getSupabase } from '@/lib/supabase';

import type { ActivitySummaryRow, AuditCategory, AuditEntry } from './types';

type Row = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: AgencyRole | null;
  category: string | null;
  action: string;
  target_label: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const COLUMNS = 'id, actor_id, actor_name, actor_role, category, action, target_label, details, created_at';

export type AuditQuery = {
  agencyId: string;
  from: string | null;
  to: string | null;
  actorId: string | null;
  category: AuditCategory | null;
};

function fromRow(row: Row): AuditEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    category: row.category,
    action: row.action,
    targetLabel: row.target_label,
    details: row.details,
    createdAt: row.created_at,
  };
}

/** Une page du journal (du plus récent au plus ancien). La lecture n'est permise qu'au propriétaire (RLS). */
export async function listAuditEntries(query: AuditQuery, offset: number, limit: number): Promise<AuditEntry[]> {
  let request = getSupabase()
    .from('agency_audit_log')
    .select(COLUMNS)
    .eq('agency_id', query.agencyId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (query.from) request = request.gte('created_at', query.from);
  if (query.to) request = request.lt('created_at', query.to);
  if (query.actorId) request = request.eq('actor_id', query.actorId);
  if (query.category) request = request.eq('category', query.category);

  const { data, error } = await request;
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

export const EXPORT_MAX_ENTRIES = 2000;
const EXPORT_PAGE = 500;

/** Toutes les lignes de la sélection pour l'export PDF, plafonnées à EXPORT_MAX_ENTRIES (`truncated` si dépassé). */
export async function listAuditEntriesForExport(query: AuditQuery): Promise<{ entries: AuditEntry[]; truncated: boolean }> {
  const entries: AuditEntry[] = [];
  for (let offset = 0; offset < EXPORT_MAX_ENTRIES; offset += EXPORT_PAGE) {
    const page = await listAuditEntries(query, offset, EXPORT_PAGE);
    entries.push(...page);
    if (page.length < EXPORT_PAGE) return { entries, truncated: false };
  }
  return { entries, truncated: true };
}

export async function getActivitySummary(agencyId: string, from: string | null, to: string | null): Promise<ActivitySummaryRow[]> {
  const { data, error } = await getSupabase().rpc('audit_activity_summary', { p_agency_id: agencyId, p_from: from, p_to: to });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    actorId: typeof row.actor_id === 'string' ? row.actor_id : null,
    actorName: typeof row.actor_name === 'string' ? row.actor_name : '',
    actorRole: (row.actor_role as AgencyRole | null) ?? null,
    total: Number(row.total ?? 0),
    lastAt: typeof row.last_at === 'string' ? row.last_at : null,
    categories: (row.categories as Record<string, number> | null) ?? {},
  }));
}
