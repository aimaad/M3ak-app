// M3ak — lecture automatique d'une carte grise marocaine (OCR par IA) pour
// préremplir la création rapide d'un véhicule.
//
// Secrets à définir (voir supabase/README.md) — un seul suffit :
//   GEMINI_API_KEY      clé Google AI Studio, offre GRATUITE (aistudio.google.com/apikey)
//   GEMINI_MODEL        (optionnel) modèle Gemini, par défaut « gemini-2.5-flash »
//   ANTHROPIC_API_KEY   (optionnel, payant) clé Anthropic, utilisée seulement si
//                       GEMINI_API_KEY est absent
//
// Si le secret est absent, la fonction répond explicitement
// `{ ok: false, error: 'ocr_not_configured' }` — l'app renvoie alors
// l'employé vers la saisie manuelle ou la saisie par plaque/VIN, sans
// jamais prétendre qu'un champ a été lu automatiquement.
//
// La photo n'est jamais stockée par cette fonction : elle est transmise
// telle quelle au fournisseur d'IA pour extraction, puis oubliée. Si
// l'employé veut conserver la carte grise comme document du véhicule,
// l'app l'envoie séparément vers le bucket vehicle-documents (comme pour
// n'importe quel autre document).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const FUEL_VALUES = ['essence', 'diesel', 'hybride', 'electrique'];
const CATEGORY_VALUES = ['economique', 'compacte', 'berline', 'suv', 'utilitaire', 'minibus', 'luxe'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

type FieldResult<T> = { value: T | null; confidence: 'high' | 'medium' | 'low' };

type ExtractionResult = {
  immatriculation: FieldResult<string>;
  vin: FieldResult<string>;
  marque: FieldResult<string>;
  modele: FieldResult<string>;
  finition: FieldResult<string>;
  annee: FieldResult<number>;
  couleur: FieldResult<string>;
  nombrePlaces: FieldResult<number>;
  carburant: FieldResult<string>;
  categorie: FieldResult<string>;
};

const SYSTEM_PROMPT = `Tu lis une photo de carte grise (certificat d'immatriculation) marocaine pour une agence de location de voitures.
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
- "annee" = l'année de la date de première mise en circulation (4 chiffres).
- "vin" = le numéro de série / châssis (N° de série), tel qu'imprimé.
- Si un champ n'est pas lisible ou absent du document, mets "value": null et "confidence": "low". Ne devine JAMAIS une valeur plausible.
- "confidence": "high" seulement si le texte est net et sans ambiguïté. "medium" si lisible mais avec un doute raisonnable (flou, abréviation, traduction). "low" sinon.
- Pour "carburant" et "categorie", si le document ne permet pas de déduire une valeur EXACTEMENT parmi la liste autorisée, mets null plutôt qu'une valeur approximative.
- Le document peut être en français ou en arabe : lis les deux.`;

async function callAnthropic(apiKey: string, imageBase64: string, mediaType: string): Promise<ExtractionResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: 'Extrais les informations de cette carte grise, au format JSON demandé.' },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`anthropic_error_${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const textBlock = data.content?.find((block) => block.type === 'text')?.text;
  if (!textBlock) throw new Error('anthropic_empty_response');

  return parseModelJson(textBlock);
}

// Offre gratuite de Google AI Studio (limites de débit et de volume par jour).
async function callGemini(apiKey: string, imageBase64: string, mediaType: string): Promise<ExtractionResult> {
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: mediaType, data: imageBase64 } },
              { text: 'Extrais les informations de cette carte grise, au format JSON demandé.' },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 1024 },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`gemini_error_${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('');
  if (!text) throw new Error('gemini_empty_response');

  return parseModelJson(text);
}

function parseModelJson(text: string): ExtractionResult {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  return sanitizeResult(JSON.parse(cleaned) as ExtractionResult);
}

function sanitizeField<T>(field: unknown, allowed?: T[]): FieldResult<T> {
  if (typeof field !== 'object' || field === null) return { value: null, confidence: 'low' };
  const value = (field as { value?: unknown }).value;
  const confidence = (field as { confidence?: unknown }).confidence;
  const safeConfidence: FieldResult<T>['confidence'] =
    confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : 'low';

  if (value === null || value === undefined || value === '') return { value: null, confidence: safeConfidence };
  if (allowed && !allowed.includes(value as T)) return { value: null, confidence: 'low' };
  return { value: value as T, confidence: safeConfidence };
}

function sanitizeResult(raw: ExtractionResult): ExtractionResult {
  return {
    immatriculation: sanitizeField<string>(raw.immatriculation),
    vin: sanitizeField<string>(raw.vin),
    marque: sanitizeField<string>(raw.marque),
    modele: sanitizeField<string>(raw.modele),
    finition: sanitizeField<string>(raw.finition),
    annee: sanitizeField<number>(raw.annee),
    couleur: sanitizeField<string>(raw.couleur),
    nombrePlaces: sanitizeField<number>(raw.nombrePlaces),
    carburant: sanitizeField<string>(raw.carburant, FUEL_VALUES),
    categorie: sanitizeField<string>(raw.categorie, CATEGORY_VALUES),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ ok: false, error: 'not_authenticated' }, 401);

  // Vérifie juste que l'appelant a une session Supabase valide (pas de lecture
  // de données métier ici) — évite qu'un tiers non authentifié fasse
  // consommer l'API d'IA (quota gratuit ou payant).
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!geminiKey && !anthropicKey) return json({ ok: false, error: 'ocr_not_configured' });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : null;
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : null;
  if (!imageBase64 || !mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return json({ ok: false, error: 'invalid_image' }, 400);
  }
  if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
    return json({ ok: false, error: 'image_too_large' }, 400);
  }

  try {
    const fields = geminiKey
      ? await callGemini(geminiKey, imageBase64, mimeType)
      : await callAnthropic(anthropicKey!, imageBase64, mimeType);
    return json({ ok: true, fields });
  } catch (error) {
    console.error('Échec de l\'extraction OCR :', error instanceof Error ? error.message : error);
    return json({ ok: false, error: 'ocr_failed' });
  }
});
