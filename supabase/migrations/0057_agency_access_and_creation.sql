-- M3ak — (1) la création d'une agence est réservée à l'administrateur plateforme ;
--        (2) accès limité dans le temps (essai de N jours) avec blocage TOTAL côté base de données.
--
-- Principes :
--   * plus personne ne peut insérer dans `agencies` depuis l'app (policy supprimée) ;
--   * l'administrateur plateforme crée l'agence via admin_create_agency() : elle génère un code
--     d'invitation « propriétaire » lié à l'e-mail du client (réutilise redeem_invite) ;
--   * `agencies.access_until` (null = illimité) et `agencies.suspended` : quand l'accès est expiré ou
--     suspendu, les fonctions d'appartenance (is_agency_member, agency_role_of, can_access_branches,
--     is_agency_wide…) répondent « non » → la RLS ferme TOUTES les tables de l'agence, même si
--     quelqu'un contourne l'app ;
--   * les agences existantes restent illimitées (access_until null).

alter table public.agencies
  add column if not exists access_until timestamptz,
  add column if not exists suspended boolean not null default false;

create or replace function public.agency_has_access(p_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select not a.suspended and (a.access_until is null or a.access_until > now())
    from public.agencies a where a.id = p_agency_id
  ), false);
$$;
grant execute on function public.agency_has_access(uuid) to authenticated, service_role;

-- Le propriétaire peut modifier sa fiche entreprise (policy agencies_update) mais JAMAIS ces deux colonnes :
-- seules les fonctions admin (SECURITY DEFINER) ou le tableau de bord Supabase peuvent les changer.
create or replace function public.protect_agency_access_columns()
returns trigger
language plpgsql
as $$
begin
  if (new.access_until is distinct from old.access_until or new.suspended is distinct from old.suspended)
     and current_user in ('authenticated', 'anon') then
    raise exception 'access_columns_protected';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_agency_access on public.agencies;
create trigger trg_protect_agency_access before update on public.agencies
  for each row execute function public.protect_agency_access_columns();

-- ==================================================================
-- Fonctions d'appartenance : refusent quand l'accès est expiré
-- ==================================================================

