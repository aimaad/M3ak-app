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

import { callGeminiJson, ProviderHttpError, StageTimeoutError, type Usage } from '../_shared/gemini.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const FUEL_VALUES = ['essence', 'diesel', 'hybride', 'electrique'];
const CATEGORY_VALUES = ['economique', 'compacte', 'berline', 'suv', 'utilitaire', 'minibus', 'luxe'];

type Confidence = 'high' | 'medium' | 'low';
type Field<T> = { value: T | null; confidence: Confidence };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
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

const LICENCE_PROMPT = `Tu lis la photo d'UNE FACE d'un permis de conduire (Maroc ou étranger) pour pré-remplir une fiche client dans une agence de location de voitures. La photo montre le RECTO, le VERSO, ou parfois les deux.
Permis marocain (format carte « Royaume du Maroc ») :
- RECTO : Prénom, Nom (en lettres latines et arabes), C.N.I., Né(e) le + lieu de naissance, Permis N° (ex. 20/086579), « <Ville> le <date> » = lieu et date de délivrance, et la ou les lettres de catégorie encadrées (ex. B).
- VERSO : tableau Catégories (A1, A, B, C, D, EB, EC, ED) avec une « Date de délivrance » par catégorie (une catégorie dont la case de date est vide n'est PAS détenue), colonne Restrictions (ex. 01.01), et en bas « Date de fin de validité » suivie d'un long numéro de série (à ignorer).
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, respectant exactement ce schéma. Pour une information qui n'est pas sur la face photographiée, mets "value": null :

{
  "nom": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "prenom": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "cin": { "value": numéro de la carte d'identité nationale (C.N.I.) ou null, "confidence": "high" | "medium" | "low" },
  "numeroPermis": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "dateDelivrance": { "value": "AAAA-MM-JJ" ou null, "confidence": "high" | "medium" | "low" },
  "dateExpiration": { "value": "AAAA-MM-JJ" ou null, "confidence": "high" | "medium" | "low" },
  "categories": { "value": tableau de catégories détenues (ex. ["B"]) ou null, "confidence": "high" | "medium" | "low" },
  "restrictions": { "value": codes de la colonne Restrictions (ex. "01.01") ou null, "confidence": "high" | "medium" | "low" },
  "dateNaissance": { "value": "AAAA-MM-JJ" ou null, "confidence": "high" | "medium" | "low" },
  "autorite": { "value": la VILLE de délivrance écrite avant « le <date> » sur le recto (ex. "Taza"), sinon null — JAMAIS « Royaume du Maroc » (c'est l'en-tête du document), "confidence": "high" | "medium" | "low" }
}

Règles strictes :
- Extrais UNIQUEMENT ces champs. Ignore toute autre information visible sur le document (numéro de série, adresse, signature, tampon).
- Si un champ est absent, illisible ou ambigu, mets "value": null et "confidence": "low". Ne devine JAMAIS une valeur plausible.
- Écris les dates au format AAAA-MM-JJ (le document les écrit JJ/MM/AAAA). Si le jour ou le mois n'est pas certain, mets null.
- "dateDelivrance" : la date de délivrance du permis (recto, après la ville). Sur le verso seul, la date de la catégorie principale détenue.
- "dateExpiration" : uniquement la « Date de fin de validité » (verso). Ne la confonds pas avec une date de délivrance.
- "confidence": "high" seulement si le texte est net et sans ambiguïté ; "medium" si lisible mais avec un doute raisonnable ; "low" sinon.
- "nom" et "prenom" : tels qu'imprimés, en graphie latine (ignore la ligne arabe si une ligne latine existe).
- Le permis peut être étranger : lis ce qui est présent sans traduire les numéros.`;

