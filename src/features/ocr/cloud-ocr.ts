import { FunctionsHttpError } from '@supabase/supabase-js';
import { File } from 'expo-file-system';

import { getSupabase } from '@/lib/supabase';

/**
 * Lecture des documents par Google Gemini, via la fonction serveur `scan-document`, avec la clé d'API
 * propre à l'entreprise (jamais dans l'app). C'est le SEUL moteur de lecture : si l'entreprise n'a pas de clé
 * ou si son propriétaire n'a pas donné son accord, le serveur répond « non active » sans rien envoyer à Gemini.
 */
export type CloudDocumentType = 'permis' | 'carte_grise';

export type CloudErrorCode = 'ocr_disabled' | 'ocr_not_configured' | 'ocr_failed' | 'ocr_timeout' | 'ocr_busy' | 'unavailable';

export type CloudScanResult = { ok: true; fields: unknown } | { ok: false; error: CloudErrorCode; detail?: string };

/** Au-delà, on abandonne (le serveur répond lui-même avant 60 s). */
const CLOUD_TIMEOUT_MS = 70_000;

function guessMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  return extension === 'png' ? 'image/png' : 'image/jpeg';
}

function asCode(raw: unknown): CloudErrorCode {
  return raw === 'ocr_disabled' || raw === 'ocr_not_configured' || raw === 'ocr_timeout' || raw === 'ocr_busy' ? raw : 'ocr_failed';
}

/** Un serveur qui ne connaît pas encore l'envoi de deux photos répond « image invalide » : on le reconnaît pour lire les faces une par une. */
export const LEGACY_SERVER_DETAIL = 'legacy_single_image';

async function scanImages(documentType: CloudDocumentType, localUris: string[], many: boolean): Promise<CloudScanResult> {
  let totalBase64 = 0;
  try {
    const images = await Promise.all(localUris.map(async (uri) => ({ imageBase64: await new File(uri).base64(), mimeType: guessMimeType(uri) })));
    totalBase64 = images.reduce((sum, image) => sum + image.imageBase64.length, 0);
    const body = many ? { documentType, images } : { documentType, imageBase64: images[0].imageBase64, mimeType: images[0].mimeType };
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), CLOUD_TIMEOUT_MS));
    const outcome = await Promise.race([getSupabase().functions.invoke('scan-document', { body }), timeout]);
    if (outcome === 'timeout') return { ok: false, error: 'ocr_timeout', detail: 'stage:app' };
    const { data, error } = outcome;

    if (error) {
      if (error instanceof FunctionsHttpError) {
        if (error.context.status === 404) return { ok: false, error: 'unavailable', detail: 'function_not_deployed' };
        const parsed = (await error.context.json().catch(() => null)) as { error?: unknown; detail?: unknown } | null;
        if (many && parsed?.error === 'invalid_image') return { ok: false, error: 'ocr_failed', detail: LEGACY_SERVER_DETAIL };
        return { ok: false, error: asCode(parsed?.error), detail: typeof parsed?.detail === 'string' ? parsed.detail : undefined };
      }
      // FunctionsFetchError : la requête n'est pas partie ou n'a pas abouti. La vraie cause (réseau coupé,
      // domaine introuvable, connexion coupée, corps trop gros…) est dans error.context ; on ajoute la taille envoyée.
      const cause = (error as { context?: unknown }).context;
      const causeMessage = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
      return {
        ok: false,
        error: 'unavailable',
        detail: `${error.message}${causeMessage ? ` — ${causeMessage}` : ''} (image ${Math.round(totalBase64 / 1024)} Ko)`,
      };
    }

    const payload = data as { ok?: boolean; error?: unknown; fields?: unknown; detail?: unknown } | null;
    if (payload?.ok && payload.fields) return { ok: true, fields: payload.fields };
    return { ok: false, error: asCode(payload?.error), detail: typeof payload?.detail === 'string' ? payload.detail : undefined };
  } catch (error) {
    return { ok: false, error: 'unavailable', detail: error instanceof Error ? error.message : 'unknown' };
  }
}

export async function scanInCloud(documentType: CloudDocumentType, localUri: string): Promise<CloudScanResult> {
  return scanImages(documentType, [localUri], false);
}

/** Lit PLUSIEURS photos d'un même document (recto et verso d'une carte grise) en UNE seule analyse : un seul résultat. */
export async function scanInCloudMany(documentType: CloudDocumentType, localUris: string[]): Promise<CloudScanResult> {
  return scanImages(documentType, localUris, true);
}
