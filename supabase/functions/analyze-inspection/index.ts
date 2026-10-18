// M3ak — analyse d'une inspection par Google Gemini : détecte les dommages (carrosserie, jantes, pneus, vitres, intérieur :
// sièges, tableau de bord, frein à main, plafond, tapis, coffre) et, au retour, compare chaque angle avec la photo prise
// au départ pour ne signaler comme NOUVEAUX que les dommages apparus pendant la location.
//
// Mêmes garde-fous que `scan-document` : clé Gemini PROPRE À L'ENTREPRISE, accord du propriétaire obligatoire, aucune
// clé globale, aucune image ni valeur stockée ou journalisée par la fonction. Les photos sont lues dans le stockage privé
// avec le rôle service, seulement après avoir vérifié que l'appelant a le droit de voir cette inspection (RLS).
// L'IA propose, l'employé décide : tous les dommages créés ici ont le statut « proposé ».

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

import { callGeminiJson, ProviderHttpError, StageTimeoutError, type GeminiPart } from '../_shared/gemini.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHOTOS_BUCKET = 'inspection-photos';
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const ZONES = [
  'pare_choc_avant', 'pare_choc_arriere', 'capot', 'toit', 'coffre',
  'aile_avant_gauche', 'aile_avant_droit', 'aile_arriere_gauche', 'aile_arriere_droit',
  'portiere_avant_gauche', 'portiere_avant_droit', 'portiere_arriere_gauche', 'portiere_arriere_droit',
  'pare_brise', 'lunette_arriere', 'vitre', 'retroviseur_gauche', 'retroviseur_droit',
  'calandre', 'phare_avant', 'feu_arriere', 'bas_de_caisse',
  'jante_avant_gauche', 'jante_avant_droit', 'jante_arriere_gauche', 'jante_arriere_droit',
  'pneu_avant_gauche', 'pneu_avant_droit', 'pneu_arriere_gauche', 'pneu_arriere_droit',
  'tableau_de_bord', 'volant', 'frein_a_main', 'siege_avant_gauche', 'siege_avant_droit', 'banquette_arriere',
  'plafond', 'tapis', 'coffre_interieur', 'interieur', 'autre',
];
const TYPES = ['rayure', 'choc', 'bosse', 'fissure', 'eclat', 'piece_manquante', 'salissure', 'tache', 'dechirure', 'brulure', 'casse', 'usure', 'autre'];
const SEVERITIES = ['leger', 'modere', 'grave'];

/** Groupes de photos envoyés ensemble (une requête par groupe, en parallèle) : plus précis qu'une seule requête géante. */
const BATCHES: { key: string; angles: string[] }[] = [
  { key: 'avant', angles: ['avant', 'avant_gauche', 'avant_droit', 'capot', 'pare_brise'] },
  { key: 'cotes', angles: ['lateral_gauche', 'arriere_gauche', 'lateral_droit', 'arriere_droit'] },
  { key: 'arriere_toit_roues', angles: ['arriere', 'toit', 'jante_avant_gauche', 'jante_avant_droit', 'jante_arriere_gauche', 'jante_arriere_droit'] },
  { key: 'habitacle_avant', angles: ['tableau_de_bord', 'volant', 'frein_a_main', 'tapis'] },
  { key: 'sieges_coffre', angles: ['siege_avant_gauche', 'siege_avant_droit', 'banquette_arriere', 'plafond', 'coffre_interieur', 'interieur', 'autre'] },
];

const ANGLE_LABELS: Record<string, string> = {
  avant: 'face avant', avant_gauche: 'avant gauche (3/4)', avant_droit: 'avant droit (3/4)', lateral_gauche: 'côté gauche entier',
  lateral_droit: 'côté droit entier', arriere_gauche: 'arrière gauche (3/4)', arriere_droit: 'arrière droit (3/4)', arriere: 'face arrière',
  capot: 'capot', toit: 'toit', pare_brise: 'pare-brise',
  jante_avant_gauche: 'roue avant gauche (jante et pneu)', jante_avant_droit: 'roue avant droite (jante et pneu)',
  jante_arriere_gauche: 'roue arrière gauche (jante et pneu)', jante_arriere_droit: 'roue arrière droite (jante et pneu)',
  tableau_de_bord: 'tableau de bord et compteur', volant: 'volant et console centrale', frein_a_main: 'frein à main, levier et boîte à gants',
  siege_avant_gauche: 'siège conducteur', siege_avant_droit: 'siège passager', banquette_arriere: 'banquette arrière',
  plafond: 'plafond', tapis: 'tapis de sol', coffre_interieur: 'coffre ouvert', interieur: 'intérieur', autre: 'autre vue',
};

