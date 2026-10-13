// M3ak — appel d'un modèle d'IA « vision » pour lire une photo de document et renvoyer du JSON.
// Utilisé par scan-customer-document. Les clés restent des secrets de fonction (jamais dans l'app).
//
// Fournisseurs, par ordre de priorité :
//   GEMINI_API_KEY      Google AI Studio (offre gratuite) — GEMINI_MODEL optionnel
//   ANTHROPIC_API_KEY   Anthropic (payant) — utilisé seulement si GEMINI_API_KEY est absent
//
// Rien d'autre que l'image et la consigne n'est transmis au fournisseur.

export class VisionNotConfiguredError extends Error {
  constructor() {
    super('ocr_not_configured');
  }
}

export class VisionHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export class VisionTimeoutError extends Error {
  constructor() {
    super('provider_timeout');
  }
}

/** Délai maximal d'un appel au fournisseur : au-delà, on répond une erreur claire plutôt que d'attendre le 504 de la plateforme. */
const PROVIDER_TIMEOUT_MS = 45_000;

async function providerFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new VisionTimeoutError();
    }
    throw error;
  }
}

export function isVisionConfigured(): boolean {
  return !!(Deno.env.get('GEMINI_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY'));
}

const GEMINI_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];

type VisionRequest = {
  imageBase64: string;
  mimeType: string;
  systemPrompt: string;
  userText: string;
};

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned);
}

async function callGeminiModel(apiKey: string, model: string, req: VisionRequest): Promise<unknown> {
  const response = await providerFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        contents: [
          {
            role: 'user',
            parts: [{ inlineData: { mimeType: req.mimeType, data: req.imageBase64 } }, { text: req.userText }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
          maxOutputTokens: 8192,
          ...(model.includes('2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    }
  );

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let message = raw.slice(0, 200);
    try {
      message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message?.slice(0, 200) ?? message;
    } catch {
      // corps non JSON
    }
    throw new VisionHttpError(response.status, message);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!text) throw new Error('vision_empty_response');
  if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('vision_response_truncated');
  return parseJson(text);
}

async function callGemini(apiKey: string, req: VisionRequest): Promise<unknown> {
  const configured = Deno.env.get('GEMINI_MODEL');
  const models = configured ? [configured] : GEMINI_MODEL_CANDIDATES;
  let lastError: unknown = null;
  for (const model of models) {
    try {
      return await callGeminiModel(apiKey, model, req);
    } catch (error) {
      lastError = error;
      // Modèle inconnu : on tente le suivant ; toute autre erreur ne dépend pas du modèle.
      if (!(error instanceof VisionHttpError && error.status === 404)) break;
    }
  }
  throw lastError;
}

async function callAnthropic(apiKey: string, req: VisionRequest): Promise<unknown> {
  const response = await providerFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      system: req.systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: req.mimeType, data: req.imageBase64 } },
            { type: 'text', text: req.userText },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new VisionHttpError(response.status, detail.slice(0, 200));
  }
  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error('vision_empty_response');
  return parseJson(text);
}

/** Lit une image avec le fournisseur configuré et renvoie le JSON brut (à valider par l'appelant). */
export async function extractJsonFromImage(req: VisionRequest): Promise<unknown> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey) return callGemini(geminiKey, req);
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (anthropicKey) return callAnthropic(anthropicKey, req);
  throw new VisionNotConfiguredError();
}
