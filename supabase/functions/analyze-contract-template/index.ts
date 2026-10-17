// M3ak — analyse UNIQUE d'un exemple de contrat par Google Gemini, avec la clé d'API PROPRE À L'ENTREPRISE.
//
// Le propriétaire envoie une fois un contrat (PDF ou photos, vierge ou rempli). Gemini RECOPIE son texte (champs variables
// remplacés par des champs automatiques) ; l’app le met en forme localement et l’enregistre. Ensuite chaque contrat ne fait que remplir ce
// modèle sur le téléphone : cette fonction n'est PAS appelée à chaque réservation.
//
// Conditions pour qu'un fichier parte vers Gemini (comme scan-document) :
//   1. l'appelant est authentifié ET propriétaire de son entreprise ;
//   2. l'opérateur M3AK a enregistré une clé Gemini pour CETTE entreprise ;
//   3. le propriétaire a donné son accord à la lecture automatique des documents (cloud_enabled).
// Garde-fous : aucune clé globale ni autre fournisseur ; ni le fichier ni le texte du contrat ne sont stockés ou
// journalisés ; si l'exemple est rempli, les données personnelles doivent être remplacées par des champs ; la réponse
// est un simple JSON que l'app revalide strictement ; limite de 10 analyses par jour et par entreprise.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

import { callGeminiJson, ProviderHttpError, StageTimeoutError, type GeminiPart } from '../_shared/gemini.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILES = 6;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;
const DAILY_LIMIT = 10;

const PLACEHOLDERS = [
  'numero', 'date_contrat', 'ville_contrat',
  'agence_nom', 'agence_raison_sociale', 'agence_adresse', 'agence_ville', 'agence_telephone', 'agence_email',
  'client_nom', 'client_cin', 'client_telephone', 'conducteur_principal', 'autres_conducteurs',
  'vehicule', 'marque', 'modele', 'immatriculation', 'date_debut', 'date_fin', 'prix_total', 'caution',
  'etat_depart', 'accessoires_depart', 'observations_depart', 'conditions_particulieres',
];

const PROMPT = `Tu es un copiste. Tu recopies FIDÈLEMENT et INTÉGRALEMENT un contrat de location de voiture (PDF ou photos, vierge ou déjà rempli) pour en faire un modèle réutilisable.

Réponds UNIQUEMENT avec le texte du contrat, sans commentaire, sans introduction, sans bloc de code, avec ces conventions très simples :
- "# Titre" : le titre principal du contrat.
- "## Titre" : un titre d'article ou de rubrique ; "### Titre" : un sous-titre.
- "> texte" : chaque ligne du bandeau d'en-tête du haut (nom de l'agence, adresse, téléphone…).
- "- texte" : élément d'une liste à puces ; "1. texte" : élément d'une liste numérotée.
- "Libellé : valeur" : une information à remplir (ex. "Nom du locataire : {{client_nom}}"), une par ligne.
- "---" : un trait de séparation.
- Une ligne vide sépare deux paragraphes.
- "[SIGNATURES: libellé gauche | libellé droite]" à l'endroit des zones de signature et de cachet (ex. [SIGNATURES: Le locataire | Pour l'agence]).

RÈGLES STRICTES
1. Recopie TOUT le texte du contrat, mot pour mot, dans sa langue d'origine (français et/ou arabe) : chaque article, chaque clause, chaque mention légale, chaque ligne de bas de page. N'en résume rien, n'en omets rien, ne traduis rien, ne corrige rien. Si le contrat est en deux colonnes (ex. français | arabe), recopie d'abord toute une colonne, puis l'autre.
2. Chaque information propre à UNE location devient un champ de cette liste EXACTE : ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(' ')}.
   - Si l'exemple est déjà rempli, REMPLACE les données personnelles ou spécifiques (nom du client, CIN, téléphone, adresse du client, plaque, dates, montants, numéro de contrat) par le champ qui convient. N'écris JAMAIS le nom, le CIN, le téléphone ou l'adresse d'un vrai client.
   - Les informations de l'agence (nom, adresse, téléphone, e-mail) deviennent {{agence_nom}}, {{agence_adresse}}, {{agence_telephone}}, etc.
   - Une information à remplir sans champ correspondant (ex. numéro de permis, heure) : laisse une ligne de points « …………… ». N'invente aucun nom de champ.
3. N'invente aucune clause. Un passage illisible devient « …… ».`

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

type AdminClient = ReturnType<typeof createClient>;