type Confidence = number;
type Damage = {
  angle: string;
  zone: string;
  type: string;
  gravite: string;
  confiance: Confidence;
  nouveau: boolean;
  description: string | null;
  cout: number | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
};
type BatchObservations = { resume: string | null; proprete: string | null; kilometrage: number | null; niveauCarburant: number | null };

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

const SYSTEM_PROMPT = `Tu es un expert en expertise de véhicules de location (carrosserie, jantes, vitrages, sellerie, habitacle) au Maroc. Tu inspectes des photos prises par un employé d'agence pour repérer TOUS les dommages, même petits, à l'extérieur ET à l'intérieur : rayures, éraflures de jante, bosses, chocs, éclats de peinture, fissures de pare-brise, optiques cassés, pneus abîmés ou usés, sièges tachés / déchirés / brûlés, plastiques cassés (tableau de bord, console, frein à main, poignées), plafond taché ou décollé, tapis manquants, troués ou très sales, coffre abîmé, équipements manquants (roue de secours, triangle, cric, appuie-têtes).

Tu reçois, pour chaque angle, une photo du RETOUR et — si elle existe — la photo du DÉPART du même angle. Compare-les finement : un dommage est NOUVEAU (nouveau = true) seulement s'il est visible au retour et absent de la photo de départ du MÊME angle. S'il est déjà visible au départ, nouveau = false. S'il n'y a pas de photo de départ pour cet angle, nouveau = false (on ne peut pas comparer). Quand il n'y a QUE des photos de départ (inspection de départ), nouveau = false pour tout : tu enregistres l'état existant.

Règles de fiabilité :
- Ne confonds pas un dommage avec : reflet, ombre, gouttes d'eau, poussière ou boue lavable, saleté superficielle, angle de prise de vue différent, différence de lumière. En cas de doute réel, baisse "confiance" (0 à 1) plutôt que d'inventer ; n'invente JAMAIS un dommage qui n'est pas visible.
- Une salissure légère n'est pas un dommage (utilise "salissure" ou "tache" seulement si elle est importante ou semble permanente).
- Sois exhaustif : signale chaque dommage distinct séparément (une rayure sur la portière et une bosse sur l'aile = 2 entrées).
- "zone" doit être EXACTEMENT une de ces valeurs : ${ZONES.join(', ')}.
- "type" doit être EXACTEMENT une de : ${TYPES.join(', ')}.
- "gravite" : "leger" (superficiel, peut se polir/nettoyer), "modere" (peinture ou matière atteinte, réparation nécessaire), "grave" (déformation, pièce cassée ou fendue, danger, remplacement).
- "confiance" : nombre entre 0 et 1 (1 = certain).
- "coutEstimeMAD" : coût de réparation raisonnable au Maroc, en dirhams (ex. polissage léger 200-400 ; rayure de portière 600-1500 ; bosse avec peinture 1000-3000 ; jante éraflée 300-900 ; pare-brise fissuré 1500-4000 ; siège déchiré 800-2500 ; tache importante de siège 200-500 ; plastique cassé 300-1500). C'est une estimation que l'employé corrigera.
- "bbox" : cadre du dommage sur la photo du RETOUR (ou de l'unique photo), coordonnées relatives entre 0 et 1 : {"x":gauche,"y":haut,"w":largeur,"h":hauteur}. Mets null si tu ne peux pas le situer.
- "angle" : l'angle de la photo où le dommage est visible, parmi ceux fournis.
- "description" : une phrase courte en français (ex. « Rayure profonde d'environ 12 cm sur la portière arrière droite »).
- Sur les photos du tableau de bord : lis "kilometrage" (entier, km) et "niveauCarburant" (0 à 100, en pourcentage de la jauge) SEULEMENT s'ils sont nets, sinon null. Note les voyants allumés dans les dommages (zone "tableau_de_bord", type "autre") seulement s'ils signalent un défaut.
- "proprete" : état général de propreté visible ("propre", "correcte" ou "sale"), ou null si on ne peut pas juger.

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni balises markdown, exactement de cette forme :
{
  "resume": "une à deux phrases en français sur ce groupe de photos",
  "proprete": "propre" | "correcte" | "sale" | null,
  "kilometrage": entier ou null,
  "niveauCarburant": entier 0-100 ou null,
  "degats": [ { "angle": string, "zone": string, "type": string, "gravite": string, "confiance": number, "nouveau": boolean, "description": string, "coutEstimeMAD": number, "bbox": {"x":number,"y":number,"w":number,"h":number} | null } ]
}
S'il n'y a aucun dommage, "degats" est un tableau vide.`;