create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.agency_has_access(target_agency_id) and exists (
    select 1 from public.agency_members
    where agency_id = target_agency_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.agency_role_of(target_agency_id uuid)
returns public.agency_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.agency_members
  where agency_id = target_agency_id
    and user_id = auth.uid()
    and public.agency_has_access(target_agency_id)
  limit 1;
$$;

create or replace function public.is_agency_wide(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.agency_has_access(target_agency_id) and exists (
    select 1 from public.agency_members m
    where m.agency_id = target_agency_id
      and m.user_id = auth.uid()
      and (m.role = 'owner' or m.branch_id is null)
  );
$$;

create or replace function public.can_access_branches(
  target_agency_id uuid,
  branch_a uuid,
  branch_b uuid default null,
  branch_c uuid default null
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.agency_has_access(target_agency_id) and exists (
    select 1 from public.agency_members m
    where m.agency_id = target_agency_id
      and m.user_id = auth.uid()
      and (
        m.role = 'owner'
        or m.branch_id is null
        or m.branch_id in (branch_a, branch_b, branch_c)
      )
  );
$$;

-- Les invitations ne se créent plus quand l'accès est fermé (l'ancienne fonction devient interne).
alter function public.create_agency_invite(uuid, text, text, text, public.agency_role, uuid)
  rename to create_agency_invite_unchecked;
revoke all on function public.create_agency_invite_unchecked(uuid, text, text, text, public.agency_role, uuid)
  from public, anon, authenticated;

create or replace function public.create_agency_invite(
  p_agency_id uuid,
  p_email text,
  p_prenom text,
  p_nom text,
  p_role public.agency_role,
  p_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.agency_has_access(p_agency_id) then
    raise exception 'access_expired';
  end if;
  return public.create_agency_invite_unchecked(p_agency_id, p_email, p_prenom, p_nom, p_role, p_branch_id);
end;
$$;

-- Pas de notification (ni de push) pour une agence dont l'accès est fermé.
create or replace function public.notify_agency(
  p_agency_id uuid,
  p_kind text,
  p_category text,
  p_severity text,
  p_params jsonb,
  p_branch_ids uuid[] default null,
  p_audience text default 'all',
  p_link_type text default null,
  p_link_id uuid default null,
  p_dedupe text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branches uuid[] := coalesce(array_remove(p_branch_ids, null), '{}');
  v_branch_id uuid := case when cardinality(array_remove(p_branch_ids, null)) > 0 then (array_remove(p_branch_ids, null))[1] else null end;
  v_branch_nom text;
  v_params jsonb := coalesce(p_params, '{}'::jsonb);
begin
  begin
    -- Le nom de la filiale n'est mentionné que si l'agence en a.
    if v_branch_id is not null then
      select nom into v_branch_nom from public.branches where id = v_branch_id and agency_id = p_agency_id;
      if v_branch_nom is not null then
        v_params := v_params || jsonb_build_object('branch', v_branch_nom);
      end if;
    end if;

    insert into public.notifications (agency_id, recipient_id, branch_id, kind, category, severity, params, link_type, link_id, dedupe_key)
    select p_agency_id, m.user_id, v_branch_id, p_kind, p_category, p_severity, v_params, p_link_type, p_link_id, p_dedupe
    from public.agency_members m
    left join public.notification_preferences pr on pr.user_id = m.user_id and pr.agency_id = m.agency_id
    where m.agency_id = p_agency_id
      and public.agency_has_access(p_agency_id)
      and m.user_id is distinct from auth.uid()
      and (p_audience = 'all' or m.role in ('owner', 'manager'))
      and (m.role = 'owner' or m.branch_id is null or m.branch_id = any (v_branches))
      and coalesce(pr.enabled, true)
      and not (p_category = any (coalesce(pr.muted_categories, '{}')))
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  exception when others then
    raise warning 'notify_agency: échec ignoré (%)', sqlerrm;
  end;
end;
$$;

revoke all on function public.notify_agency(uuid, text, text, text, jsonb, uuid[], text, text, uuid, text) from public, anon, authenticated;

revoke all on function public.create_agency_invite(uuid, text, text, text, public.agency_role, uuid) from public, anon;
grant execute on function public.create_agency_invite(uuid, text, text, text, public.agency_role, uuid) to authenticated;

-- ==================================================================
-- Création d'agence : plus possible depuis l'app
-- ==================================================================

drop policy if exists "agencies_insert" on public.agencies;
-- (aucune policy d'insertion = refus pour tout utilisateur ; l'administrateur plateforme passe par la fonction ci-dessous)

-- ==================================================================
-- Administration plateforme
-- ==================================================================

-- Crée l'agence + une invitation « propriétaire » liée à l'e-mail du client. Le client crée son compte
-- avec CET e-mail, saisit le code dans l'app et devient propriétaire.
create or replace function public.admin_create_agency(
  p_nom text,
  p_ville text,
  p_owner_email text,
  p_owner_prenom text,
  p_owner_nom text,
  p_trial_days int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_owner_email, '')));
  v_nom text := trim(coalesce(p_nom, ''));
  v_agency uuid;
  v_code text;
  v_invite uuid;
  v_until timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  if length(v_nom) < 2 or length(v_nom) > 120 then
    raise exception 'invalid_name';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;
  if p_trial_days is not null and (p_trial_days < 1 or p_trial_days > 3650) then
    raise exception 'invalid_days';
  end if;
  v_until := case when p_trial_days is null then null else now() + make_interval(days => p_trial_days) end;

  insert into public.agencies (nom, ville, created_by, access_until)
  values (v_nom, nullif(trim(coalesce(p_ville, '')), ''), null, v_until)
  returning id into v_agency;

  v_code := public.generate_invite_code();
  insert into public.agency_invites (agency_id, role, email, prenom, nom, code_hash, created_by, expires_at)
  values (v_agency, 'owner', v_email, trim(coalesce(p_owner_prenom, '')), trim(coalesce(p_owner_nom, '')),
          public.invite_code_hash(v_code), auth.uid(), now() + interval '30 days')
  returning id into v_invite;

  return jsonb_build_object('agency_id', v_agency, 'invite_code', v_code, 'access_until', v_until, 'email', v_email);
end;
$$;

-- Nouvelle invitation « propriétaire » (code perdu / expiré) pour une agence sans propriétaire.
create or replace function public.admin_reissue_owner_code(p_agency_id uuid, p_owner_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_owner_email, '')));
  v_code text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_email';
  end if;
  if exists (select 1 from public.agency_members where agency_id = p_agency_id and role = 'owner') then
    raise exception 'owner_exists';
  end if;
  update public.agency_invites set revoked_at = now()
  where agency_id = p_agency_id and role = 'owner' and used_at is null and revoked_at is null;
  v_code := public.generate_invite_code();
  insert into public.agency_invites (agency_id, role, email, prenom, nom, code_hash, created_by, expires_at)
  values (p_agency_id, 'owner', v_email, '', '', public.invite_code_hash(v_code), auth.uid(), now() + interval '30 days');
  return jsonb_build_object('agency_id', p_agency_id, 'invite_code', v_code, 'email', v_email);
