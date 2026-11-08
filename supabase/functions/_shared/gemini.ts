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
const FALLBACK_MODELS = ['gemini-flash-lite-latest'];
const MAX_MODELS_TRIED = 6;
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

async function callGeminiModel(apiKey: string, model: string, systemPrompt: string, parts: GeminiPart[], timeoutMs: number, onText?: (partial: string) => void): Promise<ProviderResult> {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${onText ? 'streamGenerateContent?alt=sse' : 'generateContent'}`, {
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
          maxOutputTokens: /^gemini-2\.5-flash/.test(model) ? 8192 : 16384,
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
  type Chunk = {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  let text = '';
  let finishReason: string | undefined;
  let usageMetadata: Chunk['usageMetadata'];
  const take = (chunk: Chunk) => {
    const candidate = chunk.candidates?.[0];
    text += candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    finishReason = candidate?.finishReason ?? finishReason;
    usageMetadata = chunk.usageMetadata ?? usageMetadata;
  };
  if (onText && response.body) {
    // Flux (SSE) : chaque événement « data: {…} » apporte la suite du texte ; on prévient l'appelant à chaque morceau.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let end = pending.indexOf('\n\n');
        while (end >= 0) {
          const event = pending.slice(0, end);
          pending = pending.slice(end + 2);
          const line = event.split('\n').find((l) => l.startsWith('data:'));
          if (line) {
            try {
              take(JSON.parse(line.slice(5).trim()) as Chunk);
              onText(text);
            } catch {
              // morceau illisible : ignoré, le texte complet est relu à la fin
            }
          }
          end = pending.indexOf('\n\n');
        }
      }
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new StageTimeoutError('provider');
      throw error;
    }
  } else {
    take((await response.json()) as Chunk);
  }
  const usage: Usage = {
    inputTokens: Math.max(0, Math.trunc(usageMetadata?.promptTokenCount ?? 0)),
    outputTokens: Math.max(0, Math.trunc(usageMetadata?.candidatesTokenCount ?? 0)),
  };
  if (!text) throw new Error('provider_empty_response');
  if (finishReason === 'MAX_TOKENS') throw new Error('provider_response_truncated');
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

/** Modèles qui viennent de refuser (quota 429, absent 404) : on ne les réessaie pas tout de suite, ça ferait perdre du temps. */
const cooldown = new Map<string, number>();
const COOLDOWN_MS: Record<number, number> = { 429: 60_000, 404: 3_600_000 };

function coolDown(apiKey: string, model: string, status: number | 'timeout') {
  // Un modèle qui n'a pas répondu à temps est mis de côté un moment : le réessayer ferait perdre le même temps.
  const duration = status === 'timeout' ? 120_000 : COOLDOWN_MS[status];
  if (duration) cooldown.set(`${apiKey.slice(-8)}:${model}`, Date.now() + duration);
}

function isCooling(apiKey: string, model: string): boolean {
  return (cooldown.get(`${apiKey.slice(-8)}:${model}`) ?? 0) > Date.now();
}

async function candidateModels(apiKey: string, qualityFirst: boolean): Promise<string[]> {
  const discovered = await discoverModels(apiKey);
  const full = discovered.filter((name) => !name.includes('lite'));
  const lite = discovered.filter((name) => name.includes('lite'));
  let ordered: string[];
  if (qualityFirst) {
    // Qualité d'abord (chat) : les modèles complets, du plus récent au plus ancien ; les « lite » seulement en dernier recours.
    ordered = [...new Set([LATEST_ALIAS, ...full, ...lite, ...FALLBACK_MODELS])];
  } else {
    // Un modèle « lite » a un quota gratuit bien plus large (ex. 500 demandes/jour contre 20) : on alterne les deux familles,
    // du plus récent au plus ancien, pour qu'un quota épuisé sur un modèle n'empêche pas de répondre avec un autre.
    const interleaved: string[] = [];
    for (let index = 0; index < Math.max(full.length, lite.length); index++) {
      if (full[index]) interleaved.push(full[index]);
      if (lite[index]) interleaved.push(lite[index]);
    }
    ordered = [...new Set([LATEST_ALIAS, ...interleaved.slice(0, 4), ...FALLBACK_MODELS, ...interleaved.slice(4)])];
  }
  ordered = ordered.slice(0, MAX_MODELS_TRIED);
  const available = ordered.filter((model) => !isCooling(apiKey, model));
  return available.length > 0 ? available : ordered;
}

/**
 * Appelle Gemini en essayant plusieurs modèles : un modèle retiré (404), saturé (503) ou sans quota (429) n'empêche
 * pas la lecture si un autre répond. Deux tours maximum, avec une courte pause entre les deux, dans une durée totale
 * bornée. Seuls les modèles de Gemini sont essayés : jamais un autre fournisseur.
 */
export async function callGeminiJson(apiKey: string, systemPrompt: string, parts: GeminiPart[], options: { qualityFirst?: boolean; perCallTimeoutMs?: number; onText?: (partial: string) => void } = {}): Promise<ProviderResult> {
  const started = Date.now();
  const models = await candidateModels(apiKey, options.qualityFirst === true);
  let lastError: unknown = null;
  let busyError: ProviderHttpError | null = null; // 503/429 vu au moins une fois : plus parlant qu'un 404 final
  for (let round = 0; round < 2; round++) {
    for (const model of models) {
      const remaining = PROVIDER_DEADLINE_MS - (Date.now() - started);
      if (remaining < 4_000) throw busyError ?? lastError ?? new StageTimeoutError('provider');
      try {
        const result = await callGeminiModel(apiKey, model, systemPrompt, parts, Math.min(options.perCallTimeoutMs ?? PER_CALL_TIMEOUT_MS, remaining), options.onText);
        console.log('Gemini', model, 'OK', `${Date.now() - started} ms`);
        return result;
      } catch (error) {
        if (error instanceof ProviderHttpError) coolDown(apiKey, model, error.status);
        else if (error instanceof StageTimeoutError) coolDown(apiKey, model, 'timeout');
        lastError = error;
        // Diagnostic : quel modèle a répondu quoi (jamais la clé ni le contenu envoyé).
        console.error('Gemini', model, error instanceof ProviderHttpError ? `HTTP ${error.status}` : error instanceof StageTimeoutError ? 'timeout' : 'erreur');
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


// ---------------------------------------------------------------- synthèse vocale (voix naturelle)

const SPEECH_FALLBACK_MODELS = ['gemini-2.5-flash-preview-tts'];
const SPEECH_VOICE = 'Aoede';

/** Modèles « TTS » que Google annonce pour cette clé (les plus légers d'abord) ; un nom de secours si la liste est inaccessible. */
async function speechModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(8_000) });
    if (response.ok) {
      const data = (await response.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
      const found = (data.models ?? [])
        .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model) => (model.name ?? '').replace(/^models\//, ''))
        .filter((name) => /^gemini-[\w.-]*tts$/.test(name))
        .sort((a, b) => Number(a.includes('pro')) - Number(b.includes('pro')) || versionOf(b) - versionOf(a));
      if (found.length > 0) return [...new Set(found)].slice(0, 3);
    }
  } catch {
    // liste inaccessible : modèle de secours
  }
  return SPEECH_FALLBACK_MODELS;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Lit un texte à voix haute avec Gemini (clé de l'entreprise). Rend le son brut PCM 16 bits mono et sa fréquence. */
export async function callGeminiSpeech(apiKey: string, text: string): Promise<{ pcm: Uint8Array; sampleRate: number; usage: Usage; model: string }> {
  let lastError: unknown = null;
  for (const model of await speechModels(apiKey)) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text }] }],
          generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: SPEECH_VOICE } } } },
        }),
      });
      if (!response.ok) {
        const raw = await response.text().catch(() => '');
        let message = raw.slice(0, 200);
        try {
          message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message?.slice(0, 200) ?? message;
        } catch {
          // corps non JSON
        }
        throw new ProviderHttpError(response.status, message.split(apiKey).join('[clé]'));
      }
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const inline = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
      if (!inline?.data) throw new Error('provider_empty_response');
      const rate = Number(/rate=(\d+)/.exec(inline.mimeType ?? '')?.[1] ?? 24_000);
      return {
        pcm: decodeBase64(inline.data),
        sampleRate: Number.isFinite(rate) && rate > 0 ? rate : 24_000,
        usage: { inputTokens: Math.max(0, Math.trunc(data.usageMetadata?.promptTokenCount ?? 0)), outputTokens: Math.max(0, Math.trunc(data.usageMetadata?.candidatesTokenCount ?? 0)) },
        model,
      };
    } catch (error) {
      lastError = error;
      console.error('Gemini voix', model, error instanceof ProviderHttpError ? `HTTP ${error.status}` : error instanceof DOMException ? 'timeout' : 'erreur');
      const retryable = error instanceof ProviderHttpError && RETRYABLE_STATUSES.has(error.status);
      if (!retryable && !(error instanceof DOMException)) throw error;
    }
  }
  throw lastError ?? new Error('provider_empty_response');
}
