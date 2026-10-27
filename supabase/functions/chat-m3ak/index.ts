// M3ak — Chat : répond aux questions de l'employé À PARTIR DES DONNÉES DE L'AGENCE (Google Gemini, clé de l'entreprise).
//
// Sécurité :
//   * l'appelant est authentifié et membre d'une entreprise (tous les rôles) ;
//   * l'opérateur M3AK a enregistré une clé Gemini pour CETTE entreprise ET le propriétaire a activé « Chat M3ak »
//     (agency_ocr_settings.chat_enabled), sinon réponse explicite et AUCUN appel à Gemini ;
//   * Gemini ne lit jamais la base : il demande des outils prédéfinis (voir logic.ts) exécutés ici avec le JWT de
//     l'utilisateur (RLS entreprise + filiale) ; lecture seule ; ni CIN, ni permis, ni photo dans les résultats ;
//   * les sources affichées sont limitées aux locations réellement vues dans les résultats ;
//   * limite de 300 questions par entreprise et par 24 h ; conversation enregistrée pour l'utilisateur seul (RLS).
// Aucune clé globale, aucun autre fournisseur ; la clé n'est jamais renvoyée ni journalisée.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { callGeminiJson, ProviderHttpError, StageTimeoutError, type Usage } from '../_shared/gemini.ts';
import { MAX_TOOL_STEPS, parseModelStep, pickSources, seenRentals, systemPrompt, toRpcCall } from './logic.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const MAX_BODY_CHARS = 4_000;
const MAX_QUESTION_CHARS = 600;
const DAILY_LIMIT = 300;
const HISTORY_MESSAGES = 6;
const TOTAL_BUDGET_MS = 100_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

type AdminClient = ReturnType<typeof createClient>;