end;
$$;

-- Change l'accès : p_days = prolonger de N jours à partir de max(maintenant, fin actuelle) ;
-- p_unlimited = accès illimité ; p_suspended = bloque / débloque immédiatement.
create or replace function public.admin_set_agency_access(
  p_agency_id uuid,
  p_days int default null,
  p_unlimited boolean default false,
  p_suspended boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agencies;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  select * into a from public.agencies where id = p_agency_id for update;
  if a.id is null then
    raise exception 'agency_not_found';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then
    raise exception 'invalid_days';
  end if;

  if p_unlimited then
    a.access_until := null;
  elsif p_days is not null then
    a.access_until := greatest(now(), coalesce(a.access_until, now())) + make_interval(days => p_days);
  end if;
  if p_suspended is not null then
    a.suspended := p_suspended;
  end if;

  update public.agencies set access_until = a.access_until, suspended = a.suspended where id = p_agency_id;
  return jsonb_build_object('agency_id', p_agency_id, 'access_until', a.access_until, 'suspended', a.suspended);
end;
$$;

create or replace function public.admin_list_agencies()
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
    select jsonb_agg(jsonb_build_object(
      'agency_id', a.id,
      'nom', a.nom,
      'ville', a.ville,
      'created_at', a.created_at,
      'access_until', a.access_until,
      'suspended', a.suspended,
      'has_access', public.agency_has_access(a.id),
      'members', (select count(*) from public.agency_members m where m.agency_id = a.id),
      'owner_email', (select u.email from public.agency_members m join auth.users u on u.id = m.user_id
                      where m.agency_id = a.id and m.role = 'owner' limit 1)
    ) order by a.created_at desc)
    from public.agencies a
  ), '[]'::jsonb);
end;
$$;

-- État d'accès de MON agence (lisible même quand l'accès est fermé, pour afficher l'écran de blocage).
create or replace function public.my_agency_access()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select jsonb_build_object(
      'agency_id', a.id,
      'access_until', a.access_until,
      'suspended', a.suspended,
      'has_access', public.agency_has_access(a.id)
    )
    from public.agency_members m
    join public.agencies a on a.id = m.agency_id
    where m.user_id = auth.uid()
    order by m.created_at
    limit 1
  ), 'null'::jsonb);
$$;

revoke all on function public.admin_create_agency(text, text, text, text, text, int) from public, anon;
revoke all on function public.admin_reissue_owner_code(uuid, text) from public, anon;
revoke all on function public.admin_set_agency_access(uuid, int, boolean, boolean) from public, anon;
revoke all on function public.admin_list_agencies() from public, anon;
revoke all on function public.my_agency_access() from public, anon;
grant execute on function public.admin_create_agency(text, text, text, text, text, int) to authenticated;
grant execute on function public.admin_reissue_owner_code(uuid, text) to authenticated;
grant execute on function public.admin_set_agency_access(uuid, int, boolean, boolean) to authenticated;
grant execute on function public.admin_list_agencies() to authenticated;
grant execute on function public.my_agency_access() to authenticated;
