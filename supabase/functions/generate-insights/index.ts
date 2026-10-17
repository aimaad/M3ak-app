// M3ak — indicateurs et recommandations proposés par l'IA (Google Gemini) pour la page d'accueil.
//
// Ce que cette fonction reçoit : UNIQUEMENT des statistiques agrégées calculées par l'app (compteurs, totaux, quelques
// libellés « marque modèle » de véhicules). Jamais de photo ni aucune donnée personnelle ou identifiant de client ou de
// véhicule. Elle reconstruit elle-même les données envoyées à Gemini à partir d'une liste blanche.
//
// Conditions pour appeler Gemini (sinon réponse explicite, aucun appel) :
//   1. l'appelant est authentifié, membre d'une entreprise, avec le rôle propriétaire ou responsable ;
//   2. l'opérateur M3AK a enregistré une clé Gemini pour CETTE entreprise ;
//   3. le propriétaire a activé « Recommandations IA » (insights_enabled).
// Les chiffres d'argent ne sont acceptés que du propriétaire. Limite : 20 appels par entreprise et par 24 h.
// Aucune clé globale, aucun autre fournisseur ; la clé n'est jamais renvoyée ni journalisée.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { callGeminiJson, ProviderHttpError, StageTimeoutError, type Usage } from '../_shared/gemini.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_BODY_CHARS = 16_000;
const DAILY_LIMIT = 20;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

async function withTimeout<T>(stage: string, promise: PromiseLike<T>, ms = 15_000): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StageTimeoutError(stage)), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- données envoyées (liste blanche)

const num = (value: unknown, min = -1e9, max = 1e9): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value * 100) / 100)) : null;

const label = (value: unknown, max = 60): string | null =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) || null : null;

function pick(source: unknown, keys: string[]): Record<string, number | null> {
  const record = (typeof source === 'object' && source !== null ? source : {}) as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, num(record[key])]));
}

function sanitizePayload(raw: unknown, role: 'owner' | 'manager') {
  const payload = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const vehicles = (Array.isArray(payload.vehicles) ? payload.vehicles : []).slice(0, 8).map((item) => {
    const v = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    return {
      label: label(v.label),
      occupancyPct: num(v.occupancyPct, 0, 100),
      ...(role === 'owner' ? { revenue: num(v.revenue), maintenanceCost: num(v.maintenanceCost) } : {}),
    };
  });

  const result: Record<string, unknown> = {
    fleet: pick(payload.fleet, ['total', 'available', 'occupancyMonthPct']),
    vehicles,
    rentals: pick(payload.rentals, ['active', 'lateReturns', 'pendingConfirmation', 'upcoming7Days', 'cancellationRatePct', 'averageDurationDays']),
    maintenance: pick(payload.maintenance, ['overdue', 'due', 'inProgress']),
  };
  if (role === 'owner') {
    const money = (typeof payload.money === 'object' && payload.money !== null ? payload.money : {}) as Record<string, unknown>;
    result.money = {
      ...pick(money, ['revenueMonth', 'revenuePreviousMonth', 'changePct', 'outstandingTotal', 'outstandingCount', 'profit30d', 'maintenanceCostMonth', 'averageBasket']),
      revenueTrend: (Array.isArray(money.revenueTrend) ? money.revenueTrend : []).slice(0, 6).map((n) => num(n)),
      currency: 'MAD',
    };
  }
  return result;
}

// ---------------------------------------------------------------- consigne et réponse

function systemPrompt(role: 'owner' | 'manager', language: 'fr' | 'ar'): string {
  const languageRule =
    language === 'ar'
      ? "Écris en arabe simple et clair (compréhensible au Maroc), sans jargon."
      : 'Écris en français simple et clair, sans jargon ni anglicisme.';
  const scope =
    role === 'owner'
      ? "Tu t'adresses au PROPRIÉTAIRE : revenus, soldes à encaisser, rentabilité, utilisation de la flotte, entretien."
      : "Tu t'adresses au RESPONSABLE de flotte : exploitation, utilisation de la flotte, retards, entretien. Tu n'as AUCUN chiffre d'argent : n'en évoque pas.";
  return `Tu es un conseiller de gestion pour une agence de location de voitures au Maroc. ${scope}
Tu reçois des statistiques agrégées (JSON). ${languageRule}

Règles strictes :
- Utilise UNIQUEMENT les données reçues. N'invente aucun chiffre, aucun nom, aucune cause certaine.
- Si les données sont insuffisantes (peu de locations, mois à peine commencé), dis-le et reste prudent.
- Chaque recommandation doit être concrète et réalisable cette semaine, avec la raison tirée des données.
- Ne cite aucune donnée personnelle. Ne promets aucun résultat.

Réponds UNIQUEMENT avec un objet JSON valide, sans balises markdown, de cette forme exacte :
{
  "summary": "2 à 3 phrases sur la situation",
  "indicators": [ { "label": "…", "value": "…", "trend": "up" | "down" | "flat", "explanation": "…" } ],
  "recommendations": [ { "title": "…", "detail": "…", "priority": "high" | "medium" | "low", "area": "revenue" | "fleet" | "maintenance" | "operations" | "customers" } ]
}
« indicators » : au plus 4 indicateurs que TU déduis des données (ex. tendance, risque, estimation prudente), jamais un simple recopiage.
« recommendations » : au plus 5, de la plus urgente à la moins urgente.`;
}

