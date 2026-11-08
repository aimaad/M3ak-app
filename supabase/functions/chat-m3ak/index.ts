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
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

import { callGeminiJson, ProviderHttpError, StageTimeoutError, type Usage } from '../_shared/gemini.ts';
import {
  audioMimeFor,
  buildCards,
  cleanTranscript,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_MS,
  MAX_TOOL_STEPS,
  parseModelStep,
  pickSources,
  redactMoneyText,
  resultForRole,
  seenRentals,
  systemPrompt,
  toRpcCall,
  transcriptionPrompt,
  validateAudioPath,
  type Role,
  type VoiceHint,
} from './logic.ts';

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

/** Supprime les fichiers audio des messages effacés (file `chat_audio_cleanup`) : par lots, sans jamais bloquer une réponse. */
async function cleanupAudio(admin: AdminClient) {
  try {
    const { data } = await withTimeout('cleanup', admin.from('chat_audio_cleanup').select('id, path').order('created_at').limit(20), 4_000);
    const rows = (data ?? []) as { id: string; path: string }[];
    if (rows.length === 0) return;
    await withTimeout('cleanup', admin.storage.from('chat-audio').remove(rows.map((row) => row.path)), 6_000);
    await withTimeout('cleanup', admin.from('chat_audio_cleanup').delete().in('id', rows.map((row) => row.id)), 4_000);
  } catch {
    // volontairement silencieux : la file sera reprise à la prochaine requête
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
  let role: Role = 'employee';
  let apiKey: string;
  try {
    const { data: userData, error: userError } = await withTimeout('auth', supabase.auth.getUser());
    if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);
    userId = userData.user.id;

    const { data: membership } = await withTimeout('membership', supabase.from('agency_members').select('agency_id, role').eq('user_id', userId).limit(1).maybeSingle());
    if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);
    agencyId = membership.agency_id;
    // Rôle inconnu = le plus restrictif : jamais de montants pour un non-propriétaire.
    role = membership.role === 'owner' || membership.role === 'manager' ? (membership.role as Role) : 'employee';

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
  await cleanupAudio(admin);

  // Action « transcribe » : transcrit un message vocal (stocké dans le bucket privé) avec la clé Gemini de l'entreprise.
  if (body.action === 'transcribe') {
    const path = validateAudioPath(userId, body.audioPath);
    if (!path) return json({ ok: false, error: 'invalid_request' }, 400);
    const hint: VoiceHint = body.hint === 'fr' || body.hint === 'darija' ? body.hint : 'auto';
    try {
      const file = await withTimeout('audio', admin.storage.from('chat-audio').download(path), 20_000);
      if (file.error || !file.data) return json({ ok: false, error: 'voice_failed' });
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      if (bytes.length === 0) return json({ ok: false, error: 'voice_unintelligible' });
      if (bytes.length > MAX_AUDIO_BYTES) return json({ ok: false, error: 'voice_too_long' });
      const result = await callGeminiJson(apiKey, transcriptionPrompt(hint), [{ inlineData: { mimeType: audioMimeFor(path), data: base64Encode(bytes) } }, { text: 'Transcris cet enregistrement.' }], { perCallTimeoutMs: 30_000 });
      await recordUsage(admin, agencyId, true, undefined, result.model, result.usage);
      const transcript = cleanTranscript(result.json);
      if (!transcript) return json({ ok: false, error: 'voice_unintelligible' });
      return json({ ok: true, transcript });
    } catch (error) {
      if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
      const detail = error instanceof ProviderHttpError ? `provider_${error.status}: ${error.message}` : error instanceof Error ? error.message : 'unknown';
      console.error('Échec de la transcription :', detail.slice(0, 160));
      await recordUsage(admin, agencyId, false, error instanceof ProviderHttpError ? `provider_${error.status}` : 'ocr_failed');
      return json({ ok: false, error: error instanceof ProviderHttpError && error.status === 429 ? 'ocr_quota' : error instanceof ProviderHttpError && error.status === 503 ? 'ocr_busy' : 'voice_failed' });
    }
  }

  // Question posée à la voix : le texte est la transcription ; l'audio (déjà transcrit) est rattaché au message.
  const voice = body.voice === true;
  const audioPath = voice ? validateAudioPath(userId, body.audioPath) : null;
  const audioMs = audioPath && typeof body.audioMs === 'number' && Number.isFinite(body.audioMs) ? Math.min(Math.max(Math.round(body.audioMs), 0), MAX_AUDIO_MS) : null;
  const question = typeof body.message === 'string' ? body.message.replace(/\u0000/g, '').trim().slice(0, MAX_QUESTION_CHARS) : '';
  if (!question) return json({ ok: false, error: 'invalid_request' }, 400);
  const language = body.language === 'ar' ? 'ar' : 'fr';

  // Conversation : celle de l'utilisateur (RLS) ou une nouvelle. Une conversation NEUVE n'est enregistrée qu'avec sa réponse
  // (plus de conversation vide si l'IA échoue) ; son identifiant peut venir de l'app (`newConversationId`), ce qui rend
  // l'envoi réessayable sans doublon.
  const requestedId = typeof body.conversationId === 'string' && UUID.test(body.conversationId) ? body.conversationId : null;
  const proposedId = typeof body.newConversationId === 'string' && UUID.test(body.newConversationId) ? body.newConversationId : null;
  const proposedTitle = typeof body.title === 'string' ? body.title.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const wantedId = requestedId ?? proposedId;
  const conversationId: string = wantedId ?? crypto.randomUUID();
  let newConversation: { id: string; title: string } | null = null;
  const history: { role: string; content: string }[] = [];
  try {
    let found = false;
    if (wantedId) {
      const { data: conversation } = await withTimeout('conversation', supabase.from('chat_conversations').select('id').eq('id', wantedId).maybeSingle());
      found = !!conversation;
      if (found) {
        const { data: previous } = await withTimeout(
          'history',
          supabase.from('chat_convo_messages').select('role, content').eq('conversation_id', wantedId).order('created_at', { ascending: false }).limit(HISTORY_MESSAGES)
        );
        history.push(...((previous ?? []) as { role: string; content: string }[]).reverse());
      }
    }
    // Pas encore enregistrée (premier message, ou envoi précédent resté sans réponse) : elle est créée avec la réponse.
    if (!found) newConversation = { id: conversationId, title: proposedTitle || question.slice(0, 80) };
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    throw error;
  }

  const started = Date.now();
  console.log('chat: question reçue', { langue: language, conversation: newConversation ? 'nouvelle' : 'existante' });
  const prompt = systemPrompt(new Date(), language, role, voice);
  const results: unknown[] = [];
  const executed: { tool: string; data: unknown }[] = [];
  let showHint: string | undefined;
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
      const result = await callGeminiJson(apiKey, prompt, parts, { qualityFirst: true, perCallTimeoutMs: 15_000 });
      model = result.model;
      totalUsage = { inputTokens: totalUsage.inputTokens + result.usage.inputTokens, outputTokens: totalUsage.outputTokens + result.usage.outputTokens };

      const next = parseModelStep(result.json);
      console.log('chat: tour', step, next.kind, next.kind === 'tools' ? next.calls.map((c) => c.tool).join(',') : '', `${Date.now() - started} ms`);
      if (next.kind === 'answer') {
        answer = redactMoneyText(next.answer, role);
        sourceIds = next.sourceIds;
        showHint = next.show;
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
        // Pour le responsable et l'employé : aucun montant ne sort de cette boucle (ni vers le modèle, ni vers l'écran).
        const visible = resultForRole(requested.tool, data, role);
        results.push(visible);
        executed.push({ tool: requested.tool, data: visible });
        console.log('chat: outil', requested.tool, Array.isArray(visible) ? `${visible.length} lignes` : 'résultat');
        transcript.push(`Outil ${requested.tool} ${JSON.stringify(requested.args)} → ${JSON.stringify(visible).slice(0, 8_000)}`);
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
  // Cartes de données : lignes réelles des outils, jamais du texte du modèle.
  const cards = buildCards(executed, showHint);
  try {
    if (newConversation) {
      const base = { id: newConversation.id, agency_id: agencyId, user_id: userId, title: newConversation.title };
      let { error: createError } = await withTimeout('save', supabase.from('chat_conversations').insert(voice ? { ...base, via_voice: true } : base));
      // Colonne « via_voice » pas encore installée (migration 0063) : on crée sans.
      if (createError && (createError.code === '42703' || createError.code === 'PGRST204')) ({ error: createError } = await withTimeout('save', supabase.from('chat_conversations').insert(base)));
      if (createError) {
        console.error('chat: conversation non enregistrée', createError.code, createError.message);
        return json({ ok: false, error: 'chat_save_failed' });
      }
    }
    // Les deux lignes ont les mêmes colonnes (« sources » est obligatoire en base). `cards` existe depuis la migration 0062 :
    // si elle n'est pas encore appliquée, on enregistre sans (la réponse reste affichée avec ses cartes).
    const rows = (withCards: boolean, withVoice: boolean) => [
      {
        conversation_id: conversationId, agency_id: agencyId, user_id: userId, role: 'user', content: question, sources: [],
        ...(withCards ? { cards: [] } : {}),
        ...(withVoice && audioPath ? { audio_path: audioPath, audio_ms: audioMs, via_voice: true } : {}),
      },
      { conversation_id: conversationId, agency_id: agencyId, user_id: userId, role: 'assistant', content: answer, sources, ...(withCards ? { cards } : {}) },
    ];
    // Colonnes ajoutées par les migrations 0062 (cartes) et 0063 (vocal) : si l'une manque encore, on enregistre sans.
    const missing = (code?: string) => code === '42703' || code === 'PGRST204';
    let saved = await withTimeout('save', supabase.from('chat_convo_messages').insert(rows(true, true)));
    if (missing(saved.error?.code)) saved = await withTimeout('save', supabase.from('chat_convo_messages').insert(rows(true, false)));
    if (missing(saved.error?.code)) saved = await withTimeout('save', supabase.from('chat_convo_messages').insert(rows(false, false)));
    if (saved.error) console.error('chat: historique non enregistré', saved.error.code, saved.error.message);
    await withTimeout('save', supabase.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId));
  } catch (error) {
    // La réponse est quand même donnée ; seul l'historique manquera.
    console.error('chat: historique non enregistré', error instanceof Error ? error.message : 'erreur');
  }
  await recordUsage(admin, agencyId, true, undefined, model, totalUsage);
  return json({ ok: true, conversationId, answer, sources, cards });
});
