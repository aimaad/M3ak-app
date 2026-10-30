-- M3ak — interface d'administration PLATEFORME : l'opérateur M3AK configure la clé Gemini de chaque entreprise
-- depuis l'app, sans écrire de SQL.
--
-- Principes :
--   * « administrateur plateforme » = présent dans platform_admins (ajout uniquement par SQL / tableau de bord) ;
--     aucun utilisateur d'entreprise, même propriétaire, ne peut s'y ajouter (aucune policy, droits retirés) ;
--   * la clé est en ÉCRITURE SEULE : l'app peut l'enregistrer ou la retirer, jamais la relire ; elle n'affiche
--     que « configurée » et les 4 derniers caractères ;
--   * chaque changement est inscrit au journal de l'entreprise (sans la clé) pour la transparence ;
--   * aucun autre droit n'est donné à l'administrateur plateforme (pas de lecture des clients, véhicules, etc.).

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;

alter table public.agency_ocr_settings
  add column if not exists key_updated_by uuid references auth.users (id) on delete set null,
  add column if not exists key_updated_at timestamptz;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- Liste de toutes les entreprises avec l'état de leur clé (jamais la clé elle-même).
create or replace function public.admin_list_ocr_agencies()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'agency_id', a.id,
        'nom', a.nom,
        'ville', a.ville,
        'key_set', s.gemini_api_key is not null,
        'key_last4', case when s.gemini_api_key is not null then right(s.gemini_api_key, 4) end,
        'cloud_enabled', coalesce(s.cloud_enabled and s.gemini_api_key is not null, false),
        'key_updated_at', s.key_updated_at
      )
      order by a.nom
    )
    from public.agencies a
    left join public.agency_ocr_settings s on s.agency_id = a.id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_set_ocr_key(p_agency_id uuid, p_key text)
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

  insert into public.agency_ocr_settings (agency_id, gemini_api_key, key_updated_by, key_updated_at)
  values (p_agency_id, cleaned, auth.uid(), now())
  on conflict (agency_id) do update
    set gemini_api_key = excluded.gemini_api_key,
        key_updated_by = excluded.key_updated_by,
        key_updated_at = excluded.key_updated_at;

  insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label, details)
  values (p_agency_id, auth.uid(), 'Administration M3AK', 'ocr_key_set', 'Analyse Gemini', jsonb_build_object('key_last4', right(cleaned, 4)));
end;
$$;

create or replace function public.admin_clear_ocr_key(p_agency_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  update public.agency_ocr_settings
    set gemini_api_key = null, key_updated_by = auth.uid(), key_updated_at = now()
    where agency_id = p_agency_id;
  insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label)
  values (p_agency_id, auth.uid(), 'Administration M3AK', 'ocr_key_cleared', 'Analyse Gemini');
end;
$$;

revoke all on function
  public.is_platform_admin(), public.admin_list_ocr_agencies(), public.admin_set_ocr_key(uuid, text), public.admin_clear_ocr_key(uuid)
  from public, anon;
grant execute on function
  public.is_platform_admin(), public.admin_list_ocr_agencies(), public.admin_set_ocr_key(uuid, text), public.admin_clear_ocr_key(uuid)
  to authenticated;
