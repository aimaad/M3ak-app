import { FunctionsHttpError } from '@supabase/supabase-js';

import { getSupabase } from '@/lib/supabase';

export type AnalysisErrorCode =
  | 'ocr_disabled'
  | 'ocr_not_configured'
  | 'ocr_busy'
  | 'ocr_timeout'
  | 'no_photos'
  | 'analysis_failed'
  | 'unavailable';

export class AnalysisError extends Error {
  constructor(public code: AnalysisErrorCode, public failedZones: string[] = []) {
    super(code);
  }
}

export type AnalysisOutcome = { damages: number; failedZones: string[]; compared: boolean };

const KNOWN: AnalysisErrorCode[] = ['ocr_disabled', 'ocr_not_configured', 'ocr_busy', 'ocr_timeout', 'no_photos', 'analysis_failed'];
const asCode = (raw: unknown): AnalysisErrorCode => (KNOWN.includes(raw as AnalysisErrorCode) ? (raw as AnalysisErrorCode) : 'analysis_failed');
/** Plus long que la lecture d'un document : plusieurs groupes de photos sont analysés en parallèle. */
const TIMEOUT_MS = 150_000;

/** Lance l'analyse serveur de l'inspection (la fonction relit elle-même les photos : rien d'autre à envoyer). */
export async function analyzeInspection(inspectionId: string): Promise<AnalysisOutcome> {
  let outcome: Awaited<ReturnType<ReturnType<typeof getSupabase>['functions']['invoke']>> | 'timeout';
  try {
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIMEOUT_MS));
    outcome = await Promise.race([getSupabase().functions.invoke('analyze-inspection', { body: { inspectionId } }), timeout]);
  } catch {
    throw new AnalysisError('unavailable');
  }
  if (outcome === 'timeout') throw new AnalysisError('ocr_timeout');

  const { data, error } = outcome;
  if (error) {
    if (error instanceof FunctionsHttpError) {
      if (error.context.status === 404) throw new AnalysisError('unavailable');
      const parsed = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
      throw new AnalysisError(asCode(parsed?.error));
    }
    throw new AnalysisError('unavailable');
  }
  const body = data as { ok?: boolean; error?: unknown; damages?: unknown; failedZones?: unknown; compared?: unknown } | null;
  if (body?.ok) {
    return {
      damages: typeof body.damages === 'number' ? body.damages : 0,
      failedZones: Array.isArray(body.failedZones) ? body.failedZones.filter((zone): zone is string => typeof zone === 'string') : [],
      compared: body.compared === true,
    };
  }
  throw new AnalysisError(asCode(body?.error), Array.isArray((body as { failedZones?: unknown })?.failedZones) ? ((body as { failedZones: string[] }).failedZones) : []);
}

/** Clé de traduction du message d'erreur, jamais un code technique. */
export function analysisErrorMessageKey(error: unknown): string {
  const code = error instanceof AnalysisError ? error.code : 'unavailable';
  switch (code) {
    case 'ocr_disabled':
    case 'ocr_not_configured':
      return 'inspection.analysis.errors.inactive';
    case 'ocr_busy':
      return 'inspection.analysis.errors.busy';
    case 'ocr_timeout':
      return 'inspection.analysis.errors.timeout';
    case 'no_photos':
      return 'inspection.analysis.errors.noPhotos';
    case 'unavailable':
      return 'inspection.analysis.errors.unavailable';
    default:
      return 'inspection.analysis.errors.failed';
  }
}
