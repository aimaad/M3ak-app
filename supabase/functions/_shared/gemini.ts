// M3ak — appel de Google Gemini (JSON en sortie), commun aux fonctions `scan-document` (lecture de documents) et
// `generate-insights` (recommandations de l'accueil). Toujours avec la clé de l'entreprise de l'appelant, jamais une clé
// globale, et seulement les modèles Gemini : jamais un autre fournisseur.

export class StageTimeoutError extends Error {
  constructor(public stage: string) {
    super(`stage_timeout:${stage}`);
  }
}

export class ProviderHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Les noms de modèles Gemini changent et les anciens sont retirés : on ne dépend pas d'une liste écrite à la main.
// Ordre d'essai : l'alias « gemini-flash-latest » (toujours le plus récent), puis les modèles « flash » que Google
// annonce disponibles pour CETTE clé (plus récents d'abord), puis deux noms de secours si la liste est inaccessible.
const LATEST_ALIAS = 'gemini-flash-latest';
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const MAX_MODELS_TRIED = 5;
const RETRYABLE_STATUSES = new Set([404, 429, 500, 502, 503, 504]);
/** Durée totale maximale des essais : l'app abandonne à 70 s, donc on répond bien avant. */
const PROVIDER_DEADLINE_MS = 50_000;
const PER_CALL_TIMEOUT_MS = 25_000;

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type Usage = { inputTokens: number; outputTokens: number };
export type ProviderResult = { json: unknown; usage: Usage; model: string };

export function parseJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
}

async function callGeminiModel(apiKey: string, model: string, systemPrompt: string, parts: GeminiPart[], timeoutMs: number, maxOutput?: number): Promise<ProviderResult> {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
          // Les modèles 2.5 acceptent « pas de réflexion » (plus rapide, moins cher). Pour les autres on ne force
          // rien (paramètre non garanti) et on laisse plus de marge de sortie.
          maxOutputTokens: maxOutput ?? (/^gemini-2\.5-flash/.test(model) ? 8192 : 16384),
          ...(/^gemini-2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new StageTimeoutError('provider');
    throw error;
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let message = raw.slice(0, 200);
    try {
      message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message?.slice(0, 200) ?? message;
    } catch {
      // corps non JSON
    }
    // Le message d'erreur d'un fournisseur ne contient pas la clé ; on la retire par précaution.
    throw new ProviderHttpError(response.status, message.split(apiKey).join('[clé]'));
  }
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const usage: Usage = {
    inputTokens: Math.max(0, Math.trunc(data.usageMetadata?.promptTokenCount ?? 0)),
    outputTokens: Math.max(0, Math.trunc(data.usageMetadata?.candidatesTokenCount ?? 0)),
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!text) throw new Error('provider_empty_response');
  if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('provider_response_truncated');
  return { json: parseJson(text), usage, model };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const modelCache = new Map<string, { at: number; models: string[] }>();
const MODEL_CACHE_MS = 10 * 60 * 1000;

/** Version d'un nom « gemini-2.5-flash » → 2.5 ; sert à classer les modèles du plus récent au plus ancien. */
function versionOf(model: string): number {
  return Number(/^gemini-(\d+(?:\.\d+)?)-/.exec(model)?.[1] ?? 0);
}

/** Modèles « flash » (hors préversions) que Google annonce utilisables pour cette clé. Liste vide en cas d'échec. */
async function discoverModels(apiKey: string): Promise<string[]> {
  const cached = modelCache.get(apiKey);
  if (cached && Date.now() - cached.at < MODEL_CACHE_MS) return cached.models;
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
    const models = (data.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => (model.name ?? '').replace(/^models\//, ''))
      .filter((name) => /^gemini-\d+(\.\d+)?-flash(-lite)?$/.test(name))
      .sort((a, b) => versionOf(b) - versionOf(a) || Number(a.includes('lite')) - Number(b.includes('lite')));
    modelCache.set(apiKey, { at: Date.now(), models });
    return models;
  } catch {
    return [];
  }
}

async function candidateModels(apiKey: string): Promise<string[]> {
  const discovered = await discoverModels(apiKey);
  return [...new Set([LATEST_ALIAS, ...discovered, ...FALLBACK_MODELS])].slice(0, MAX_MODELS_TRIED);
}

/**
 * Appelle Gemini en essayant plusieurs modèles : un modèle retiré (404), saturé (503) ou sans quota (429) n'empêche
 * pas la lecture si un autre répond. Deux tours maximum, avec une courte pause entre les deux, dans une durée totale
 * bornée. Seuls les modèles de Gemini sont essayés : jamais un autre fournisseur.
 */
export async function callGeminiJson(
  apiKey: string,
  systemPrompt: string,
  parts: GeminiPart[],
  options: { maxOutputTokens?: number; deadlineMs?: number; preferModels?: string[] } = {}
): Promise<ProviderResult> {
  const started = Date.now();
  const models = [...new Set([...(options.preferModels ?? []), ...(await candidateModels(apiKey))])];
  let lastError: unknown = null;
  let busyError: ProviderHttpError | null = null; // 503/429 vu au moins une fois : plus parlant qu'un 404 final
  for (let round = 0; round < 2; round++) {
    for (const model of models) {
      const remaining = (options.deadlineMs ?? PROVIDER_DEADLINE_MS) - (Date.now() - started);
      if (remaining < 4_000) throw busyError ?? lastError ?? new StageTimeoutError('provider');
      try {
        return await callGeminiModel(apiKey, model, systemPrompt, parts, Math.min(options.maxOutputTokens ? 100_000 : PER_CALL_TIMEOUT_MS, remaining), options.maxOutputTokens);
      } catch (error) {
        lastError = error;
        if (error instanceof ProviderHttpError && (error.status === 503 || error.status === 429)) busyError = error;
        const retryable = error instanceof ProviderHttpError && RETRYABLE_STATUSES.has(error.status);
        const timedOut = error instanceof StageTimeoutError;
        if (!retryable && !timedOut) throw error; // clé refusée (400/401/403), réponse illisible… : inutile d'insister
      }
    }
    if (round === 0) await sleep(1_500);
  }
  throw busyError ?? lastError;
}

