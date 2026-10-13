-- M3ak — lecture des documents (permis, carte grise) : réglage PAR ENTREPRISE.
--
-- Par défaut la lecture se fait SUR LE TÉLÉPHONE (aucune image ne quitte l'appareil).
-- Une entreprise peut en plus utiliser l'analyse par Google Gemini, avec SA PROPRE clé d'API :
--   * la clé est renseignée par l'opérateur M3AK (accès administrateur Supabase), jamais depuis l'app ;
--   * la clé n'est lisible que par la fonction serveur `scan-document` (rôle service) : aucune policy,
--     tous les droits retirés à anon / authenticated ;
--   * le propriétaire de l'entreprise doit en plus donner son accord (cloud_enabled) ;
--   * sans clé ET sans accord, aucune image n'est jamais envoyée à Gemini.
-- Aucune donnée existante n'est modifiée.

create table public.agency_ocr_settings (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  cloud_enabled boolean not null default false,
  gemini_api_key text,
  updated_at timestamptz not null default now(),
  constraint agency_ocr_key_length check (gemini_api_key is null or length(gemini_api_key) between 20 and 200)
);

alter table public.agency_ocr_settings enable row level security;
-- Volontairement AUCUNE policy : seule la fonction serveur (service role, qui ignore la RLS) lit la clé.
revoke all on public.agency_ocr_settings from public, anon, authenticated;

-- Retirer la clé retire aussi l'accord : pas d'analyse cloud sans clé.
create or replace function public.ocr_settings_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.gemini_api_key is null then
    new.cloud_enabled := false;
  end if;
  return new;
end;
$$;

create trigger trg_agency_ocr_settings_write
  before insert or update on public.agency_ocr_settings
  for each row execute function public.ocr_settings_before_write();

-- Ce que l'app a le droit de savoir : une clé existe-t-elle ? l'analyse cloud est-elle autorisée ? (jamais la clé)
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
    'cloud_enabled', coalesce(settings.cloud_enabled and settings.gemini_api_key is not null, false)
  );
end;
$$;

-- Accord du propriétaire (et seulement lui) pour l'analyse par Gemini.
create or replace function public.set_ocr_cloud_enabled(p_agency_id uuid, p_enabled boolean)
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
  update public.agency_ocr_settings set cloud_enabled = p_enabled where agency_id = p_agency_id;
  return public.get_ocr_settings(p_agency_id);
end;
$$;

revoke all on function public.get_ocr_settings(uuid), public.set_ocr_cloud_enabled(uuid, boolean) from public, anon;
grant execute on function public.get_ocr_settings(uuid), public.set_ocr_cloud_enabled(uuid, boolean) to authenticated;
