import { FunctionsHttpError } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';

import type { ChatAnswer, ChatConversation, ChatMessage, ChatSource } from './types';

export type ChatErrorCode = 'chat_disabled' | 'ocr_not_configured' | 'ocr_busy' | 'ocr_quota' | 'ocr_timeout' | 'chat_limit' | 'chat_no_answer' | 'ocr_failed' | 'unavailable';

export class ChatError extends Error {
  constructor(public code: ChatErrorCode) {
    super(code);
  }
}

const KNOWN: ChatErrorCode[] = ['chat_disabled', 'ocr_not_configured', 'ocr_busy', 'ocr_quota', 'ocr_timeout', 'chat_limit', 'chat_no_answer'];
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

/**
 * Pose une question à la fonction serveur `chat-m3ak` (IA avec la clé de l'entreprise, données de l'agence lues
 * avec les droits de l'utilisateur). Le serveur refuse tant que le propriétaire n'a pas activé le chat.
 */
export async function askChat(input: {
  message: string;
  conversationId: string | null;
  language: 'fr' | 'ar';
  /** Conversation neuve : identifiant créé par l'app (le même à chaque nouvel essai : jamais de doublon) et titre court. */
  newConversationId?: string;
  title?: string;
}): Promise<ChatAnswer> {
  let outcome: Awaited<ReturnType<ReturnType<typeof getSupabase>['functions']['invoke']>> | 'timeout';
  try {
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS));
    outcome = await Promise.race([getSupabase().functions.invoke('chat-m3ak', { body: input }), timeout]);
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
  const body = data as { ok?: boolean; error?: unknown; conversationId?: unknown; answer?: unknown; sources?: unknown } | null;
  if (body?.ok && typeof body.conversationId === 'string' && typeof body.answer === 'string') {
    return { conversationId: body.conversationId, answer: body.answer, sources: parseSources(body.sources) };
  }
  throw new ChatError(asCode(body?.error));
}

/** Clé de traduction du message d'erreur, jamais un code ou un texte technique. */
export function chatErrorMessageKey(error: unknown): string {
  const code = error instanceof ChatError ? error.code : 'unavailable';
  switch (code) {
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
  const { data, error } = await getSupabase()
    .from('chat_conversations')
    .select('id, title, updated_at, chat_convo_messages!inner(role, content, created_at)')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false, referencedTable: 'chat_convo_messages' })
    .limit(2, { referencedTable: 'chat_convo_messages' })
    .limit(100);
  if (error) throw error;
  type Row = { id: string; title: string; updated_at: string; chat_convo_messages: { role: string; content: string }[] };
  return ((data ?? []) as unknown as Row[]).map((row) => {
    const answer = row.chat_convo_messages?.find((m) => m.role === 'assistant');
    return { id: row.id, title: row.title, updatedAt: row.updated_at, preview: answer ? flatten(answer.content).slice(0, 160) : null };
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

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await getSupabase()
    .from('chat_convo_messages')
    .select('id, role, content, sources, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return ((data ?? []) as { id: string; role: 'user' | 'assistant'; content: string; sources: unknown; created_at: string }[]).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    sources: parseSources(row.sources),
    createdAt: row.created_at,
  }));
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await getSupabase().from('chat_conversations').delete().eq('id', id);
  if (error) throw error;
}