function num(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function sanitizeDamages(raw: unknown, allowedAngles: Set<string>, hasDepartForAngle: (angle: string) => boolean, isDepartInspection: boolean): Damage[] {
  const list = typeof raw === 'object' && raw !== null && Array.isArray((raw as { degats?: unknown }).degats) ? ((raw as { degats: unknown[] }).degats) : [];
  const out: Damage[] = [];
  for (const item of list.slice(0, 60)) {
    if (typeof item !== 'object' || item === null) continue;
    const d = item as Record<string, unknown>;
    const angle = typeof d.angle === 'string' && allowedAngles.has(d.angle) ? d.angle : null;
    const zone = typeof d.zone === 'string' && ZONES.includes(d.zone) ? d.zone : null;
    const type = typeof d.type === 'string' && TYPES.includes(d.type) ? d.type : 'autre';
    const gravite = typeof d.gravite === 'string' && SEVERITIES.includes(d.gravite) ? d.gravite : 'leger';
    const confiance = num(d.confiance, 0, 1);
    if (!angle || !zone || confiance === null || confiance < 0.3) continue;
    const cout = num(d.coutEstimeMAD, 0, 50_000);
    let bbox: Damage['bbox'] = null;
    if (typeof d.bbox === 'object' && d.bbox !== null) {
      const b = d.bbox as Record<string, unknown>;
      const x = num(b.x, 0, 1), y = num(b.y, 0, 1), w = num(b.w, 0.005, 1), h = num(b.h, 0.005, 1);
      if (x !== null && y !== null && w !== null && h !== null) bbox = { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
    }
    // Pas d'inspection de départ ou pas de photo de départ pour cet angle : on ne peut pas affirmer qu'un dommage est nouveau.
    const comparable = !isDepartInspection && hasDepartForAngle(angle);
    out.push({
      angle,
      zone,
      type,
      gravite,
      confiance: Math.round(confiance * 1000) / 1000,
      nouveau: comparable && d.nouveau === true,
      description: typeof d.description === 'string' && d.description.trim() ? d.description.trim().slice(0, 300) : null,
      cout: cout === null ? null : Math.round(cout),
      bbox,
    });
  }
  return out;
}

/**
 * Deux angles voisins (ex. face avant + 3/4 avant) voient parfois le même dommage : pour une même zone et un même type
 * on ne garde que l'angle où la lecture est la plus sûre. Plusieurs dommages du même type sur la même photo (deux
 * rayures sur une portière) restent bien séparés.
 */
function dedupe(damages: Damage[]): Damage[] {
  const groups = new Map<string, Damage[]>();
  for (const damage of damages) {
    const key = `${damage.zone}|${damage.type}`;
    groups.set(key, [...(groups.get(key) ?? []), damage]);
  }
  const kept: Damage[] = [];
  for (const group of groups.values()) {
    const bestAngle = group.reduce((best, d) => (d.confiance > best.confiance ? d : best)).angle;
    kept.push(...group.filter((d) => d.angle === bestAngle));
  }
  return kept;
}

async function downloadBase64(admin: ReturnType<typeof createClient>, path: string): Promise<string | null> {
  const { data, error } = await admin.storage.from(PHOTOS_BUCKET).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.byteLength > MAX_PHOTO_BYTES) return null;
  return encodeBase64(bytes);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (request.method !== 'POST') return json({ ok: false, error: 'invalid_request' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ ok: false, error: 'not_authenticated' }, 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try {
    body = (await withTimeout('body', request.json(), 10_000)) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400);
  }
  const inspectionId = typeof body.inspectionId === 'string' && /^[0-9a-f-]{36}$/i.test(body.inspectionId) ? body.inspectionId : null;
  if (!inspectionId) return json({ ok: false, error: 'invalid_request' }, 400);

  let apiKey: string;
  let inspection: { id: string; agency_id: string; rental_id: string; type: 'depart' | 'retour' };
  try {
    const { data: userData, error: userError } = await withTimeout('auth', supabase.auth.getUser());
    if (userError || !userData.user) return json({ ok: false, error: 'not_authenticated' }, 401);

    // La RLS limite cette lecture aux inspections que l'appelant a le droit de voir (entreprise ET filiale).
    const { data: row } = await withTimeout(
      'inspection',
      supabase.from('inspections').select('id, agency_id, rental_id, type').eq('id', inspectionId).maybeSingle()
    );
    if (!row) return json({ ok: false, error: 'not_found' }, 404);
    inspection = row as typeof inspection;

    const { data: membership } = await withTimeout(
      'membership',
      supabase.from('agency_members').select('agency_id').eq('user_id', userData.user.id).eq('agency_id', inspection.agency_id).maybeSingle()
    );
    if (!membership) return json({ ok: false, error: 'not_authenticated' }, 401);

    const { data: settings } = await withTimeout(
      'settings',
      admin.from('agency_ocr_settings').select('cloud_enabled, gemini_api_key').eq('agency_id', inspection.agency_id).maybeSingle()
    );
    if (!settings?.gemini_api_key) return json({ ok: false, error: 'ocr_not_configured' });
    if (!settings.cloud_enabled) return json({ ok: false, error: 'ocr_disabled' });
    apiKey = settings.gemini_api_key;
  } catch (error) {
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    throw error;
  }

  const isDepart = inspection.type === 'depart';

  try {
    await admin.from('inspections').update({ analysis_status: 'en_cours' }).eq('id', inspection.id);

    const { data: photos } = await admin.from('inspection_photos').select('id, angle, url').eq('inspection_id', inspection.id);
    if (!photos || photos.length === 0) {
      await admin.from('inspections').update({ analysis_status: 'echec' }).eq('id', inspection.id);
      return json({ ok: false, error: 'no_photos' });
    }

    // Photos de départ de la même location (comparaison au retour).
    const departPhotos = new Map<string, string>();
    if (!isDepart) {
      const { data: departInspection } = await admin
        .from('inspections')
        .select('id')
        .eq('rental_id', inspection.rental_id)
        .eq('type', 'depart')
        .maybeSingle();
      if (departInspection) {
        const { data: rows } = await admin.from('inspection_photos').select('angle, url').eq('inspection_id', departInspection.id);
        for (const r of rows ?? []) departPhotos.set(r.angle as string, r.url as string);
      }
    }
    const photoByAngle = new Map<string, { id: string; url: string }>();
    for (const p of photos) photoByAngle.set(p.angle as string, { id: p.id as string, url: p.url as string });

    const failedZones: string[] = [];
    const observations: BatchObservations[] = [];
    let all: Damage[] = [];

    await Promise.all(
      BATCHES.map(async (batch) => {
        const angles = batch.angles.filter((angle) => photoByAngle.has(angle));
        if (angles.length === 0) return;
        const parts: GeminiPart[] = [];
        const included = new Set<string>();
        for (const angle of angles) {
          const current = await downloadBase64(admin, photoByAngle.get(angle)!.url);
          if (!current) continue;
          const departUrl = departPhotos.get(angle);
          const depart = departUrl ? await downloadBase64(admin, departUrl) : null;
          const label = ANGLE_LABELS[angle] ?? angle;
          if (depart) {
            parts.push({ text: `ANGLE « ${angle} » (${label}) — photo du DÉPART :` });
            parts.push({ inlineData: { mimeType: 'image/jpeg', data: depart } });
          }
          parts.push({ text: `ANGLE « ${angle} » (${label}) — photo du ${isDepart ? 'DÉPART (état existant)' : 'RETOUR'} :` });
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: current } });
          included.add(angle);
        }
        if (included.size === 0) return;
        parts.push({
          text: isDepart
            ? "Voici l'inspection de DÉPART : liste tous les dommages déjà présents, au format JSON demandé."
            : 'Voici le RETOUR (avec le départ quand il existe) : liste tous les dommages visibles, et marque comme nouveaux ceux absents au départ, au format JSON demandé.',
        });
        try {
          const result = await callGeminiJson(apiKey, SYSTEM_PROMPT, parts);
          const raw = result.json as Record<string, unknown>;
          all = all.concat(sanitizeDamages(raw, included, (angle) => departPhotos.has(angle), isDepart));
          observations.push({
            resume: typeof raw.resume === 'string' ? raw.resume.trim().slice(0, 400) : null,
            proprete: typeof raw.proprete === 'string' && ['propre', 'correcte', 'sale'].includes(raw.proprete) ? raw.proprete : null,
            kilometrage: batch.angles.includes('tableau_de_bord') ? num(raw.kilometrage, 0, 2_000_000) : null,
            niveauCarburant: batch.angles.includes('tableau_de_bord') ? num(raw.niveauCarburant, 0, 100) : null,
          });
        } catch (error) {
          const detail = error instanceof ProviderHttpError ? `provider_${error.status}: ${error.message}` : error instanceof Error ? error.message : 'unknown';
          console.error("Échec de l'analyse d'un groupe de photos :", batch.key, detail.slice(0, 160));
          failedZones.push(batch.key);
        }
      })
    );

    const attempted = BATCHES.filter((batch) => batch.angles.some((angle) => photoByAngle.has(angle))).length;
    if (failedZones.length >= attempted) {
      await admin.from('inspections').update({ analysis_status: 'echec', failed_zones: failedZones }).eq('id', inspection.id);
      return json({ ok: false, error: 'analysis_failed', failedZones });
    }

    const damages = dedupe(all).sort((a, b) => Number(b.nouveau) - Number(a.nouveau) || b.confiance - a.confiance);

    // Relancer remplace les propositions de l'IA ; les dommages saisis à la main restent.
    await admin.from('damages').delete().eq('inspection_id', inspection.id).eq('source', 'ia');
    if (damages.length > 0) {
      const { error: insertError } = await admin.from('damages').insert(
        damages.map((damage) => ({
          inspection_id: inspection.id,
          agency_id: inspection.agency_id,
          photo_id: photoByAngle.get(damage.angle)?.id ?? null,
          angle: damage.angle,
          zone: damage.zone,
          type: damage.type,
          gravite: damage.gravite,
          confiance: damage.confiance,
          nouveau: damage.nouveau,
          cout_estime: damage.cout,
          bbox: damage.bbox,
          description: damage.description,
          comparaison: isDepart ? 'depart' : departPhotos.has(damage.angle) ? 'comparee' : 'retour_seul',
          statut: 'propose',
          source: 'ia',
        }))
      );
      if (insertError) throw insertError;
    }

    const km = observations.map((o) => o.kilometrage).find((v) => v !== null) ?? null;
    const fuel = observations.map((o) => o.niveauCarburant).find((v) => v !== null) ?? null;
    const proprete = observations.map((o) => o.proprete).find((v) => v !== null) ?? null;
    const summary = observations.map((o) => o.resume).filter(Boolean).join(' ').slice(0, 1900) || null;
    await admin
      .from('inspections')
      .update({
        analysis_status: failedZones.length > 0 ? 'partielle' : 'terminee',
        analyzed_at: new Date().toISOString(),
        ai_summary: summary,
        failed_zones: failedZones,
        ...(km !== null ? { kilometrage: Math.round(km) } : {}),
        ...(fuel !== null ? { niveau_carburant: Math.round(fuel) } : {}),
        ...(proprete ? { proprete } : {}),
      })
      .eq('id', inspection.id);

    return json({ ok: true, damages: damages.length, failedZones, compared: !isDepart && departPhotos.size > 0 });
  } catch (error) {
    await admin.from('inspections').update({ analysis_status: 'echec' }).eq('id', inspection.id);
    if (error instanceof StageTimeoutError) return json({ ok: false, error: 'ocr_timeout', detail: `stage:${error.stage}` });
    const busy = error instanceof ProviderHttpError && (error.status === 503 || error.status === 429);
    console.error("Échec de l'analyse de l'inspection :", error instanceof Error ? error.message.slice(0, 160) : 'unknown');
    return json({ ok: false, error: busy ? 'ocr_busy' : 'analysis_failed' });
  }
});
