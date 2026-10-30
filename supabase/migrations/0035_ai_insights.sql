-- M3ak — recommandations et indicateurs proposés par l'IA sur la page d'accueil (propriétaire / responsable).
--
-- Même principe que la lecture des documents : l'IA n'est utilisée que si l'entreprise a une clé Gemini (configurée par
-- l'administrateur M3AK dans la console web) ET que le PROPRIÉTAIRE a activé « Recommandations IA » (accord distinct de
-- celui de la lecture des documents : ici ne partent que des statistiques agrégées, jamais de photo ni de nom de client).
-- Sans clé ou sans accord : l'app affiche que la fonction n'est pas disponible.
-- Aucune donnée existante n'est modifiée.

alter table public.agency_ocr_settings
  add column if not exists insights_enabled boolean not null default false;

-- Retirer la clé retire aussi les deux accords.
create or replace function public.ocr_settings_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.gemini_api_key is null then
    new.cloud_enabled := false;
    new.insights_enabled := false;
  end if;
  return new;
end;
$$;

create or replace function public.get_ocr_settings(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  settings public.agency_ocr_settings;
begin
  if not public.is_agency_member(p_agency_id) then
    raise exception 'not_allowed';
  end if;
  select * into settings from public.agency_ocr_settings where agency_id = p_agency_id;
  return jsonb_build_object(
    'cloud_available', coalesce(settings.gemini_api_key is not null, false),
    'cloud_enabled', coalesce(settings.cloud_enabled and settings.gemini_api_key is not null, false),
    'insights_enabled', coalesce(settings.insights_enabled and settings.gemini_api_key is not null, false)
  );
end;
$$;

-- Accord du propriétaire (et seulement lui) pour les recommandations IA.
create or replace function public.set_ai_insights_enabled(p_agency_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.agency_role_of(p_agency_id) is distinct from 'owner' then
    raise exception 'not_allowed';
  end if;
  if p_enabled and not exists (
    select 1 from public.agency_ocr_settings where agency_id = p_agency_id and gemini_api_key is not null
  ) then
    raise exception 'ocr_key_missing';
  end if;
  update public.agency_ocr_settings set insights_enabled = p_enabled where agency_id = p_agency_id;
  return public.get_ocr_settings(p_agency_id);
end;
$$;

revoke all on function public.set_ai_insights_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_ai_insights_enabled(uuid, boolean) to authenticated;

-- Le suivi d'utilisation compte aussi les appels « recommandations ».
alter table public.ocr_usage_events drop constraint if exists ocr_usage_events_document_type_check;
alter table public.ocr_usage_events
  add constraint ocr_usage_events_document_type_check check (document_type in ('permis', 'carte_grise', 'insights'));

-- Console web : « analyses » = documents lus ; « rapports IA » = recommandations. Tokens et coût comptent les deux.
create or replace function public.admin_ocr_overview(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  pricing public.platform_ocr_pricing;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  select * into pricing from public.platform_ocr_pricing where id = 1;

  return jsonb_build_object(
    'pricing', jsonb_build_object(
      'input_usd_per_million', pricing.input_usd_per_million,
      'output_usd_per_million', pricing.output_usd_per_million,
      'usd_to_mad', pricing.usd_to_mad
    ),
    'agencies', coalesce((
      select jsonb_agg(row_json order by nom)
      from (
        select
          a.nom,
          jsonb_build_object(
            'agency_id', a.id,
            'nom', a.nom,
            'ville', a.ville,
            'created_at', a.created_at,
            'members', (select count(*) from public.agency_members m where m.agency_id = a.id),
            'key_set', s.gemini_api_key is not null,
            'key_last4', case when s.gemini_api_key is not null then right(s.gemini_api_key, 4) end,
            'key_tier', coalesce(s.key_tier, 'free'),
            'cloud_enabled', coalesce(s.cloud_enabled and s.gemini_api_key is not null, false),
            'insights_enabled', coalesce(s.insights_enabled and s.gemini_api_key is not null, false),
            'key_updated_at', s.key_updated_at,
            'scans', coalesce(u.scans, 0),
            'scans_ok', coalesce(u.scans_ok, 0),
            'scans_failed', coalesce(u.scans_failed, 0),
            'insights_calls', coalesce(u.insights_calls, 0),
            'input_tokens', coalesce(u.input_tokens, 0),
            'output_tokens', coalesce(u.output_tokens, 0),
            'last_scan_at', u.last_scan_at,
            'cost_usd', case
              when coalesce(s.key_tier, 'free') = 'free' then 0
              when pricing.input_usd_per_million is null or pricing.output_usd_per_million is null then null
              else round((coalesce(u.input_tokens, 0) * pricing.input_usd_per_million
                        + coalesce(u.output_tokens, 0) * pricing.output_usd_per_million) / 1000000.0, 4)
            end
          ) as row_json
        from public.agencies a
        left join public.agency_ocr_settings s on s.agency_id = a.id
        left join lateral (
          select count(*) filter (where e.document_type <> 'insights') as scans,
                 count(*) filter (where e.document_type <> 'insights' and e.ok) as scans_ok,
                 count(*) filter (where e.document_type <> 'insights' and not e.ok) as scans_failed,
                 count(*) filter (where e.document_type = 'insights') as insights_calls,
                 sum(e.input_tokens) as input_tokens,
                 sum(e.output_tokens) as output_tokens,
                 max(e.created_at) as last_scan_at
          from public.ocr_usage_events e
          where e.agency_id = a.id
            and (p_from is null or e.created_at >= p_from)
            and (p_to is null or e.created_at < p_to)
        ) u on true
      ) t
    ), '[]'::jsonb)
  );
end;
$$;
