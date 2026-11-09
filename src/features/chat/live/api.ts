import { FunctionsHttpError } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';

import { parseCards } from '../api';
import type { ChatCard } from '../types';
import type { LiveFailure } from './state';

/** Voix proposées dans l'écran (la liste complète est vérifiée côté serveur). */
export const LIVE_VOICES = ['Aoede', 'Kore', 'Puck'] as const;
export type LiveVoiceName = (typeof LIVE_VOICES)[number];

export class LiveError extends Error {
  constructor(
    public failure: LiveFailure,
    public reason?: string
  ) {
    super(failure);
  }
}

export type LiveToken = { token: string; model: string; voice: string; sessionId: string; maxSeconds: number; thinkingLevel: string | null };

type Body = Record<string, unknown> | null;

async function call(name: string, body: Record<string, unknown>, timeoutMs: number): Promise<Body> {
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs));
  let outcome: Awaited<ReturnType<ReturnType<typeof getSupabase>['functions']['invoke']>> | 'timeout';
  try {
    outcome = await Promise.race([getSupabase().functions.invoke(name, { body }), timeout]);
  } catch {
    throw new LiveError('unavailable');
  }
  if (outcome === 'timeout') throw new LiveError('timeout');
  if (outcome.error) {
    if (outcome.error instanceof FunctionsHttpError) {
      if (outcome.error.context.status === 404) throw new LiveError('unavailable');
      return (await outcome.error.context.json().catch(() => null)) as Body;
    }
    throw new LiveError('unavailable');
  }
  return outcome.data as Body;
}

/** Code d'erreur du serveur → raison affichée (jamais de texte technique). */
function failureOf(body: Body): LiveError {
  switch (body?.error) {
    case 'live_limit':
      return new LiveError('live_limit', typeof body.reason === 'string' ? body.reason : undefined);
    case 'ocr_not_configured':
      return new LiveError('not_configured');
    case 'chat_disabled':
      return new LiveError('disabled');
    default:
      return new LiveError('unavailable');
  }
}

/** Demande le jeton éphémère (la clé de l'entreprise reste sur le serveur). Profil « app » : mêmes outils que le chat écrit. */
export async function requestLiveToken(voice: string): Promise<LiveToken> {
  const body = await call('chat-live-token', { profile: 'app', voice }, 25_000);
  if (body?.ok && typeof body.token === 'string' && typeof body.model === 'string' && typeof body.sessionId === 'string') {
    return {
      token: body.token,
      model: body.model,
      voice: typeof body.voice === 'string' ? body.voice : voice,
      sessionId: body.sessionId,
      maxSeconds: typeof body.maxSeconds === 'number' ? body.maxSeconds : 600,
      thinkingLevel: typeof body.thinkingLevel === 'string' ? body.thinkingLevel : null,
    };
  }
  throw failureOf(body);
}

/** Clôture : durée et tokens (pour les limites de minutes et le coût). Sans effet sur l'expérience : une erreur est ignorée. */
export async function endLiveSession(input: { sessionId: string; seconds: number; inputTokens: number; outputTokens: number; reason: string }): Promise<void> {
  await call('chat-live-token', { action: 'end', ...input }, 10_000).catch(() => undefined);
}

/** Exécute un outil avec les droits de l'utilisateur (mêmes règles que le chat écrit : aucun montant hors propriétaire). */
export async function runLiveTool(name: string, args: Record<string, unknown>): Promise<{ result: unknown; cards: ChatCard[] } | null> {
  try {
    const body = await call('chat-tools', { tool: name, args }, 25_000);
    return body?.ok ? { result: body.result ?? null, cards: parseCards(body.cards) } : null;
  } catch {
    return null;
  }
}

/** Enregistre les sous-titres de la session dans l'historique du chat (texte seulement, jamais d'audio). */
export async function saveLiveConversation(input: { conversationId: string; title: string; lines: { role: 'user' | 'assistant'; content: string; cards: ChatCard[] }[] }): Promise<boolean> {
  try {
    const body = await call('chat-live-token', { action: 'save', ...input }, 20_000);
    return body?.ok === true && body.saved === true;
  } catch {
    return false;
  }
}
