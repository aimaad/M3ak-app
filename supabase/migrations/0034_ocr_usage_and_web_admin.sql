-- M3ak — console d'administration WEB : suivi de l'utilisation de l'OCR cloud et estimation du coût, par entreprise.
--
--  * ocr_usage_events : une ligne par analyse envoyée à Gemini (entreprise, type de document, succès/échec, nombre
--    de « tokens » facturables). AUCUNE image, AUCUNE valeur lue, AUCUN nom : seulement des compteurs.
--    Écrite uniquement par la fonction serveur (rôle service) ; illisible depuis l'app.
--  * platform_ocr_pricing : tarif Google saisi par l'administrateur (jamais deviné par l'application).
--  * agency_ocr_settings.key_tier : « gratuite » ou « payante » — le coût estimé n'est calculé que pour une clé payante.
--  * RPC réservées à l'administrateur plateforme (platform_admins) : vue d'ensemble, tarif, enregistrement de la clé.
-- Le coût affiché est une ESTIMATION (tokens × tarif saisi) ; la facture réelle est celle de Google.
-- Aucune donnée existante n'est modifiée.

create table public.ocr_usage_events (
  id bigint generated always as identity primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  created_at timestamptz not null default now(),
  document_type text not null check (document_type in ('permis', 'carte_grise')),
  ok boolean not null,
  error_code text,
  model text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0)
);
create index ocr_usage_events_agency_idx on public.ocr_usage_events (agency_id, created_at desc);
create index ocr_usage_events_created_idx on public.ocr_usage_events (created_at desc);
alter table public.ocr_usage_events enable row level security;
revoke all on public.ocr_usage_events from public, anon, authenticated;

create table public.platform_ocr_pricing (
  id smallint primary key default 1 check (id = 1),
  input_usd_per_million numeric(12, 6) check (input_usd_per_million is null or input_usd_per_million >= 0),
  output_usd_per_million numeric(12, 6) check (output_usd_per_million is null or output_usd_per_million >= 0),
  usd_to_mad numeric(8, 4) check (usd_to_mad is null or usd_to_mad > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
insert into public.platform_ocr_pricing (id) values (1) on conflict do nothing;
alter table public.platform_ocr_pricing enable row level security;
revoke all on public.platform_ocr_pricing from public, anon, authenticated;

alter table public.agency_ocr_settings
  add column if not exists key_tier text not null default 'free' check (key_tier in ('free', 'paid'));

-- Remplace l'ancienne liste (0033) par une vue d'ensemble avec l'utilisation.
drop function if exists public.admin_list_ocr_agencies();
drop function if exists public.admin_set_ocr_key(uuid, text);

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
            'key_updated_at', s.key_updated_at,
            'scans', coalesce(u.scans, 0),
            'scans_ok', coalesce(u.scans_ok, 0),
            'scans_failed', coalesce(u.scans_failed, 0),
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
          select count(*) as scans,
                 count(*) filter (where e.ok) as scans_ok,
                 count(*) filter (where not e.ok) as scans_failed,
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

create or replace function public.admin_set_ocr_key(p_agency_id uuid, p_key text, p_tier text default 'free')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := btrim(coalesce(p_key, ''));
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.agencies where id = p_agency_id) then
    raise exception 'agency_not_found';
  end if;
  if length(cleaned) < 20 or length(cleaned) > 200 or cleaned !~ '^\S+$' then
    raise exception 'invalid_key_format';
  end if;
  if p_tier not in ('free', 'paid') then
    raise exception 'invalid_tier';
  end if;

  insert into public.agency_ocr_settings (agency_id, gemini_api_key, key_tier, key_updated_by, key_updated_at)
  values (p_agency_id, cleaned, p_tier, auth.uid(), now())
  on conflict (agency_id) do update
    set gemini_api_key = excluded.gemini_api_key,
        key_tier = excluded.key_tier,
        key_updated_by = excluded.key_updated_by,
        key_updated_at = excluded.key_updated_at;

  insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label, details)
  values (p_agency_id, auth.uid(), 'Administration M3AK', 'ocr_key_set', 'Analyse Gemini',
          jsonb_build_object('key_last4', right(cleaned, 4), 'tier', p_tier));
end;
$$;

-- Change seulement l'offre (gratuite / payante) d'une clé déjà en place, sans la ressaisir.
create or replace function public.admin_set_ocr_key_tier(p_agency_id uuid, p_tier text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  if p_tier not in ('free', 'paid') then
    raise exception 'invalid_tier';
  end if;
  update public.agency_ocr_settings set key_tier = p_tier, key_updated_by = auth.uid(), key_updated_at = now()
    where agency_id = p_agency_id and gemini_api_key is not null;
  if not found then
    raise exception 'key_not_set';
  end if;
end;
$$;

create or replace function public.admin_set_ocr_pricing(p_input_usd numeric, p_output_usd numeric, p_usd_to_mad numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  if p_input_usd is not null and p_input_usd < 0 or p_output_usd is not null and p_output_usd < 0
     or p_usd_to_mad is not null and p_usd_to_mad <= 0 then
    raise exception 'invalid_pricing';
  end if;
  update public.platform_ocr_pricing
    set input_usd_per_million = p_input_usd, output_usd_per_million = p_output_usd,
        usd_to_mad = p_usd_to_mad, updated_at = now(), updated_by = auth.uid()
    where id = 1;
end;
$$;

revoke all on function
  public.admin_ocr_overview(timestamptz, timestamptz), public.admin_set_ocr_key(uuid, text, text),
  public.admin_set_ocr_key_tier(uuid, text), public.admin_set_ocr_pricing(numeric, numeric, numeric)
  from public, anon;
grant execute on function
  public.admin_ocr_overview(timestamptz, timestamptz), public.admin_set_ocr_key(uuid, text, text),
  public.admin_set_ocr_key_tier(uuid, text), public.admin_set_ocr_pricing(numeric, numeric, numeric)
  to authenticated;
