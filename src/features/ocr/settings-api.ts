import { getSupabase } from '@/lib/supabase';

/** Ce que l'app a le droit de savoir : jamais la clé d'API (elle reste côté serveur). */
export type OcrSettings = {
  /** L'opérateur M3AK a enregistré une clé Gemini pour cette entreprise. */
  cloudAvailable: boolean;
  /** Le propriétaire a autorisé l'analyse par Gemini (impossible sans clé). */
  cloudEnabled: boolean;
  /** Le propriétaire a autorisé les recommandations IA de l'accueil (accord distinct, impossible sans clé). */
  insightsEnabled: boolean;
  /** Le propriétaire a autorisé le Chat M3ak (accord distinct : des noms de clients peuvent être transmis à l'IA). */
  chatEnabled: boolean;
};

export const NO_OCR_SETTINGS: OcrSettings = { cloudAvailable: false, cloudEnabled: false, insightsEnabled: false, chatEnabled: false };

export function parseOcrSettings(raw: unknown): OcrSettings {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const cloudAvailable = source.cloud_available === true;
  // Garde-fou : l'accord n'a de sens qu'avec une clé.
  return {
    cloudAvailable,
    cloudEnabled: cloudAvailable && source.cloud_enabled === true,
    insightsEnabled: cloudAvailable && source.insights_enabled === true,
    chatEnabled: cloudAvailable && source.chat_enabled === true,
  };
}

export async function getOcrSettings(agencyId: string): Promise<OcrSettings> {
  const { data, error } = await getSupabase().rpc('get_ocr_settings', { p_agency_id: agencyId });
  if (error) throw error;
  return parseOcrSettings(data);
}

/** Réservé au propriétaire (contrôlé côté serveur). Refusé tant qu'aucune clé n'est configurée. */
export async function setOcrCloudEnabled(agencyId: string, enabled: boolean): Promise<OcrSettings> {
  const { data, error } = await getSupabase().rpc('set_ocr_cloud_enabled', { p_agency_id: agencyId, p_enabled: enabled });
  if (error) throw error;
  return parseOcrSettings(data);
}

/** Réservé au propriétaire (contrôlé côté serveur). Refusé tant qu'aucune clé n'est configurée. */
export async function setAiInsightsEnabled(agencyId: string, enabled: boolean): Promise<OcrSettings> {
  const { data, error } = await getSupabase().rpc('set_ai_insights_enabled', { p_agency_id: agencyId, p_enabled: enabled });
  if (error) throw error;
  return parseOcrSettings(data);
}

/** Réservé au propriétaire (contrôlé côté serveur). Refusé tant qu'aucune clé n'est configurée. */
export async function setAiChatEnabled(agencyId: string, enabled: boolean): Promise<OcrSettings> {
  const { data, error } = await getSupabase().rpc('set_ai_chat_enabled', { p_agency_id: agencyId, p_enabled: enabled });
  if (error) throw error;
  return parseOcrSettings(data);
}