const TRENDS = ['up', 'down', 'flat'];
const PRIORITIES = ['high', 'medium', 'low'];
const AREAS = ['revenue', 'fleet', 'maintenance', 'operations', 'customers'];
const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) || null : null;

function sanitizeInsights(raw: unknown, role: 'owner' | 'manager') {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const indicators = (Array.isArray(source.indicators) ? source.indicators : []).slice(0, 4).flatMap((item) => {
    const i = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const l = text(i.label, 60);
    const v = text(i.value, 40);
    return l && v ? [{ label: l, value: v, trend: TRENDS.includes(String(i.trend)) ? i.trend : 'flat', explanation: text(i.explanation, 200) }] : [];
  });
  const recommendations = (Array.isArray(source.recommendations) ? source.recommendations : []).slice(0, 5).flatMap((item) => {
    const r = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    const title = text(r.title, 80);
    const detail = text(r.detail, 300);
    // Un responsable ne reçoit jamais de recommandation financière.
    const area = AREAS.includes(String(r.area)) && !(role === 'manager' && r.area === 'revenue') ? r.area : 'operations';
    return title && detail ? [{ title, detail, priority: PRIORITIES.includes(String(r.priority)) ? r.priority : 'medium', area }] : [];
  });
  return { summary: text(source.summary, 500), indicators, recommendations };
}

// ---------------------------------------------------------------- suivi d'utilisation (compteurs seulement)

type AdminClient = ReturnType<typeof createClient>;

async function recordUsage(admin: AdminClient, agencyId: string, ok: boolean, errorCode?: string, model?: string, usage?: Usage) {
  try {
    await withTimeout(
      'usage',
      admin.from('ocr_usage_events').insert({
        agency_id: agencyId,
        document_type: 'insights',
        ok,
        error_code: errorCode ?? null,
        model: model ?? null,
        input_tokens: usage?.inputTokens ?? 0,
        output_tokens: usage?.outputTokens ?? 0,
      }),
      5_000
    );
  } catch {
    // volontairement silencieux
  }
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

  let apiKey: string;
  let agencyId: string;
  let role: 'owner' | 'manager';
  try {
    const { data: userData, error: userError } = await withTimeout('auth', supabase.auth.getUser());
    if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);

    const { data: membership } = await withTimeout(
      'membership',
      supabase.from('agency_members').select('agency_id, role').eq('user_id', userData.user.id).limit(1).maybeSingle()
    );
    if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);
    if (membership.role !== 'owner' && membership.role !== 'manager') return json({ ok: false, error: 'not_allowed' }, 403);
    role = membership.role;
    agencyId = membership.agency_id;

    const { data: settings } = await withTimeout(
      'settings',
      admin.from('agency_ocr_settings').select('insights_enabled, gemini_api_key').eq('agency_id', agencyId).maybeSingle()
    );
    if (!settings?.gemini_api_key) return json({ ok: false, error: 'ocr_not_configured' });
    if (!settings.insights_enabled) return json({ ok: false, error: 'insights_disabled' });
    apiKey = settings.gemini_api_key;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await withTimeout(
      'limit',
      admin.from('ocr_usage_events').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('document_type', 'insights').gte('created_at', since)
    );
    if ((count ?? 0) >= DAILY_LIMIT) return json({ ok: false, error: 'insights_limit' });
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    throw error;
  }

  let body: Record<string, unknown>;
  try {
    const raw = await withTimeout('body', request.text(), 20_000);
    if (raw.length > MAX_BODY_CHARS) return json({ ok: false, error: 'invalid_request' }, 400);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: 'stage:body' });
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const language = body.language === 'ar' ? 'ar' : 'fr';
  const data = sanitizePayload(body.payload, role);

  try {
    const result = await callGeminiJson(apiKey, systemPrompt(role, language), [
      { text: `Statistiques de l'agence (JSON) :\n${JSON.stringify(data)}` },
    ]);
    const insights = sanitizeInsights(result.json, role);
    if (!insights.summary && insights.recommendations.length === 0 && insights.indicators.length === 0) {
      await recordUsage(admin, agencyId, false, 'empty', result.model, result.usage);
      return json({ ok: false, error: 'ocr_failed' });
    }
    await recordUsage(admin, agencyId, true, undefined, result.model, result.usage);
    return json({ ok: true, insights });
  } catch (error) {
    if (error instanceof StageTimeoutError) {
      await recordUsage(admin, agencyId, false, 'ocr_timeout');
      return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    }
    const detail = error instanceof ProviderHttpError ? `provider_${error.status}: ${error.message}` : error instanceof Error ? error.message : 'unknown';
    console.error("Échec des recommandations IA :", detail.slice(0, 160));
    await recordUsage(admin, agencyId, false, error instanceof ProviderHttpError ? `provider_${error.status}` : 'ocr_failed');
    const busy = error instanceof ProviderHttpError && (error.status === 503 || error.status === 429);
    return json({ ok: false, error: busy ? 'ocr_busy' : 'ocr_failed', detail: detail.slice(0, 200) });
  }
});
