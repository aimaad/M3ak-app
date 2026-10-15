// M3ak — lecture d'un document (permis de conduire ou carte grise) par Google Gemini,
// avec la clé d'API PROPRE À L'ENTREPRISE de l'appelant.
//
// Ce chemin est OPTIONNEL : par défaut l'app lit les documents sur le téléphone, sans rien envoyer.
// Cette fonction n'envoie une image à Gemini que si TOUTES ces conditions sont vraies :
//   1. l'appelant est authentifié et membre d'une entreprise ;
//   2. l'opérateur M3AK a enregistré une clé Gemini pour CETTE entreprise (agency_ocr_settings) ;
//   3. le propriétaire de l'entreprise a donné son accord (cloud_enabled).
// Sinon : réponse explicite (`ocr_disabled` / `ocr_not_configured`), aucun appel à Gemini.
//
// Garde-fous : aucune clé globale ni de secours vers un autre fournisseur ; la clé n'est jamais
// renvoyée ni journalisée ; ni l'image ni les valeurs lues ne sont stockées ou journalisées ;
// chaque champ est revalidé ; un champ illisible reste null (jamais de valeur inventée).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// Plusieurs modèles : si l'un est saturé (503), sans quota (429) ou introuvable (404), on essaie le suivant.
const GEMINI_MODEL_CANDIDATES = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.0-flash'];
const RETRYABLE_STATUSES = new Set([404, 429, 500, 502, 503, 504]);
/** Durée totale maximale des essais : l'app abandonne à 70 s, donc on répond bien avant. */
const PROVIDER_DEADLINE_MS = 50_000;
const PER_CALL_TIMEOUT_MS = 25_000;

const FUEL_VALUES = ['essence', 'diesel', 'hybride', 'electrique'];
const CATEGORY_VALUES = ['economique', 'compacte', 'berline', 'suv', 'utilitaire', 'minibus', 'luxe'];

type Confidence = 'high' | 'medium' | 'low';
type Field<T> = { value: T | null; confidence: Confidence };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

class StageTimeoutError extends Error {
  constructor(public stage: string) {
    super(`stage_timeout:${stage}`);
  }
}

