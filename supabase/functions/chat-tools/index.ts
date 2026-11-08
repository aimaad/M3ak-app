// M3ak — Outils du mode vocal temps réel : exécute UN outil demandé par Gemini Live, avec les droits de l'utilisateur.
//
// Mêmes règles que le chat écrit (chat-m3ak), avec LE MÊME CODE (`../chat-m3ak/logic.ts`) pour qu'elles ne divergent jamais :
//   * l'appelant est authentifié, membre d'une entreprise, chat activé ;
//   * seul un outil de la liste blanche du mode vocal est accepté ; ses arguments sont validés (`toRpcCall`) ;
//   * l'outil s'exécute avec le JWT de l'utilisateur : la RLS (entreprise + filiale) s'applique, lecture seule ;
//   * AUCUN montant pour un responsable ou un employé (`resultForRole`) ; les cartes viennent des vrais résultats (`buildCards`).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { buildCards, LIVE_TOOLS, resultForRole, toRpcCall, type Role } from '../chat-m3ak/logic.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_RESULT_ROWS = 25;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? CORS_HEADERS['Access-Control-Allow-Headers'],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ ok: false, error: 'not_authenticated' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 2_000) return json({ ok: false, error: 'invalid_request' }, 400);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);
  const userId = userData.user.id;

  const { data: membership } = await supabase.from('agency_members').select('agency_id, role').eq('user_id', userId).limit(1).maybeSingle();
  if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);
  // Rôle inconnu = le plus restrictif : jamais de montants pour un non-propriétaire.
  const role: Role = membership.role === 'owner' || membership.role === 'manager' ? (membership.role as Role) : 'employee';

  const { data: settings } = await admin.from('agency_ocr_settings').select('chat_enabled').eq('agency_id', membership.agency_id).maybeSingle();
  if (!settings?.chat_enabled) return json({ ok: false, error: 'chat_disabled' });

  const tool = typeof body.tool === 'string' ? body.tool : '';
  if (!(LIVE_TOOLS as readonly string[]).includes(tool)) return json({ ok: false, error: 'tool_not_allowed' }, 400);
  const call = toRpcCall(tool, body.args);
  if (!call) return json({ ok: false, error: 'invalid_arguments' }, 400);

  const { data, error } = await supabase.rpc(call.fn, call.params);
  if (error) {
    console.error('Échec outil vocal :', call.fn, error.code);
    return json({ ok: false, error: 'tool_unavailable' });
  }
  const visible = resultForRole(tool, data, role);
  const cards = buildCards([{ tool, data: visible }], tool);
  console.log('live: outil', tool, Array.isArray(visible) ? `${visible.length} lignes` : 'résultat');
  // Le modèle reçoit au plus 25 lignes (déjà sans montants pour un non-propriétaire) ; la carte affichée vient du même résultat.
  return json({ ok: true, result: Array.isArray(visible) ? visible.slice(0, MAX_RESULT_ROWS) : visible, cards });
});