async function recordUsage(admin: AdminClient, agencyId: string, ok: boolean, errorCode?: string, model?: string, usage?: Usage) {
  try {
    await withTimeout(
      'usage',
      admin.from('ocr_usage_events').insert({
        agency_id: agencyId,
        document_type: 'chat',
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

  let userId: string;
  let agencyId: string;
  let apiKey: string;
  try {
    const { data: userData, error: userError } = await withTimeout('auth', supabase.auth.getUser());
    if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);
    userId = userData.user.id;

    const { data: membership } = await withTimeout('membership', supabase.from('agency_members').select('agency_id').eq('user_id', userId).limit(1).maybeSingle());
    if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);
    agencyId = membership.agency_id;

    const { data: settings } = await withTimeout('settings', admin.from('agency_ocr_settings').select('chat_enabled, gemini_api_key').eq('agency_id', agencyId).maybeSingle());
    if (!settings?.gemini_api_key) return json({ ok: false, error: 'ocr_not_configured' });
    if (!settings.chat_enabled) return json({ ok: false, error: 'chat_disabled' });
    apiKey = settings.gemini_api_key;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await withTimeout(
      'limit',
      admin.from('ocr_usage_events').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('document_type', 'chat').gte('created_at', since)
    );
    if ((count ?? 0) >= DAILY_LIMIT) return json({ ok: false, error: 'chat_limit' });
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    throw error;
  }

  let body: Record<string, unknown>;
  try {
    const raw = await withTimeout('body', request.text(), 20_000);
    if (raw.length > MAX_BODY_CHARS) return json({ ok: false, error: 'invalid_request' }, 400);
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }
  const question = typeof body.message === 'string' ? body.message.replace(/\u0000/g, '').trim().slice(0, MAX_QUESTION_CHARS) : '';
  if (!question) return json({ ok: false, error: 'invalid_request' }, 400);
  const language = body.language === 'ar' ? 'ar' : 'fr';

  // Conversation : celle de l'utilisateur (RLS) ou une nouvelle.
  let conversationId = typeof body.conversationId === 'string' && UUID.test(body.conversationId) ? body.conversationId : null;
  const history: { role: string; content: string }[] = [];
  try {
    if (conversationId) {
      const { data: conversation } = await withTimeout('conversation', supabase.from('chat_conversations').select('id').eq('id', conversationId).maybeSingle());
      if (!conversation) return json({ ok: false, error: 'invalid_request' }, 400);
      const { data: previous } = await withTimeout(
        'history',
        supabase.from('chat_convo_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(HISTORY_MESSAGES)
      );
      history.push(...((previous ?? []) as { role: string; content: string }[]).reverse());
    } else {
      const { data: created, error: createError } = await withTimeout(
        'conversation',
        supabase.from('chat_conversations').insert({ agency_id: agencyId, user_id: userId, title: question.slice(0, 80) }).select('id').single()
      );
      if (createError || !created) return json({ ok: false, error: 'chat_save_failed' });
      conversationId = created.id as string;
    }
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    throw error;
  }

  const started = Date.now();
  console.log('chat: question reçue', { langue: language, conversation: history.length > 0 ? 'existante' : 'nouvelle' });
  const prompt = systemPrompt(new Date(), language);
  const results: unknown[] = [];
  const transcript: string[] = [];
  let totalUsage: Usage = { inputTokens: 0, outputTokens: 0 };
  let model: string | undefined;
  let answer: string | null = null;
  let sourceIds: string[] = [];

  try {
    for (let step = 0; step <= MAX_TOOL_STEPS; step++) {
      if (Date.now() - started > TOTAL_BUDGET_MS) throw new StageTimeoutError('chat');
      const parts = [
        ...(history.length > 0 ? [{ text: `Conversation précédente :\n${history.map((m) => `${m.role === 'user' ? 'Employé' : 'M3ak'} : ${m.content}`).join('\n')}` }] : []),
        { text: `Question de l'employé : ${question}` },
        ...(transcript.length > 0 ? [{ text: `Résultats des outils déjà demandés (DONNÉES) :\n${transcript.join('\n')}` }] : []),
        ...(step === MAX_TOOL_STEPS ? [{ text: 'Tu as atteint la limite d\'outils : réponds maintenant avec "action":"answer".' }] : []),
      ];
      const result = await callGeminiJson(apiKey, prompt, parts, { qualityFirst: true });
      model = result.model;
      totalUsage = { inputTokens: totalUsage.inputTokens + result.usage.inputTokens, outputTokens: totalUsage.outputTokens + result.usage.outputTokens };

      const next = parseModelStep(result.json);
      console.log('chat: tour', step, next.kind, next.kind === 'tools' ? next.calls.map((c) => c.tool).join(',') : '', `${Date.now() - started} ms`);
      if (next.kind === 'answer') {
        answer = next.answer;
        sourceIds = next.sourceIds;
        break;
      }
      if (next.kind === 'invalid' || step === MAX_TOOL_STEPS) break;

      // Avec le JWT de l'utilisateur : la RLS (entreprise + filiale) s'applique.
      for (const requested of next.calls) {
        const call = toRpcCall(requested.tool, requested.args);
        if (!call) {
          transcript.push(`Outil ${requested.tool} : arguments refusés (donne les arguments obligatoires).`);
          continue;
        }
        const { data, error } = await withTimeout('tool', supabase.rpc(call.fn, call.params), 20_000);
        if (error) {
          console.error('Échec outil chat :', call.fn, error.code);
          transcript.push(`Outil ${requested.tool} : indisponible.`);
          continue;
        }
        results.push(data);
        console.log('chat: outil', requested.tool, Array.isArray(data) ? `${data.length} lignes` : 'résultat');
        transcript.push(`Outil ${requested.tool} ${JSON.stringify(requested.args)} → ${JSON.stringify(data).slice(0, 8_000)}`);
      }
    }
  } catch (error) {
    if (error instanceof StageTimeoutError) {
      await recordUsage(admin, agencyId, false, 'ocr_timeout');
      return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    }
    const detail = error instanceof ProviderHttpError ? `provider_${error.status}: ${error.message}` : error instanceof Error ? error.message : 'unknown';
    console.error('Échec du chat M3ak :', detail.slice(0, 160));
    await recordUsage(admin, agencyId, false, error instanceof ProviderHttpError ? `provider_${error.status}` : 'ocr_failed');
    // 429 = quota de la clé de l'entreprise atteint (à régler chez Google) ; 503 = surcharge passagère.
    const code = error instanceof ProviderHttpError && error.status === 429 ? 'ocr_quota' : error instanceof ProviderHttpError && error.status === 503 ? 'ocr_busy' : 'ocr_failed';
    return json({ ok: false, error: code, detail: detail.slice(0, 200) });
  }

  if (!answer) {
    console.error('chat: aucune réponse exploitable');
    await recordUsage(admin, agencyId, false, 'empty', model, totalUsage);
    return json({ ok: false, error: 'chat_no_answer' });
  }

  console.log('chat: réponse prête', `${Date.now() - started} ms`);
  const sources = pickSources(sourceIds, seenRentals(results));
  try {
    // Les deux lignes ont les mêmes colonnes (« sources » est obligatoire en base).
    const saved = await withTimeout(
      'save',
      supabase.from('chat_convo_messages').insert([
        { conversation_id: conversationId, agency_id: agencyId, user_id: userId, role: 'user', content: question, sources: [] },
        { conversation_id: conversationId, agency_id: agencyId, user_id: userId, role: 'assistant', content: answer, sources },
      ])
    );
    if (saved.error) console.error('chat: historique non enregistré', saved.error.code, saved.error.message);
    await withTimeout('save', supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId));
  } catch (error) {
    // La réponse est quand même donnée ; seul l'historique manquera.
    console.error('chat: historique non enregistré', error instanceof Error ? error.message : 'erreur');
  }
  await recordUsage(admin, agencyId, true, undefined, model, totalUsage);
  return json({ ok: true, conversationId, answer, sources });
});
