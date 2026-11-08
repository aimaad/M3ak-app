import { FunctionsHttpError } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';

import type { ChatAnswer, ChatCard, ChatCardItem, ChatConversation, ChatMessage, ChatSource } from './types';

export type ChatErrorCode = 'voice_unintelligible' | 'voice_too_long' | 'voice_failed' | 'chat_disabled' | 'ocr_not_configured' | 'ocr_busy' | 'ocr_quota' | 'ocr_timeout' | 'chat_limit' | 'chat_no_answer' | 'ocr_failed' | 'unavailable';

export class ChatError extends Error {
  constructor(public code: ChatErrorCode) {
    super(code);
  }
}

const KNOWN: ChatErrorCode[] = ['voice_unintelligible', 'voice_too_long', 'voice_failed', 'chat_disabled', 'ocr_not_configured', 'ocr_busy', 'ocr_quota', 'ocr_timeout', 'chat_limit', 'chat_no_answer'];
const asCode = (raw: unknown): ChatErrorCode => (KNOWN.includes(raw as ChatErrorCode) ? (raw as ChatErrorCode) : 'ocr_failed');
const TIMEOUT_MS = 115_000;

export function parseSources(raw: unknown): ChatSource[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const source = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
    return source.type === 'rental' && typeof source.id === 'string' && typeof source.label === 'string'
      ? [{ type: 'rental' as const, id: source.id, label: source.label }]
      : [];
  });
}

const TONES = ['free', 'late', 'rented', 'pending'] as const;
const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** Relit les cartes de données reçues du serveur (défense en profondeur : forme vérifiée avant affichage). */
export function parseCards(raw: unknown): ChatCard[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const card = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
    if ((card.type !== 'vehicles' && card.type !== 'rentals') || !Array.isArray(card.items)) return [];
    const items = card.items.flatMap((item): ChatCardItem[] => {
      const row = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>;
      const id = text(row.id);
      const title = text(row.title);
      if (!id || !title || (row.kind !== 'vehicle' && row.kind !== 'rental')) return [];
      return [{
        kind: row.kind,
        id,
        title,
        plate: text(row.plate),
        customer: text(row.customer),
        date: text(row.date),
        tone: (TONES as readonly unknown[]).includes(row.tone) ? (row.tone as ChatCardItem['tone']) : 'rented',
      }];
    });
    return items.length ? [{ type: card.type, items: items.slice(0, 8) }] : [];
  });
}

type ChatInput = {
  message: string;
  conversationId: string | null;
  language: 'fr' | 'ar';
  /** Conversation neuve : identifiant créé par l'app (le même à chaque nouvel essai : jamais de doublon) et titre court. */
  newConversationId?: string;
  title?: string;
  /** Question posée à la voix : `message` est la transcription ; l'audio (déjà envoyé et transcrit) est rattaché au message. */
  voice?: boolean;
  audioPath?: string;
  audioMs?: number;
  /** Réponse en direct : reçoit le texte déjà écrit (cumulé) au fil de l'eau. Le texte final fait foi (même valeur que `answer`). */
  onText?: (text: string) => void;
};

type AnswerBody = { ok?: boolean; error?: unknown; conversationId?: unknown; answer?: unknown; sources?: unknown; cards?: unknown } | null;

function answerFromBody(body: AnswerBody): ChatAnswer {
  if (body?.ok && typeof body.conversationId === 'string' && typeof body.answer === 'string') {
    return { conversationId: body.conversationId, answer: body.answer, sources: parseSources(body.sources), cards: parseCards(body.cards) };
  }
  throw new ChatError(asCode(body?.error));
}

/**
 * Réponse en flux (SSE) : le serveur envoie le texte au fur et à mesure puis un événement final. Rend `null` si le flux n'a pas
 * pu démarrer (téléphone ou réseau sans flux) : l'appelant retombe alors sur l'appel classique, qui donne la même réponse.
 */
