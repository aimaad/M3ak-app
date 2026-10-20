// M3ak — envoi des notifications sur le téléphone (service Expo Push).
//
// Appelée par un Database Webhook (INSERT sur public.notifications), jamais par l'application.
// Sécurité : le webhook doit envoyer l'en-tête « x-webhook-secret » égal au secret PUSH_WEBHOOK_SECRET
// (sinon 401) ; les jetons des téléphones ne sont lus qu'avec le rôle service, côté serveur.
// Le texte est écrit dans la langue choisie par le destinataire (notification_preferences.locale).
//
// Secrets à définir : PUSH_WEBHOOK_SECRET (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { renderPush, type Locale } from './texts.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type NotificationRecord = {
  id: string;
  recipient_id: string;
  agency_id: string;
  kind: string;
  severity: string;
  params: Record<string, unknown>;
  link_type: string | null;
  link_id: string | null;
  pushed_at: string | null;
  dismissed_at: string | null;
};

Deno.serve(async (request) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || request.headers.get('x-webhook-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  let payload: { record?: NotificationRecord };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const record = payload.record;
  if (!record?.id || !record.recipient_id) return json({ error: 'bad_request' }, 400);
  if (record.pushed_at || record.dismissed_at) return json({ skipped: 'already_handled' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('push_enabled, locale')
    .eq('user_id', record.recipient_id)
    .eq('agency_id', record.agency_id)
    .maybeSingle();
  if (prefs && prefs.push_enabled === false) return json({ skipped: 'push_disabled' });

  const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', record.recipient_id);
  if (!tokens || tokens.length === 0) return json({ skipped: 'no_device' });

  const locale: Locale = prefs?.locale === 'ar' ? 'ar' : 'fr';
  const text = renderPush(record.kind, record.params ?? {}, locale);
  const messages = tokens.map(({ token }: { token: string }) => ({
    to: token,
    title: text.title,
    body: text.body,
    sound: 'default',
    priority: record.severity === 'urgent' ? 'high' : 'default',
    channelId: record.severity === 'urgent' ? 'urgent' : 'default',
    data: { notificationId: record.id, linkType: record.link_type, linkId: record.link_id },
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!response.ok) return json({ error: 'push_service_error', status: response.status }, 502);

  // Un téléphone désinstallé / déconnecté est retiré de la liste.
  const result = (await response.json()) as { data?: { status: string; details?: { error?: string } }[] };
  const dead: string[] = [];
  (result.data ?? []).forEach((ticket, index) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') dead.push(tokens[index].token);
  });
  if (dead.length > 0) await supabase.from('push_tokens').delete().in('token', dead);

  await supabase.from('notifications').update({ pushed_at: new Date().toISOString() }).eq('id', record.id);
  return json({ sent: messages.length - dead.length });
});
