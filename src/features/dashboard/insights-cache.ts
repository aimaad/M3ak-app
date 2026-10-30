import type { KeyValueStorage } from '@/features/ocr/scan-cache';

import type { AiInsights } from './insights';

/**
 * Cache des recommandations, SUR L'APPAREIL, 6 h : rouvrir l'accueil ne refait pas d'appel (économie de quota et de coût) ;
 * la page indique l'heure de l'analyse et propose « Actualiser ». Ne contient que des recommandations générées à partir de
 * statistiques agrégées, aucune donnée personnelle ; effacé à la déconnexion.
 */
const STORAGE_KEY = 'm3ak.ai-insights.v1';
export const INSIGHTS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_ENTRIES = 6;

type Entry = { at: number; insights: AiInsights };

async function load(storage: KeyValueStorage, now: number): Promise<Record<string, Entry>> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const fresh: Record<string, Entry> = {};
    for (const [key, entry] of Object.entries(parsed as Record<string, Entry>)) {
      if (typeof entry?.at === 'number' && now - entry.at < INSIGHTS_CACHE_TTL_MS && now >= entry.at - 60_000) fresh[key] = entry;
    }
    return fresh;
  } catch {
    return {};
  }
}

export const insightsCacheKey = (agencyId: string, role: string, language: string) => `${agencyId}:${role}:${language}`;

export type CachedInsights = { insights: AiInsights; at: number };

export async function readInsightsCache(storage: KeyValueStorage, key: string, now = Date.now()): Promise<CachedInsights | null> {
  const entry = (await load(storage, now))[key];
  return entry ? { insights: entry.insights, at: entry.at } : null;
}

export async function writeInsightsCache(storage: KeyValueStorage, key: string, insights: AiInsights, now = Date.now()): Promise<void> {
  try {
    const map = await load(storage, now);
    map[key] = { at: now, insights };
    const newest = Object.entries(map).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    await storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(newest)));
  } catch {
    // confort : un échec d'écriture ne doit jamais empêcher l'affichage
  }
}

export async function clearInsightsCache(storage: KeyValueStorage): Promise<void> {
  try {
    await storage.removeItem(STORAGE_KEY);
  } catch {
    // rien à faire
  }
}