const REGISTRATION_PROMPT = `Tu lis la photo d'UNE FACE d'un certificat d'immatriculation marocain (carte grise, format carte bancaire « Royaume du Maroc ») pour une agence de location de voitures. La photo montre le RECTO, le VERSO, ou parfois les deux.
Le RECTO contient : Numéro d'immatriculation, Immatriculation antérieure, Première mise en circulation, M.C. au Maroc, Mutation le, Usage, Propriétaire, Adresse, Fin de validité.
Le VERSO contient : Marque, Type (code du modèle), Genre, Modèle, Type carburant, N° du chassis, Nombre de cylindres, Puissance fiscale, Nombre de places, P.T.A.C., Poids à vide, P.T.R.A., Restrictions, et en bas une ligne de caractères (zone lisible par machine).
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown, respectant exactement ce schéma. Pour une information qui n'est pas sur la face photographiée, mets "value": null :

{
  "immatriculation": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "immatriculationAnterieure": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "dateMiseEnCirculation": { "value": "AAAA-MM-JJ" ou null, "confidence": "high" | "medium" | "low" },
  "dateFinValidite": { "value": "AAAA-MM-JJ" ou null, "confidence": "high" | "medium" | "low" },
  "usage": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "proprietaire": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "marque": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "modele": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "finition": { "value": null, "confidence": "low" },
  "type": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "genre": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "vin": { "value": string ou null, "confidence": "high" | "medium" | "low" },
  "annee": { "value": nombre ou null, "confidence": "high" | "medium" | "low" },
  "couleur": { "value": null, "confidence": "low" },
  "nombrePlaces": { "value": nombre ou null, "confidence": "high" | "medium" | "low" },
  "nombreCylindres": { "value": nombre ou null, "confidence": "high" | "medium" | "low" },
  "puissanceFiscale": { "value": nombre ou null, "confidence": "high" | "medium" | "low" },
  "ptac": { "value": nombre de kg ou null, "confidence": "high" | "medium" | "low" },
  "poidsVide": { "value": nombre de kg ou null, "confidence": "high" | "medium" | "low" },
  "carburant": { "value": une valeur EXACTE parmi ["essence","diesel","hybride","electrique"] ou null, "confidence": "high" | "medium" | "low" },
  "categorie": { "value": une valeur EXACTE parmi ["economique","compacte","berline","suv","utilitaire","minibus","luxe"] ou null, "confidence": "high" | "medium" | "low" }
}

Règles strictes :
- "immatriculation" = « Numéro d'immatriculation » au format « chiffres | lettre arabe | chiffres » : l'écrit « 68013-ب-72 » devient « 68013 | ب | 72 ».
- "immatriculationAnterieure" = « Immatriculation antérieure » tel qu'imprimé (ex. WW675804). Un simple tiret « - » signifie null.
- "dateMiseEnCirculation" = « Première mise en circulation » ; "dateFinValidite" = « Fin de validité ». Dates JJ/MM/AAAA converties en AAAA-MM-JJ.
- "annee" = l'année de la première mise en circulation (4 chiffres).
- "usage" tel qu'imprimé (ex. « Véhicule loué sans chauffeur »). "proprietaire" tel qu'imprimé (nom de la personne ou de la société, sans l'adresse).
- "marque" = « Marque » (ex. DACIA). "modele" = « Modèle » (ex. SANDERO). "type" = « Type » : le code alphanumérique du modèle, NE PAS le mettre dans "modele" ni "finition". "genre" = « Genre » (ex. CONDUITE INTERIEURE).
- "vin" = « N° du chassis » : 17 caractères, tel qu'imprimé, sans espace. Ne le confonds pas avec le « Type » ni avec le numéro de la ligne du bas.
- "carburant" : Diesel ou Gasoil → "diesel" ; Essence → "essence" ; Hybride → "hybride" ; Electrique → "electrique". Sinon null.
- "categorie" : null SAUF si le « Genre » l'indique clairement : camionnette ou véhicule utilitaire → "utilitaire" ; autocar ou minibus → "minibus". « Conduite intérieure » ne suffit pas : mets null.
- "finition" et "couleur" ne figurent jamais sur la carte : toujours null.
- "puissanceFiscale" en CV (ex. 6), "nombreCylindres" (ex. 4), "ptac" et "poidsVide" en kilogrammes (nombre seul).
- Si un champ n'est pas lisible ou absent de la face photographiée, mets "value": null et "confidence": "low". Ne devine JAMAIS une valeur plausible.
- "confidence": "high" seulement si le texte est net et sans ambiguïté. "medium" si lisible mais avec un doute raisonnable. "low" sinon.
- Le document est bilingue français / arabe : lis la version française (ou latine) quand elle existe.`;

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

function cinField(raw: unknown): Field<string> {
  const field = textField(raw, 20);
  if (field.value === null) return field;
  const cin = field.value.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{1,2}\d{3,8}$/.test(cin) ? { value: cin, confidence: field.confidence } : { value: null, confidence: 'low' };
}

function sanitizeLicence(raw: unknown) {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    nom: textField(s.nom),
    prenom: textField(s.prenom),
    cin: cinField(s.cin),
    numeroPermis: textField(s.numeroPermis),
    restrictions: textField(s.restrictions, 40),
    dateDelivrance: dateField(s.dateDelivrance),
    dateExpiration: dateField(s.dateExpiration),
    categories: categoriesField(s.categories),
    dateNaissance: dateField(s.dateNaissance),
    autorite: textField(s.autorite),
  };
}

function sanitizeRegistration(raw: unknown) {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const plate = textField(s.immatriculation, 40);
  const previous = textField(s.immatriculationAnterieure, 40);
  const vin = textField(s.vin, 40);
  return {
    immatriculation: plate,
    immatriculationAnterieure: previous.value && /^[-–—\s]+$/.test(previous.value) ? { value: null, confidence: 'low' as Confidence } : previous,
    dateMiseEnCirculation: dateField(s.dateMiseEnCirculation),
    dateFinValidite: dateField(s.dateFinValidite),
    usage: textField(s.usage, 80),
    proprietaire: textField(s.proprietaire, 120),
    vin: vin.value ? { ...vin, value: vin.value.replace(/\s+/g, '').toUpperCase() } : vin,
    marque: textField(s.marque, 60),
    modele: textField(s.modele, 60),
    finition: { value: null, confidence: 'low' as Confidence },
    type: textField(s.type, 60),
    genre: textField(s.genre, 60),
    annee: numberField(s.annee, 1950, new Date().getFullYear() + 1),
    couleur: { value: null, confidence: 'low' as Confidence },
    nombrePlaces: numberField(s.nombrePlaces, 1, 9),
    nombreCylindres: numberField(s.nombreCylindres, 1, 16),
    puissanceFiscale: numberField(s.puissanceFiscale, 1, 60),
    ptac: numberField(s.ptac, 100, 60000),
    poidsVide: numberField(s.poidsVide, 100, 60000),
    carburant: enumField(s.carburant, FUEL_VALUES),
    categorie: enumField(s.categorie, CATEGORY_VALUES),
  };
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
    const result = await callGeminiJson(apiKey, documentType === 'permis' ? LICENCE_PROMPT : REGISTRATION_PROMPT, [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: 'Extrais les champs de ce document, au format JSON demandé.' },
    ]);
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
