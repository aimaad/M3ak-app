import { dashboardSections, canSeeMoney, canUseAiInsights } from '../role-layout';
import { buildInsightsPayload, parseInsights } from '../insights';
import { INSIGHTS_CACHE_TTL_MS, insightsCacheKey, readInsightsCache, writeInsightsCache, clearInsightsCache } from '../insights-cache';
import { computeDashboardMetrics } from '../kpis';
import { InsightsError, insightsErrorMessageKey } from '../insights-api';
import type { KeyValueStorage } from '@/features/ocr/scan-cache';

jest.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke: jest.fn() } }) }));

const NOW = new Date(2026, 9, 17, 12);
const metrics = computeDashboardMetrics({
  vehicles: [{ id: 'v1', marque: 'Dacia', modele: 'Logan', statut: 'disponible', archivedAt: null, immatriculation: '8921 | ب | 14' } as never],
  rentals: [],
  payments: [],
  maintenance: [],
  customers: [{ createdAt: NOW.toISOString(), archivedAt: null }],
  now: NOW,
});

describe('qui voit quoi', () => {
  it('le propriétaire voit tout, y compris les finances et l\'IA', () => {
    expect(dashboardSections('owner')).toEqual(['financial', 'fleet', 'operations', 'performance', 'maintenance', 'alerts', 'ai']);
    expect(canSeeMoney('owner')).toBe(true);
  });
  it("le responsable voit l'exploitation et la flotte, sans les finances", () => {
    expect(dashboardSections('manager')).toEqual(['fleet', 'operations', 'performance', 'maintenance', 'alerts', 'ai']);
    expect(dashboardSections('manager')).not.toContain('financial');
    expect(canSeeMoney('manager')).toBe(false);
  });
  it("l'employé voit son travail du jour : ni finances, ni performance, ni IA", () => {
    expect(dashboardSections('employee')).toEqual(['counter', 'fleet', 'alerts']);
    expect(canSeeMoney('employee')).toBe(false);
    expect(canUseAiInsights('employee')).toBe(false);
  });
  it('aucun rôle connu : rien', () => {
    expect(dashboardSections(null)).toEqual([]);
  });
});

describe("données envoyées à l'IA", () => {
  it('ne contiennent aucune donnée personnelle ni identifiant', () => {
    const text = JSON.stringify(buildInsightsPayload('owner', metrics));
    expect(text).not.toMatch(/8921|immatriculation|telephone|email|nomComplet|cin/i);
    expect(text).toContain('Dacia Logan'); // seulement « marque modèle »
  });
  it("un responsable n'envoie aucun chiffre d'argent", () => {
    const payload = buildInsightsPayload('manager', metrics);
    expect(payload.money).toBeUndefined();
    expect(payload.vehicles.every((v) => v.revenue === undefined && v.maintenanceCost === undefined)).toBe(true);
  });
  it('le propriétaire envoie les chiffres agrégés', () => {
    const payload = buildInsightsPayload('owner', metrics);
    expect(payload.money?.revenueTrend).toHaveLength(6);
    expect(payload.money).toHaveProperty('outstandingTotal');
  });
});

describe('lecture de la réponse IA', () => {
  it('relit et borne la réponse, ignore les éléments invalides', () => {
    const parsed = parseInsights({
      summary: '  Bonne   situation. ',
      indicators: [{ label: 'Tendance', value: '+12 %', trend: 'up', explanation: 'x' }, { label: '', value: 'vide' }, { label: 'a', value: 'b', trend: 'bizarre' }],
      recommendations: [
        { title: 'Relancer', detail: 'Appeler les clients en retard', priority: 'high', area: 'operations' },
        { title: 'Sans détail' },
        { title: 'Zone inconnue', detail: 'd', priority: '???', area: '???' },
      ],
    });
    expect(parsed?.summary).toBe('Bonne situation.');
    expect(parsed?.indicators).toEqual([
      { label: 'Tendance', value: '+12 %', trend: 'up', explanation: 'x' },
      { label: 'a', value: 'b', trend: 'flat', explanation: null },
    ]);
    expect(parsed?.recommendations.map((r) => [r.title, r.priority, r.area])).toEqual([
      ['Relancer', 'high', 'operations'],
      ['Zone inconnue', 'medium', 'operations'],
    ]);
  });
  it('renvoie null quand rien n\'est exploitable', () => {
    expect(parseInsights(null)).toBeNull();
    expect(parseInsights({ indicators: 'non', recommendations: [{}] })).toBeNull();
  });
  it('limite le nombre d\'éléments', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `t${i}`, detail: 'd', priority: 'low', area: 'fleet' }));
    expect(parseInsights({ recommendations: many })?.recommendations).toHaveLength(5);
  });
});

describe('cache des recommandations', () => {
  function memory(): KeyValueStorage {
    const data = new Map<string, string>();
    return { getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v), removeItem: async (k) => void data.delete(k) };
  }
  const insights = { summary: 's', indicators: [], recommendations: [] };

  it('reprend les recommandations pendant 6 h, par entreprise, rôle et langue', async () => {
    const storage = memory();
    const key = insightsCacheKey('A', 'owner', 'fr');
    await writeInsightsCache(storage, key, insights, 1000);
    expect(await readInsightsCache(storage, key, 2000)).toEqual({ insights, at: 1000 });
    expect(await readInsightsCache(storage, insightsCacheKey('B', 'owner', 'fr'), 2000)).toBeNull();
    expect(await readInsightsCache(storage, insightsCacheKey('A', 'manager', 'fr'), 2000)).toBeNull();
    expect(await readInsightsCache(storage, insightsCacheKey('A', 'owner', 'ar'), 2000)).toBeNull();
    expect(await readInsightsCache(storage, key, 1000 + INSIGHTS_CACHE_TTL_MS + 1)).toBeNull();
  });
  it('est vidé à la déconnexion et résiste à un stockage corrompu', async () => {
    const storage = memory();
    const key = insightsCacheKey('A', 'owner', 'fr');
    await writeInsightsCache(storage, key, insights, 1000);
    await clearInsightsCache(storage);
    expect(await readInsightsCache(storage, key, 2000)).toBeNull();
    await storage.setItem('m3ak.ai-insights.v1', '{oops');
    expect(await readInsightsCache(storage, key, 2000)).toBeNull();
  });
});

describe("messages d'erreur de l'IA : jamais de code technique", () => {
  it('traduit chaque cas en message clair', () => {
    expect(insightsErrorMessageKey(new InsightsError('ocr_busy'))).toBe('accueil.ai.errors.busy');
    expect(insightsErrorMessageKey(new InsightsError('ocr_timeout'))).toBe('accueil.ai.errors.timeout');
    expect(insightsErrorMessageKey(new InsightsError('insights_limit'))).toBe('accueil.ai.errors.limit');
    expect(insightsErrorMessageKey(new InsightsError('insights_disabled'))).toBe('accueil.ai.errors.inactive');
    expect(insightsErrorMessageKey(new InsightsError('unavailable'))).toBe('accueil.ai.errors.unavailable');
    expect(insightsErrorMessageKey(new InsightsError('ocr_failed'))).toBe('accueil.ai.errors.failed');
    expect(insightsErrorMessageKey(new Error('boom'))).toBe('accueil.ai.errors.unavailable');
  });
});