async function withTimeout<T>(stage: string, promise: PromiseLike<T>, ms = 15_000): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new StageTimeoutError(stage)), ms);
  });
  try {
    return await Promise.race([Promise.resolve(promise), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

class ProviderHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const LICENCE_PROMPT = `Tu lis une photo d'un permis de conduire (Maroc ou étranger) pour pré-remplir une fiche client dans une agence de location de voitures.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, respectant exactement ce schéma :

{
  "nom": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "prenom": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "numeroPermis": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "dateDelivrance": { "value": "AAAA-MM-JJ" ou null, "confidence": "high" | "medium" | "low" },
  "dateExpiration": { "value": "AAAA-MM-JJ" ou null, "confidence": "high" | "medium" | "low" },
  "categories": { "value": tableau de catégories (ex. ["B","C1"]) ou null, "confidence": "high" | "medium" | "low" },
  "dateNaissance": { "value": "AAAA-MM-JJ" ou null, "confidence": "high" | "medium" | "low" },
  "autorite": { "value": pays ou autorité de délivrance si identifiable, sinon null, "confidence": "high" | "medium" | "low" }
}

Règles strictes :
- Extrais UNIQUEMENT ces champs. Ignore toute autre information visible sur le document.
- Si un champ est absent, illisible ou ambigu, mets "value": null et "confidence": "low". Ne devine JAMAIS une valeur plausible.
- Écris les dates au format AAAA-MM-JJ. Si le jour ou le mois n'est pas certain, mets null.
- "confidence": "high" seulement si le texte est net et sans ambiguïté ; "medium" si lisible mais avec un doute raisonnable ; "low" sinon.
- "nom" et "prenom" : tels qu'imprimés (le document peut être en français ou en arabe : privilégie la graphie latine si les deux existent).
- Le permis peut être étranger : lis ce qui est présent sans traduire les numéros.`;

const REGISTRATION_PROMPT = `Tu lis une photo de carte grise (certificat d'immatriculation) marocaine pour une agence de location de voitures.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, respectant exactement ce schéma :

{
  "immatriculation": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "vin": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "marque": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "modele": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "finition": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "annee": { "value": nombre ou null, "confidence": "high" | "medium" | "low" },
  "couleur": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "nombrePlaces": { "value": nombre ou null, "confidence": "high" | "medium" | "low" },
  "carburant": { "value": une valeur EXACTE parmi ["essence","diesel","hybride","electrique"] ou null, "confidence": "high" | "medium" | "low" },
  "categorie": { "value": une valeur EXACTE parmi ["economique","compacte","berline","suv","utilitaire","minibus","luxe"] ou null, "confidence": "high" | "medium" | "low" }
}

Règles strictes :
- "immatriculation" au format marocain « chiffres | lettre arabe | chiffres » (ex. « 8921 | ب | 14 »).
- "annee" = l'année de la date de première mise en circulation (4 chiffres).
- "vin" = le numéro de série / châssis (N° de série), tel qu'imprimé.
- Si un champ n'est pas lisible ou absent du document, mets "value": null et "confidence": "low". Ne devine JAMAIS une valeur plausible.
- "confidence": "high" seulement si le texte est net et sans ambiguïté. "medium" si lisible mais avec un doute raisonnable. "low" sinon.
- Pour "carburant" et "categorie", si le document ne permet pas de déduire une valeur EXACTEMENT parmi la liste autorisée, mets null.
- Le document peut être en français ou en arabe : lis les deux.`;

function confidenceOf(raw: unknown): Confidence {
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'low';
}

function textField(raw: unknown, max = 120): Field<string> {
  if (typeof raw !== 'object' || raw === null) return { value: null, confidence: 'low' };
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown };
  if (typeof value !== 'string') return { value: null, confidence: 'low' };
  const text = value.trim().slice(0, max);
  return text ? { value: text, confidence: confidenceOf(confidence) } : { value: null, confidence: 'low' };
}

function dateField(raw: unknown): Field<string> {
  const field = textField(raw);
  if (field.value === null) return field;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(field.value)) return { value: null, confidence: 'low' };
  const date = new Date(`${field.value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === field.value ? field : { value: null, confidence: 'low' };
}

function categoriesField(raw: unknown): Field<string[]> {
  if (typeof raw !== 'object' || raw === null) return { value: null, confidence: 'low' };
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown };
  const list = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,;/]+/) : [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z0-9+]{1,4}$/.test(item));
  const unique = [...new Set(list)].slice(0, 12);
  return unique.length > 0 ? { value: unique, confidence: confidenceOf(confidence) } : { value: null, confidence: 'low' };
}

function numberField(raw: unknown, min: number, max: number): Field<number> {
  if (typeof raw !== 'object' || raw === null) return { value: null, confidence: 'low' };
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown };
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? { value: n, confidence: confidenceOf(confidence) } : { value: null, confidence: 'low' };
}

function enumField(raw: unknown, allowed: string[]): Field<string> {
  const field = textField(raw, 40);
  return field.value !== null && allowed.includes(field.value) ? field : { value: null, confidence: 'low' };
}

function sanitizeLicence(raw: unknown) {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    nom: textField(s.nom),
    prenom: textField(s.prenom),
    numeroPermis: textField(s.numeroPermis),
    dateDelivrance: dateField(s.dateDelivrance),
    dateExpiration: dateField(s.dateExpiration),
    categories: categoriesField(s.categories),
    dateNaissance: dateField(s.dateNaissance),
    autorite: textField(s.autorite),
  };
}

function sanitizeRegistration(raw: unknown) {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    immatriculation: textField(s.immatriculation, 40),
    vin: textField(s.vin, 40),
    marque: textField(s.marque, 60),
    modele: textField(s.modele, 60),
    finition: textField(s.finition, 60),
    annee: numberField(s.annee, 1950, new Date().getFullYear() + 1),
    couleur: textField(s.couleur, 40),
    nombrePlaces: numberField(s.nombrePlaces, 1, 9),
    carburant: enumField(s.carburant, FUEL_VALUES),
    categorie: enumField(s.categorie, CATEGORY_VALUES),
  };
}

function parseJson(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim());
}

type Usage = { inputTokens: number; outputTokens: number };
type ProviderResult = { json: unknown; usage: Usage; model: string };

async function callGeminiModel(apiKey: string, model: string, prompt: string, imageBase64: string, mimeType: string, timeoutMs: number): Promise<ProviderResult> {
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: prompt }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: 'Extrais les champs de ce document, au format JSON demandé.' }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
          maxOutputTokens: 8192,
          ...(model.includes('2.5-flash') ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
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

/**
 * Appelle Gemini en essayant plusieurs modèles : une surcharge passagère (503) ou un quota atteint (429) sur un
 * modèle n'empêche pas la lecture si un autre répond. Deux tours maximum, avec une courte pause entre les deux,
 * dans une durée totale bornée. Seuls les modèles de Gemini sont essayés : jamais un autre fournisseur.
 */
async function callGemini(apiKey: string, prompt: string, imageBase64: string, mimeType: string): Promise<ProviderResult> {
  const started = Date.now();
  let lastError: unknown = null;
  for (let round = 0; round < 2; round++) {
    for (const model of GEMINI_MODEL_CANDIDATES) {
      const remaining = PROVIDER_DEADLINE_MS - (Date.now() - started);
      if (remaining < 4_000) throw lastError ?? new StageTimeoutError('provider');
      try {
        return await callGeminiModel(apiKey, model, prompt, imageBase64, mimeType, Math.min(PER_CALL_TIMEOUT_MS, remaining));
      } catch (error) {
        lastError = error;
        const retryable = error instanceof ProviderHttpError && RETRYABLE_STATUSES.has(error.status);
        const timedOut = error instanceof StageTimeoutError;
        if (!retryable && !timedOut) throw error; // clé refusée (400/401/403), réponse illisible… : inutile d'insister
      }
    }
    if (round === 0) await sleep(1_500);
  }
  throw lastError;
}

type AdminClient = ReturnType<typeof createClient>;

/**
 * Suivi d'utilisation pour la console d'administration : uniquement des compteurs (entreprise, type de document,
 * succès, nombre de tokens). Jamais l'image, ni les valeurs lues, ni la clé. Un échec d'écriture ne doit jamais
 * faire échouer la lecture du document.
 */
async function recordUsage(
  admin: AdminClient,
  event: { agencyId: string; documentType: string; ok: boolean; errorCode?: string; model?: string; usage?: Usage }
): Promise<void> {
  try {
    await withTimeout(
      'usage',
      admin.from('ocr_usage_events').insert({
        agency_id: event.agencyId,
        document_type: event.documentType,
        ok: event.ok,
        error_code: event.errorCode ?? null,
        model: event.model ?? null,
        input_tokens: event.usage?.inputTokens ?? 0,
        output_tokens: event.usage?.outputTokens ?? 0,
      }),
      5_000
    );
  } catch {
    // volontairement silencieux : aucune donnée à journaliser
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? CORS_HEADERS['Access-Control-Allow-Headers'],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ ok: false, error: 'not_authenticated' }, 401);

  // Client agissant AU NOM de l'appelant : la RLS limite ce qu'il voit à sa propre entreprise.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  let apiKey: string;
  let agencyId: string;
  try {
    const { data: userData, error: userError } = await withTimeout('auth', supabase.auth.getUser());
    if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);

    const { data: membership } = await withTimeout(
      'membership',
      supabase.from('agency_members').select('agency_id').eq('user_id', userData.user.id).limit(1).maybeSingle()
    );
    if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);

    // La clé de l'entreprise n'est lisible qu'avec le rôle service (la table n'a aucune policy).
    const { data: settings } = await withTimeout(
      'settings',
      admin.from('agency_ocr_settings').select('cloud_enabled, gemini_api_key').eq('agency_id', membership.agency_id).maybeSingle()
    );
    if (!settings?.gemini_api_key) return json({ ok: false, error: 'ocr_not_configured' });
    if (!settings.cloud_enabled) return json({ ok: false, error: 'ocr_disabled' });
    apiKey = settings.gemini_api_key;
    agencyId = membership.agency_id;
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    throw error;
  }

  let body: Record<string, unknown>;
  try {
    body = (await withTimeout('body', request.json(), 20_000)) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: 'stage:body' });
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const documentType = body.documentType;
  if (documentType !== 'permis' && documentType !== 'carte_grise') return json({ ok: false, error: 'invalid_request' }, 400);
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : null;
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : null;
  if (!imageBase64 || !mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) return json({ ok: false, error: 'invalid_image' }, 400);
  if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) return json({ ok: false, error: 'image_too_large' }, 400);

  try {
    const result = await callGemini(apiKey, documentType === 'permis' ? LICENCE_PROMPT : REGISTRATION_PROMPT, imageBase64, mimeType);
    await recordUsage(admin, { agencyId, documentType, ok: true, model: result.model, usage: result.usage });
    return json({ ok: true, fields: documentType === 'permis' ? sanitizeLicence(result.json) : sanitizeRegistration(result.json) });
  } catch (error) {
    if (error instanceof StageTimeoutError) {
      await recordUsage(admin, { agencyId, documentType, ok: false, errorCode: 'ocr_timeout' });
      return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    }
    // Aucune donnée personnelle ni clé dans les journaux : seulement le type d'erreur.
    const detail = error instanceof ProviderHttpError ? `provider_${error.status}: ${error.message}` : error instanceof Error ? error.message : 'unknown';
    console.error("Échec de l'analyse du document :", detail.slice(0, 160));
    await recordUsage(admin, { agencyId, documentType, ok: false, errorCode: error instanceof ProviderHttpError ? `provider_${error.status}` : 'ocr_failed' });
    // Saturé (503) ou quota atteint (429) après tous les essais : message dédié (« réessayez dans un instant »).
    const busy = error instanceof ProviderHttpError && (error.status === 503 || error.status === 429);
    return json({ ok: false, error: busy ? 'ocr_busy' : 'ocr_failed', detail: detail.slice(0, 200) });
  }
});