async function recordUsage(admin: AdminClient, event: { agencyId: string; ok: boolean; errorCode?: string; model?: string; inputTokens?: number; outputTokens?: number }) {
  try {
    await withTimeout(
      'usage',
      admin.from('ocr_usage_events').insert({
        agency_id: event.agencyId,
        document_type: 'contrat_modele',
        ok: event.ok,
        error_code: event.errorCode ?? null,
        model: event.model ?? null,
        input_tokens: event.inputTokens ?? 0,
        output_tokens: event.outputTokens ?? 0,
      }),
      5_000
    );
  } catch {
    // silencieux : aucune donnée à journaliser
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
      supabase.from('agency_members').select('agency_id, role').eq('user_id', userData.user.id).limit(1).maybeSingle()
    );
    if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);
    if (membership.role !== 'owner') return json({ ok: false, error: 'owner_only' }, 403);

    const { data: settings } = await withTimeout(
      'settings',
      admin.from('agency_ocr_settings').select('cloud_enabled, gemini_api_key').eq('agency_id', membership.agency_id).maybeSingle()
    );
    if (!settings?.gemini_api_key) return json({ ok: false, error: 'ocr_not_configured' });
    if (!settings.cloud_enabled) return json({ ok: false, error: 'ocr_disabled' });
    apiKey = settings.gemini_api_key;
    agencyId = membership.agency_id;

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await withTimeout(
      'limit',
      admin.from('ocr_usage_events').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId).eq('document_type', 'contrat_modele').gte('created_at', since)
    );
    if ((count ?? 0) >= DAILY_LIMIT) return json({ ok: false, error: 'template_limit' });
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    throw error;
  }

  let body: Record<string, unknown>;
  try {
    body = (await withTimeout('body', request.json(), 90_000)) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: 'stage:body' });
    return json({ ok: false, error: 'invalid_request' }, 400);
  }

  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length === 0 || files.length > MAX_FILES) return json({ ok: false, error: 'invalid_request' }, 400);
  const parts: GeminiPart[] = [];
  let totalBytes = 0;
  for (const file of files) {
    const { mimeType, data } = (file ?? {}) as { mimeType?: unknown; data?: unknown };
    if (typeof mimeType !== 'string' || typeof data !== 'string' || !ALLOWED_MIME_TYPES.has(mimeType) || data.length === 0) {
      return json({ ok: false, error: 'invalid_file' }, 400);
    }
    totalBytes += data.length * 0.75;
    parts.push({ inlineData: { mimeType, data } });
  }
  if (totalBytes > MAX_TOTAL_BYTES) return json({ ok: false, error: 'file_too_large' }, 400);
  parts.push({ text: 'Reconstruis le modèle vierge de ce contrat, au format JSON demandé.' });

  const startedAt = Date.now();
  const trace: string[] = [];
  console.log(`analyse du modèle : ${files.length} fichier(s), ${Math.round(totalBytes / 1024)} Ko`);
  try {
    const result = await callGeminiJson(apiKey, PROMPT, parts, { maxOutputTokens: 24_000, deadlineMs: 120_000, perCallMs: 60_000, trace, plainText: true, preferModels: ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] });
    const transcription = typeof result.json === 'string' ? result.json.trim() : '';
    if (transcription.length < 40) {
      await recordUsage(admin, { agencyId, ok: false, errorCode: 'template_unreadable', model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
      return json({ ok: false, error: 'template_unreadable' });
    }
    console.log(`analyse du modèle terminée en ${Math.round((Date.now() - startedAt) / 1000)} s (${result.model}, ${result.usage.outputTokens} tokens)`);
    await recordUsage(admin, { agencyId, ok: true, model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
    return json({ ok: true, text: transcription.slice(0, 120_000) });
  } catch (error) {
    if (error instanceof StageTimeoutError) {
      console.error(`analyse du modèle : délai dépassé (étape ${error.stage}) après ${Math.round((Date.now() - startedAt) / 1000)} s — ${trace.join(' ; ')}`);
      await recordUsage(admin, { agencyId, ok: false, errorCode: 'ocr_timeout' });
      return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage} après ${Math.round((Date.now() - startedAt) / 1000)} s — ${trace.join(' ; ')}`.slice(0, 190) });
    }
    const detail = `${error instanceof ProviderHttpError ? `provider_${error.status}: ${error.message}` : error instanceof Error ? error.message : 'unknown'} (${Math.round((Date.now() - startedAt) / 1000)} s — ${trace.join(' ; ')})`;
    console.error("Échec de l'analyse du modèle de contrat :", detail.slice(0, 200));
    await recordUsage(admin, { agencyId, ok: false, errorCode: error instanceof ProviderHttpError ? `provider_${error.status}` : 'ocr_failed' });
    const busy = error instanceof ProviderHttpError && (error.status === 503 || error.status === 429);
    return json({ ok: false, error: busy ? 'ocr_busy' : 'ocr_failed', detail: detail.slice(0, 190) });
  }
});
