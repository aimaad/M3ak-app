// M3ak — analyse UNIQUE d'un exemple de contrat par Google Gemini, avec la clé d'API PROPRE À L'ENTREPRISE.
//
// Le propriétaire envoie une fois un contrat (PDF ou photos, vierge ou rempli). Gemini en extrait un MODÈLE VIERGE
// (blocs de mise en page + champs automatiques) que l'app enregistre. Ensuite chaque contrat ne fait que remplir ce
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

const PROMPT = `Tu analyses un exemple de contrat de location de voiture d'une agence (Maroc), fourni en PDF ou en photos, vierge ou déjà rempli.
Ta mission : reconstruire un MODÈLE VIERGE qui reproduit le plus fidèlement possible la mise en page et TOUT le texte de ce contrat, pour pouvoir le regénérer pour chaque location.

Réponds UNIQUEMENT avec un objet JSON valide (aucun texte autour, aucune balise markdown) :
{
  "direction": "ltr" ou "rtl" (sens principal du document),
  "blocks": [ ...blocs dans l'ordre exact du document... ]
}

Types de blocs autorisés (aucun autre) :
- {"type":"header","logo":"left"|"center"|"right"|"none","left":"texte","center":"texte","right":"texte"}  en-tête : à utiliser pour le bandeau du haut (nom de l'agence, adresse, téléphone…). Mets logo à la position où un logo est visible.
- {"type":"heading","text":"…","size":"xs|sm|md|lg|xl","align":"left|center|right","bold":true,"underline":false,"uppercase":false,"border":"none|bottom|box","rtl":false}
- {"type":"paragraph","text":"…","size":"…","align":"…","bold":false,"italic":false,"border":"none|box","rtl":false,"color":"default|muted|accent"}   retours à la ligne avec \\n
- {"type":"list","items":["…"],"numbered":true,"rtl":false}
- {"type":"fields","columns":1 ou 2,"bordered":true,"rows":[{"label":"Nom du locataire","value":"{{client_nom}}","optional":false}]}   tableau « libellé : valeur »
- {"type":"columns","bordered":true,"cells":[{"title":"…","text":"…","align":"…","rtl":false,"lang":"fr"|"ar"}]}   2 ou 3 colonnes de texte côte à côte (ex. français | arabe)
- {"type":"signatures","boxes":[{"role":"client","label":"Le locataire"},{"role":"agency","label":"Pour l'agence"}]}   zones de signature (role "client" ou "agency")
- {"type":"rule"}  trait horizontal ; {"type":"spacer","size":"sm|md|lg"} ; {"type":"pageBreak"}
- Option "showIf" sur n'importe quel bloc : "hasDrivers" (conducteurs supplémentaires), "hasConditions" (conditions particulières), "hasDeparture" (état des lieux au départ).

RÈGLES STRICTES
1. Recopie fidèlement TOUT le texte fixe du contrat (articles, clauses, mentions légales), dans sa langue d'origine (français et/ou arabe), sans résumer, sans traduire, sans corriger.
2. Chaque information propre à UNE location doit devenir un champ automatique parmi cette liste EXACTE : ${PLACEHOLDERS.map((p) => `{{${p}}}`).join(' ')}.
   - Si l'exemple est déjà rempli, REMPLACE toutes les données personnelles ou spécifiques (nom du client, CIN, téléphone, plaque, dates, montants, adresse du client, numéro de contrat) par le champ qui convient. N'écris JAMAIS le nom, le CIN, le téléphone ou l'adresse d'un vrai client dans le modèle.
   - Les informations de l'agence elle-même (nom, adresse, téléphone, e-mail) doivent aussi devenir {{agence_nom}}, {{agence_adresse}}, etc.
   - Une information à remplir qui n'a pas de champ dans la liste (ex. numéro de permis, heure précise) : laisse une ligne de points « …………… » à sa place. N'invente aucun nom de champ.
3. Les rubriques facultatives (ex. conducteur supplémentaire, observations) : "optional": true dans fields.
4. Reproduis la structure : ordre des rubriques, titres, alignements, tableaux, colonnes, encadrés, taille relative du texte, zones de signature et de cachet. Si le contrat est bilingue en colonnes, utilise "columns" avec "lang".
5. Si une zone « signature / cachet » est présente, utilise un bloc "signatures" avec les libellés du contrat.
6. N'invente aucune clause. Si un passage est illisible, laisse « …… ».
7. Maximum 150 blocs.
8. Sois ÉCONOME : JSON compact sur une seule ligne, sans espaces ni retours à la ligne inutiles, sans propriété à sa valeur par défaut (n'écris pas "bold":false, "rtl":false, "border":"none"…).`;

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
  console.log(`analyse du modèle : ${files.length} fichier(s), ${Math.round(totalBytes / 1024)} Ko`);
  try {
    const result = await callGeminiJson(apiKey, PROMPT, parts, { maxOutputTokens: 30_000, deadlineMs: 120_000, preferModels: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] });
    const template = (result.json ?? null) as { blocks?: unknown } | null;
    if (!template || typeof template !== 'object' || !Array.isArray(template.blocks) || template.blocks.length === 0) {
      await recordUsage(admin, { agencyId, ok: false, errorCode: 'template_unreadable', model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
      return json({ ok: false, error: 'template_unreadable' });
    }
    console.log(`analyse du modèle terminée en ${Math.round((Date.now() - startedAt) / 1000)} s (${result.model}, ${result.usage.outputTokens} tokens)`);
    await recordUsage(admin, { agencyId, ok: true, model: result.model, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens });
    return json({ ok: true, template });
  } catch (error) {
    if (error instanceof StageTimeoutError) {
      console.error(`analyse du modèle : délai dépassé (étape ${error.stage}) après ${Math.round((Date.now() - startedAt) / 1000)} s`);
      await recordUsage(admin, { agencyId, ok: false, errorCode: 'ocr_timeout' });
      return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage} après ${Math.round((Date.now() - startedAt) / 1000)} s` });
    }
    const detail = `${error instanceof ProviderHttpError ? `provider_${error.status}: ${error.message}` : error instanceof Error ? error.message : 'unknown'} (${Math.round((Date.now() - startedAt) / 1000)} s)`;
    console.error("Échec de l'analyse du modèle de contrat :", detail.slice(0, 200));
    await recordUsage(admin, { agencyId, ok: false, errorCode: error instanceof ProviderHttpError ? `provider_${error.status}` : 'ocr_failed' });
    const busy = error instanceof ProviderHttpError && (error.status === 503 || error.status === 429);
    return json({ ok: false, error: busy ? 'ocr_busy' : 'ocr_failed', detail: detail.slice(0, 200) });
  }
});
