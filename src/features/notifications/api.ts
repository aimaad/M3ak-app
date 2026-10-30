import { getSupabase } from '@/lib/supabase';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type AppNotification,
  type NotificationCategory,
  type NotificationLinkType,
  type NotificationPreferences,
  type NotificationSeverity,
} from './types';

type Row = {
  id: string;
  agency_id: string;
  kind: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  params: Record<string, unknown> | null;
  link_type: NotificationLinkType | null;
  link_id: string | null;
  created_at: string;
};

const COLUMNS = 'id, agency_id, kind, category, severity, params, link_type, link_id, created_at';

function fromRow(row: Row): AppNotification {
  return {
    id: row.id,
    agencyId: row.agency_id,
    kind: row.kind,
    category: row.category,
    severity: row.severity,
    params: row.params ?? {},
    linkType: row.link_type,
    linkId: row.link_id,
    createdAt: row.created_at,
  };
}

/** Les notifications non masquées de l'utilisateur connecté (la base ne renvoie que les siennes). */
export async function listNotifications(agencyId: string): Promise<AppNotification[]> {
  const { data, error } = await getSupabase()
    .from('notifications')
    .select(COLUMNS)
    .eq('agency_id', agencyId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(fromRow);
}

/** « Supprimer » = masquer pour soi : la ligne des autres destinataires n'est pas touchée. */
export async function dismissNotification(id: string): Promise<void> {
  const { error } = await getSupabase().from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function dismissAllNotifications(agencyId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('agency_id', agencyId)
    .is('dismissed_at', null);
  if (error) throw error;
}

/** Annulation de « tout effacer » : remet à l'écran les notifications masquées (les miennes seulement, RLS). */
export async function restoreNotifications(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getSupabase().from('notifications').update({ dismissed_at: null }).in('id', ids);
  if (error) throw error;
}

type PrefsRow = { enabled: boolean; push_enabled: boolean; muted_categories: NotificationCategory[] | null; locale: 'fr' | 'ar' };

export async function getNotificationPreferences(agencyId: string, userId: string): Promise<NotificationPreferences> {
  const { data, error } = await getSupabase()
    .from('notification_preferences')
    .select('enabled, push_enabled, muted_categories, locale')
    .eq('agency_id', agencyId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;
  const row = data as PrefsRow;
  return { enabled: row.enabled, pushEnabled: row.push_enabled, mutedCategories: row.muted_categories ?? [], locale: row.locale };
}

export async function saveNotificationPreferences(
  agencyId: string,
  userId: string,
  prefs: NotificationPreferences,
  locale: 'fr' | 'ar'
): Promise<void> {
  const { error } = await getSupabase().from('notification_preferences').upsert(
    {
      user_id: userId,
      agency_id: agencyId,
      enabled: prefs.enabled,
      push_enabled: prefs.pushEnabled,
      muted_categories: prefs.mutedCategories,
      locale,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,agency_id' }
  );
  if (error) throw error;
}

export async function registerPushToken(token: string, userId: string, platform: string): Promise<void> {
  const { error } = await getSupabase()
    .from('push_tokens')
    .upsert({ token, user_id: userId, platform, updated_at: new Date().toISOString() }, { onConflict: 'token' });
  if (error) throw error;
}

export async function removePushToken(token: string): Promise<void> {
  const { error } = await getSupabase().from('push_tokens').delete().eq('token', token);
  if (error) throw error;
}
