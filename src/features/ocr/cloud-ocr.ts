import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';

import { getSupabase } from '@/lib/supabase';

/**
 * Analyse OPTIONNELLE par Google Gemini, via la fonction serveur `scan-document`, avec la clé d'API
 * propre à l'entreprise (jamais dans l'app). Ce module n'est appelé que si l'entreprise a une clé ET
 * que son propriétaire a donné son accord (voir settings-api.ts) ; sinon la lecture reste sur l'appareil.
 */
export type CloudDocumentType = 'permis' | 'carte_grise';

export type CloudErrorCode = 'ocr_disabled' | 'ocr_not_configured' | 'ocr_failed' | 'ocr_timeout' | 'unavailable';

export type CloudScanResult = { ok: true; fields: unknown } | { ok: false; error: CloudErrorCode; detail?: string };

/** Au-delà, on abandonne (le serveur répond lui-même avant 60 s). */
const CLOUD_TIMEOUT_MS = 70_000;

function guessMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  return extension === 'png' ? 'image/png' : 'image/jpeg';
}

function asCode(raw: unknown): CloudErrorCode {
  return raw === 'ocr_disabled' || raw === 'ocr_not_configured' || raw === 'ocr_timeout' ? raw : 'ocr_failed';
}

export async function scanInCloud(documentType: CloudDocumentType, localUri: string): Promise<CloudScanResult> {
  try {
    const imageBase64 = await new File(localUri).base64();
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), CLOUD_TIMEOUT_MS));
    const outcome = await Promise.race([
      getSupabase().functions.invoke('scan-document', {
        body: { documentType, imageBase64, mimeType: guessMimeType(localUri) },
      }),
      timeout,
    ]);
    if (outcome === 'timeout') return { ok: false, error: 'ocr_timeout', detail: 'stage:app' };
    const { data, error } = outcome;

    if (error) {
      if (error instanceof FunctionsHttpError) {
        if (error.context.status === 404) return { ok: false, error: 'unavailable', detail: 'function_not_deployed' };
        const parsed = (await error.context.json().catch(() => null)) as { error?: unknown; detail?: unknown } | null;
        return { ok: false, error: asCode(parsed?.error), detail: typeof parsed?.detail === 'string' ? parsed.detail : undefined };
      }
      return { ok: false, error: 'unavailable', detail: error.message };
    }

    const payload = data as { ok?: boolean; error?: unknown; fields?: unknown; detail?: unknown } | null;
    if (payload?.ok && payload.fields) return { ok: true, fields: payload.fields };
    return { ok: false, error: asCode(payload?.error), detail: typeof payload?.detail === 'string' ? payload.detail : undefined };
  } catch (error) {
    return { ok: false, error: 'unavailable', detail: error instanceof Error ? error.message : 'unknown' };
  }
}
