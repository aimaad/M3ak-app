// M3ak — Mode vocal temps réel (prototype) : délivre un JETON ÉPHÉMÈRE pour se connecter directement à Gemini Live.
//
// Sécurité :
//   * l'appelant est authentifié et membre d'une entreprise ; le chat doit être activé et une clé Gemini enregistrée pour CETTE
//     entreprise (console admin-web) ; sinon aucun jeton ;
//   * le jeton est à usage unique, court, et VERROUILLÉ : modèle, consigne (selon le rôle), voix (liste blanche), outils et
//     détection de parole ne peuvent pas être changés par l'app ;
//   * limites : durée d'une session, minutes par utilisateur et par jour, minutes par agence et par jour (secrets réglables) ;
//   * la clé Gemini n'est jamais renvoyée ni journalisée ; l'audio ne passe pas par nos serveurs et n'est pas enregistré.
// Deux actions : « start » (par défaut) et « end » (clôture : durée et tokens, pour les limites et le coût).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { GoogleGenAI, Modality } from 'npm:@google/genai@3.0.0';

import {
  cleanCount,
  cleanLiveVoice,
  liveAllowance,
  liveCostUsd,
  liveLimitsFrom,
  liveThinkingConfig,
  liveSystemPrompt,
  liveToolDeclarations,
  pickLiveModel,
  type LiveSessionRow,
  type Role,
} from '../chat-m3ak/logic.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const TOKEN_OPEN_SECONDS = 60; // le jeton doit servir à ouvrir la session dans la minute
const GRACE_SECONDS = 10;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

const modelCache = new Map<string, { at: number; model: string | null }>();

/** Modèle Live le plus récent disponible pour cette clé (liste réelle de Google), mémorisé 10 minutes. `LIVE_MODEL` force un modèle. */
async function liveModelFor(apiKey: string): Promise<string | null> {
  const forced = Deno.env.get('LIVE_MODEL');
  if (forced) return forced.replace(/^models\//, '');
  const cacheKey = apiKey.slice(-8);
  const cached = modelCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.model;
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const model = pickLiveModel(data.models ?? []);
    modelCache.set(cacheKey, { at: Date.now(), model });
    return model;
  } catch {
    return null;
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

  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.length > 2_000) return json({ ok: false, error: 'invalid_request' }, 400);
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);
  const userId = userData.user.id;

  const { data: membership } = await supabase.from('agency_members').select('agency_id, role').eq('user_id', userId).limit(1).maybeSingle();
  if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);
  const agencyId: string = membership.agency_id;
  const role: Role = membership.role === 'owner' || membership.role === 'manager' ? (membership.role as Role) : 'employee';
  const limits = liveLimitsFrom((name) => Deno.env.get(name));

  // ---- Clôture : durée et tokens (déclarés par l'app ; bornés), pour les limites et le coût estimé.
  if (body.action === 'end') {
    const sessionId = typeof body.sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(body.sessionId) ? body.sessionId : null;
    if (!sessionId) return json({ ok: false, error: 'invalid_request' }, 400);
    const seconds = Math.min(cleanCount(body.seconds, 86_400), limits.sessionSeconds + GRACE_SECONDS);
    const inputTokens = cleanCount(body.inputTokens, 50_000_000);
    const outputTokens = cleanCount(body.outputTokens, 50_000_000);
    const reason = typeof body.reason === 'string' ? body.reason.replace(/[^a-z_]/g, '').slice(0, 40) : null;
    const { error } = await admin
      .from('chat_live_sessions')
      .update({ ended_at: new Date().toISOString(), seconds, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: liveCostUsd(inputTokens, outputTokens), ended_reason: reason })
      .eq('id', sessionId)
      .eq('user_id', userId)
      .is('ended_at', null);
    if (error) console.error('live: clôture non enregistrée', error.code);
    return json({ ok: true, costUsd: liveCostUsd(inputTokens, outputTokens) });
  }

  // ---- Ouverture : chat activé, clé de l'entreprise, limites, puis jeton verrouillé.
  const { data: settings } = await admin.from('agency_ocr_settings').select('chat_enabled, gemini_api_key').eq('agency_id', agencyId).maybeSingle();
  if (!settings?.gemini_api_key) return json({ ok: false, error: 'ocr_not_configured' });
  if (!settings.chat_enabled) return json({ ok: false, error: 'chat_disabled' });
  const apiKey: string = settings.gemini_api_key;

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error: rowsError } = await admin.from('chat_live_sessions').select('user_id, started_at, ended_at, seconds').eq('agency_id', agencyId).gte('started_at', since);
  if (rowsError) {
    console.error('live: sessions illisibles', rowsError.code);
    return json({ ok: false, error: 'live_unavailable', detail: 'migration_0064_missing' });
  }
  const allowance = liveAllowance((rows ?? []) as LiveSessionRow[], userId, now, limits);
  if (allowance.allowed <= 0) return json({ ok: false, error: 'live_limit', reason: allowance.reason });

  const model = await liveModelFor(apiKey);
  if (!model) return json({ ok: false, error: 'live_unavailable', detail: 'no_live_model' });
  const voice = cleanLiveVoice(body.voice);
  const thinking = liveThinkingConfig(model, Deno.env.get('LIVE_THINKING_LEVEL'));

  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now.getTime() + (allowance.allowed + GRACE_SECONDS) * 1000).toISOString(),
        newSessionExpireTime: new Date(now.getTime() + TOKEN_OPEN_SECONDS * 1000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            ...(thinking ? { thinkingConfig: thinking } : {}),
            systemInstruction: liveSystemPrompt(now, role),
            tools: liveToolDeclarations(),
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            realtimeInputConfig: {
              automaticActivityDetection: {
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_HIGH',
                prefixPaddingMs: 100,
                silenceDurationMs: 500,
              },
            },
          },
        },
      },
    });
    if (!token.name) throw new Error('empty_token');

    const { data: session, error: insertError } = await admin
      .from('chat_live_sessions')
      .insert({ agency_id: agencyId, user_id: userId, model, voice })
      .select('id')
      .single();
    if (insertError || !session) throw new Error(`session_not_saved:${insertError?.code ?? 'none'}`);

    console.log('live: jeton délivré', { modele: model, voix: voice, secondes: allowance.allowed });
    // Le jeton est la seule chose sensible renvoyée (courte durée, usage unique) : jamais la clé de l'entreprise.
    return json({ ok: true, token: token.name, model, voice, sessionId: session.id, maxSeconds: allowance.allowed, role, thinkingLevel: thinking?.thinkingLevel ?? null });
  } catch (error) {
    const detail = error instanceof Error ? error.message.split(apiKey).join('[clé]') : 'unknown';
    console.error('live: jeton non créé', detail.slice(0, 200));
    return json({ ok: false, error: 'live_unavailable', detail: detail.slice(0, 160) });
  }
});
