import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';

import { getSupabase } from '@/lib/supabase';

/**
 * Lecture des documents par Google Gemini, via la fonction serveur `scan-document`, avec la clé d'API
 * propre à l'entreprise (jamais dans l'app). C'est le SEUL moteur de lecture : si l'entreprise n'a pas de clé
 * ou si son propriétaire n'a pas donné son accord, le serveur répond « non active » sans rien envoyer à Gemini.
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
  let imageBase64 = '';
  try {
    imageBase64 = await new File(localUri).base64();
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
      // FunctionsFetchError : la requête n'est pas partie ou n'a pas abouti. La vraie cause (réseau coupé,
      // domaine introuvable, connexion coupée, corps trop gros…) est dans error.context ; on ajoute la taille envoyée.
      const cause = (error as { context?: unknown }).context;
      const causeMessage = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
      return {
        ok: false,
        error: 'unavailable',
        detail: `${error.message}${causeMessage ? ` — ${causeMessage}` : ''} (image ${Math.round(imageBase64.length / 1024)} Ko)`,
      };
    }

    const payload = data as { ok?: boolean; error?: unknown; fields?: unknown; detail?: unknown } | null;
    if (payload?.ok && payload.fields) return { ok: true, fields: payload.fields };
    return { ok: false, error: asCode(payload?.error), detail: typeof payload?.detail === 'string' ? payload.detail : undefined };
  } catch (error) {
    return { ok: false, error: 'unavailable', detail: error instanceof Error ? error.message : 'unknown' };
  }
}
