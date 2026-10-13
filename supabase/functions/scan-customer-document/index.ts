// M3ak — lecture automatique (OCR par IA) d'un permis de conduire pour préremplir une fiche client.
//
// Garde-fous :
//  * l'appelant doit être membre d'une agence ET le propriétaire doit avoir activé l'option
//    « analyse automatique des permis » (agencies.customer_ocr_enabled, désactivée par défaut) ;
//  * seule l'IMAGE est envoyée au fournisseur : aucun nom d'agence, d'utilisateur ou de client ;
//  * rien n'est stocké ni journalisé par cette fonction (ni image, ni valeurs lues) ;
//  * un champ illisible reste null : la consigne interdit de deviner, et chaque valeur est
//    revalidée ici (format des dates, longueurs) avant d'être renvoyée ;
//  * sans fournisseur configuré, la fonction répond `ocr_not_configured` — jamais de faux résultat.
//
// Secrets (voir supabase/README.md) : GEMINI_API_KEY (gratuit) ou ANTHROPIC_API_KEY (payant).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { extractJsonFromImage, isVisionConfigured, VisionHttpError } from '../_shared/vision.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

type Confidence = 'high' | 'medium' | 'low';
type Field<T> = { value: T | null; confidence: Confidence };

const SYSTEM_PROMPT = `Tu lis une photo d'un permis de conduire (Maroc ou étranger) pour pré-remplir une fiche client dans une agence de location de voitures.
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

function readConfidence(raw: unknown): Confidence {
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : 'low';
}

function readText(raw: unknown): Field<string> {
  if (typeof raw !== 'object' || raw === null) return { value: null, confidence: 'low' };
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown };
  if (typeof value !== 'string') return { value: null, confidence: 'low' };
  const text = value.trim().slice(0, 120);
  return text ? { value: text, confidence: readConfidence(confidence) } : { value: null, confidence: 'low' };
}

function readDate(raw: unknown): Field<string> {
  const field = readText(raw);
  if (field.value === null) return field;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(field.value);
  if (!match) return { value: null, confidence: 'low' };
  const date = new Date(`${field.value}T00:00:00Z`);
  const valid = !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === field.value;
  return valid ? field : { value: null, confidence: 'low' };
}

function readCategories(raw: unknown): Field<string[]> {
  if (typeof raw !== 'object' || raw === null) return { value: null, confidence: 'low' };
  const { value, confidence } = raw as { value?: unknown; confidence?: unknown };
  const list = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\s,;/]+/) : [])
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z0-9+]{1,4}$/.test(item));
  const unique = [...new Set(list)].slice(0, 12);
  return unique.length > 0 ? { value: unique, confidence: readConfidence(confidence) } : { value: null, confidence: 'low' };
}

function sanitize(raw: unknown) {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    nom: readText(source.nom),
    prenom: readText(source.prenom),
    numeroPermis: readText(source.numeroPermis),
    dateDelivrance: readDate(source.dateDelivrance),
    dateExpiration: readDate(source.dateExpiration),
    categories: readCategories(source.categories),
    dateNaissance: readDate(source.dateNaissance),
    autorite: readText(source.autorite),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...CORS_HEADERS,
        'Access-Control-Allow-Headers':
          request.headers.get('Access-Control-Request-Headers') ?? CORS_HEADERS['Access-Control-Allow-Headers'],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ ok: false, error: 'not_authenticated' }, 401);

  // Client agissant AU NOM de l'appelant : la RLS limite ce qu'il voit à sa propre agence.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);

  // L'option est propre à l'agence de l'appelant : désactivée tant que le propriétaire ne l'a pas autorisée.
  const { data: membership } = await supabase
    .from('agency_members')
    .select('agency_id')
    .eq('user_id', userData.user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);

  const { data: agency } = await supabase
    .from('agencies')
    .select('customer_ocr_enabled')
    .eq('id', membership.agency_id)
    .maybeSingle();
  if (!agency?.customer_ocr_enabled) return json({ ok: false, error: 'ocr_disabled' });

  if (!isVisionConfigured()) return json({ ok: false, error: 'ocr_not_configured' });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  if (body.documentType !== 'permis') return json({ ok: false, error: 'invalid_request' }, 400);
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : null;
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : null;
  if (!imageBase64 || !mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return json({ ok: false, error: 'invalid_image' }, 400);
  }
  if (imageBase64.length * 0.75 > MAX_IMAGE_BYTES) {
    return json({ ok: false, error: 'image_too_large' }, 400);
  }

  try {
    const raw = await extractJsonFromImage({
      imageBase64,
      mimeType,
      systemPrompt: SYSTEM_PROMPT,
      userText: 'Extrais les champs de ce permis de conduire, au format JSON demandé.',
    });
    return json({ ok: true, fields: sanitize(raw) });
  } catch (error) {
    // Aucune donnée personnelle dans les journaux : seulement le type d'erreur.
    const detail =
      error instanceof VisionHttpError ? `provider_${error.status}: ${error.message}` : error instanceof Error ? error.message : 'unknown';
    console.error("Échec de l'extraction du permis :", detail.slice(0, 160));
    return json({ ok: false, error: 'ocr_failed', detail: detail.slice(0, 200) });
  }
});
