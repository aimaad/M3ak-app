import { FunctionsHttpError } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';

import { parseInsights, type AiInsights, type InsightsLanguage, type InsightsPayload } from './insights';

/**
 * Appelle la fonction serveur `generate-insights` (Gemini avec la clé de l'entreprise). Le serveur refuse tant que la
 * clé n'est pas configurée ou que le propriétaire n'a pas activé la fonction ; aucune clé n'est jamais dans l'app.
 */
export type InsightsErrorCode =
  | 'insights_disabled'
  | 'ocr_not_configured'
  | 'ocr_busy'
  | 'ocr_timeout'
  | 'insights_limit'
  | 'not_allowed'
  | 'ocr_failed'
  | 'unavailable';

export class InsightsError extends Error {
  constructor(public code: InsightsErrorCode) {
    super(code);
  }
}

const KNOWN: InsightsErrorCode[] = ['insights_disabled', 'ocr_not_configured', 'ocr_busy', 'ocr_timeout', 'insights_limit', 'not_allowed'];
const asCode = (raw: unknown): InsightsErrorCode => (KNOWN.includes(raw as InsightsErrorCode) ? (raw as InsightsErrorCode) : 'ocr_failed');
const TIMEOUT_MS = 70_000;

export async function fetchInsights(payload: InsightsPayload, language: InsightsLanguage): Promise<AiInsights> {
  let outcome: Awaited<ReturnType<ReturnType<typeof getSupabase>['functions']['invoke']>> | 'timeout';
  try {
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS));
    outcome = await Promise.race([getSupabase().functions.invoke('generate-insights', { body: { payload, language } }), timeout]);
  } catch {
    throw new InsightsError('unavailable');
  }
  if (outcome === 'timeout') throw new InsightsError('ocr_timeout');

  const { data, error } = outcome;
  if (error) {
    if (error instanceof FunctionsHttpError) {
      if (error.context.status === 404) throw new InsightsError('unavailable');
      const parsed = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
      throw new InsightsError(asCode(parsed?.error));
    }
    throw new InsightsError('unavailable');
  }
  const body = data as { ok?: boolean; error?: unknown; insights?: unknown } | null;
  if (body?.ok) {
    const insights = parseInsights(body.insights);
    if (insights) return insights;
  }
  throw new InsightsError(asCode(body?.error));
}

/** Clé de traduction du message d'erreur, jamais un code ou un texte technique. */
export function insightsErrorMessageKey(error: unknown): string {
  const code = error instanceof InsightsError ? error.code : 'unavailable';
  switch (code) {
    case 'ocr_busy':
      return 'accueil.ai.errors.busy';
    case 'ocr_timeout':
      return 'accueil.ai.errors.timeout';
    case 'insights_limit':
      return 'accueil.ai.errors.limit';
    case 'insights_disabled':
    case 'ocr_not_configured':
    case 'not_allowed':
      return 'accueil.ai.errors.inactive';
    case 'unavailable':
      return 'accueil.ai.errors.unavailable';
    default:
      return 'accueil.ai.errors.failed';
  }
}