async function askChatStream(payload: Omit<ChatInput, 'onText'>, onText: (text: string) => void): Promise<ChatAnswer | null> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!url || !anonKey || !token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    const { fetch: streamingFetch } = await import('expo/fetch');
    response = (await streamingFetch(`${url}/functions/v1/chat-m3ak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, apikey: anonKey },
      body: JSON.stringify({ ...payload, stream: true }),
      signal: controller.signal,
    })) as unknown as Response;
  } catch {
    clearTimeout(timer);
    return null;
  }
  try {
    if (response.status === 404) throw new ChatError('unavailable');
    if (!(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
      // Refus avant le flux (non connecté, chat désactivé, requête invalide…) : réponse JSON classique.
      return answerFromBody((await response.json().catch(() => null)) as AnswerBody);
    }
    if (!response.body) return null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let final: AnswerBody = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      let end = pending.indexOf('\n\n');
      while (end >= 0) {
        const line = pending.slice(0, end).split('\n').find((l) => l.startsWith('data:'));
        pending = pending.slice(end + 2);
        if (line) {
          const event = (() => {
            try {
              return JSON.parse(line.slice(5).trim()) as { type?: string; text?: unknown } & Record<string, unknown>;
            } catch {
              return null;
            }
          })();
          if (event?.type === 'text' && typeof event.text === 'string') onText(event.text);
          else if (event?.type === 'done') final = event as AnswerBody;
        }
        end = pending.indexOf('\n\n');
      }
    }
    if (!final) throw new ChatError('ocr_failed');
    return answerFromBody(final);
  } catch (error) {
    if (error instanceof ChatError) throw error;
    throw new ChatError(controller.signal.aborted ? 'ocr_timeout' : 'unavailable');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pose une question à la fonction serveur `chat-m3ak` (IA avec la clé de l'entreprise, données de l'agence lues
 * avec les droits de l'utilisateur). Le serveur refuse tant que le propriétaire n'a pas activé le chat.
 * Avec `onText`, la réponse arrive en direct (flux) ; sinon, ou si le flux est impossible, un seul appel classique.
 */
export async function askChat(input: ChatInput): Promise<ChatAnswer> {
  const { onText, ...payload } = input;
  if (onText) {
    const streamed = await askChatStream(payload, onText);
    if (streamed) return streamed;
  }
  let outcome: Awaited<ReturnType<ReturnType<typeof getSupabase>['functions']['invoke']>> | 'timeout';
  try {
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS));
    outcome = await Promise.race([getSupabase().functions.invoke('chat-m3ak', { body: payload }), timeout]);
  } catch {
    throw new ChatError('unavailable');
  }
  if (outcome === 'timeout') throw new ChatError('ocr_timeout');

  const { data, error } = outcome;
  if (error) {
    if (error instanceof FunctionsHttpError) {
      if (error.context.status === 404) throw new ChatError('unavailable');
      const parsed = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
      throw new ChatError(asCode(parsed?.error));
    }
    throw new ChatError('unavailable');
  }
  return answerFromBody(data as AnswerBody);
}

/** Lit un texte à voix haute avec une voix naturelle (côté serveur, clé IA de l'entreprise). Rend un fichier WAV en base64. */
export async function synthesizeSpeech(text: string): Promise<string> {
  let outcome: Awaited<ReturnType<ReturnType<typeof getSupabase>['functions']['invoke']>> | 'timeout';
  try {
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 40_000));
    outcome = await Promise.race([getSupabase().functions.invoke('chat-m3ak', { body: { action: 'speak', text } }), timeout]);
  } catch {
    throw new ChatError('unavailable');
  }
  if (outcome === 'timeout') throw new ChatError('ocr_timeout');
  const { data, error } = outcome;
  if (error) throw new ChatError('unavailable');
  const body = data as { ok?: boolean; error?: unknown; audio?: unknown } | null;
  if (body?.ok && typeof body.audio === 'string' && body.audio) return body.audio;
  throw new ChatError(asCode(body?.error));
}

/** Transcrit un message vocal déjà envoyé dans le stockage privé (côté serveur, avec la clé IA de l'entreprise). */
export async function transcribeAudio(input: { audioPath: string; hint: 'auto' | 'darija' | 'fr' }): Promise<string> {
  let outcome: Awaited<ReturnType<ReturnType<typeof getSupabase>['functions']['invoke']>> | 'timeout';
  try {
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 60_000));
    outcome = await Promise.race([getSupabase().functions.invoke('chat-m3ak', { body: { action: 'transcribe', ...input } }), timeout]);
  } catch {
    throw new ChatError('unavailable');
  }
  if (outcome === 'timeout') throw new ChatError('ocr_timeout');
  const { data, error } = outcome;
  if (error) {
    if (error instanceof FunctionsHttpError) {
      if (error.context.status === 404) throw new ChatError('unavailable');
      const parsed = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
      throw new ChatError(asCode(parsed?.error));
    }
    throw new ChatError('unavailable');
  }
  const body = data as { ok?: boolean; error?: unknown; transcript?: unknown } | null;
  if (body?.ok && typeof body.transcript === 'string' && body.transcript.trim()) return body.transcript.trim();
  throw new ChatError(asCode(body?.error));
}

/** Clé de traduction du message d'erreur, jamais un code ou un texte technique. */
export function chatErrorMessageKey(error: unknown): string {
  const code = error instanceof ChatError ? error.code : 'unavailable';
  switch (code) {
    case 'voice_unintelligible':
      return 'chat.errors.voiceUnintelligible';
    case 'voice_too_long':
      return 'chat.errors.voiceTooLong';
    case 'voice_failed':
      return 'chat.errors.voiceFailed';
    case 'chat_disabled':
    case 'ocr_not_configured':
      return 'chat.errors.inactive';
    case 'ocr_busy':
      return 'chat.errors.busy';
    case 'ocr_quota':
      return 'chat.errors.quota';
    case 'ocr_timeout':
      return 'chat.errors.timeout';
    case 'chat_limit':
      return 'chat.errors.limit';
    case 'chat_no_answer':
      return 'chat.errors.noAnswer';
    case 'unavailable':
      return 'chat.errors.unavailable';
    default:
      return 'chat.errors.failed';
  }
}

const flatten = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Historique : les conversations qui ont au moins un message (les conversations vides laissées par un envoi échoué sont
 * ignorées), avec l'aperçu de la dernière réponse de BIBIP.
 */
export async function listConversations(): Promise<ChatConversation[]> {
  const run = (columns: string) =>
    getSupabase()
      .from('chat_conversations')
      .select(columns)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false, referencedTable: 'chat_convo_messages' })
      .limit(2, { referencedTable: 'chat_convo_messages' })
      .limit(100);
  const embed = 'chat_convo_messages!inner(role, content, created_at)';
  let { data, error } = await run(`id, title, updated_at, via_voice, ${embed}`);
  // Colonne « via_voice » pas encore installée (migration 0063) : on relit sans.
  if (error && (error.code === '42703' || error.code === 'PGRST204')) ({ data, error } = await run(`id, title, updated_at, ${embed}`));
  if (error) throw error;
  type Row = { id: string; title: string; updated_at: string; via_voice?: boolean; chat_convo_messages: { role: string; content: string }[] };
  return ((data ?? []) as unknown as Row[]).map((row) => {
    const answer = row.chat_convo_messages?.find((m) => m.role === 'assistant');
    return { id: row.id, title: row.title, updatedAt: row.updated_at, preview: answer ? flatten(answer.content).slice(0, 160) : null, viaVoice: row.via_voice === true };
  });
}

export async function renameConversation(input: { id: string; title: string }): Promise<void> {
  const { error } = await getSupabase().from('chat_conversations').update({ title: input.title.trim().slice(0, 120) }).eq('id', input.id);
  if (error) throw error;
}

/** Identifiants des conversations dont le titre ou un message contient le texte (fonction `chat_search`, migration 0061). */
export async function searchConversationIds(query: string): Promise<string[]> {
  const { data, error } = await getSupabase().rpc('chat_search', { p_query: query });
  if (error) throw error;
  return Array.isArray(data) ? (data as unknown[]).filter((id): id is string => typeof id === 'string') : [];
}

type MessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: unknown;
  cards?: unknown;
  audio_path?: string | null;
  audio_ms?: number | null;
  via_voice?: boolean;
  created_at: string;
};

const MESSAGE_COLUMNS = [
  'id, role, content, sources, cards, audio_path, audio_ms, via_voice, created_at',
  'id, role, content, sources, cards, created_at',
  'id, role, content, sources, created_at',
];

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const query = (columns: string) => getSupabase().from('chat_convo_messages').select(columns).eq('conversation_id', conversationId).order('created_at', { ascending: true }).limit(200);
  let data: unknown = null;
  let error: { code?: string } | null = null;
  // Colonnes ajoutées par les migrations 0062 (cartes) et 0063 (vocal) : si l'une manque encore, on relit avec moins de colonnes.
  for (const columns of MESSAGE_COLUMNS) {
    ({ data, error } = await query(columns));
    if (!error || (error.code !== '42703' && error.code !== 'PGRST204')) break;
  }
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    sources: parseSources(row.sources),
    cards: parseCards(row.cards),
    audioPath: row.audio_path ?? null,
    audioMs: row.audio_ms ?? null,
    viaVoice: row.via_voice === true,
    createdAt: row.created_at,
  }));
}

export const CHAT_AUDIO_BUCKET = 'chat-audio';
export const MAX_AUDIO_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Envoie l'enregistrement dans le stockage privé (dossier de l'utilisateur). Le serveur le transcrit ensuite. */
export async function uploadVoiceMessage(localUri: string, path: string, contentType: string): Promise<void> {
  const response = await fetch(localUri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AUDIO_UPLOAD_BYTES) throw new ChatError('voice_too_long');
  const { error } = await getSupabase().storage.from(CHAT_AUDIO_BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
}

/** Supprime la conversation ET les fichiers audio de ses messages vocaux (le serveur reprend ceux qui auraient échappé). */
export async function deleteConversation(id: string): Promise<void> {
  try {
    const { data } = await getSupabase().from('chat_convo_messages').select('audio_path').eq('conversation_id', id).not('audio_path', 'is', null);
    const paths = ((data ?? []) as { audio_path: string | null }[]).flatMap((row) => (row.audio_path ? [row.audio_path] : []));
    if (paths.length > 0) await getSupabase().storage.from(CHAT_AUDIO_BUCKET).remove(paths);
  } catch {
    // Colonne absente ou réseau : la file de nettoyage du serveur supprimera les fichiers.
  }
  const { error } = await getSupabase().from('chat_conversations').delete().eq('id', id);
  if (error) throw error;
}
