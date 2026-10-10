-- M3ak — invitations nominatives et sécurisées.
--
-- Avant : un code de 6 caractères généré par l'app, stocké en clair, utilisable
-- par n'importe qui. Maintenant :
--   * l'invitation vise une personne précise (prénom, nom, e-mail) ;
--   * le code (12 caractères) est généré par le SERVEUR, jamais stocké en clair
--     (seule son empreinte SHA-256 l'est) et n'est montré qu'une fois à celui qui
--     invite ;
--   * seule la personne dont l'e-mail (confirmé) correspond peut l'utiliser ;
--   * à usage unique, valable 7 jours, annulable et renvoyable (nouveau code) ;
--   * plus aucune écriture directe dans agency_invites : tout passe par les
--     fonctions create_agency_invite / resend_agency_invite /
--     revoke_agency_invite, qui appliquent les règles de rôle et de filiale ;
--   * seuls les responsables voient la liste des invitations (ce sont des
--     adresses e-mail), dans leur périmètre de filiale.

create extension if not exists pgcrypto with schema extensions;

-- ==================================================================
-- Colonnes
-- ==================================================================

alter table public.agency_invites
  add column email text,
  add column prenom text,
  add column nom text,
  add column code_hash text,
  add column revoked_at timestamptz;

-- Anciennes invitations (code en clair, sans e-mail) : on les annule et on
-- efface les codes en clair.
update public.agency_invites
set revoked_at = now()
where used_at is null and revoked_at is null;

alter table public.agency_invites alter column code drop not null;
update public.agency_invites set code = null;

create unique index agency_invites_code_hash_idx
  on public.agency_invites (code_hash) where code_hash is not null;

-- Une seule invitation en attente par e-mail et par agence.
create unique index agency_invites_pending_email_idx
  on public.agency_invites (agency_id, lower(email))
  where used_at is null and revoked_at is null and email is not null;

-- ==================================================================
-- Droits d'accès directs : lecture réservée aux responsables, aucune
-- écriture directe.
-- ==================================================================

drop policy if exists "agency_invites_select" on public.agency_invites;
create policy "agency_invites_select" on public.agency_invites
  for select using (
    public.is_agency_manager(agency_id)
    and public.can_access_branches(agency_id, branch_id)
  );

drop policy if exists "agency_invites_insert" on public.agency_invites;
drop policy if exists "agency_invites_delete" on public.agency_invites;
drop policy if exists "agency_invites_update" on public.agency_invites;

-- ==================================================================
-- Outils internes
-- ==================================================================

-- 12 caractères sans ambiguïté (pas de 0/O, 1/I/L), tirage cryptographique
-- sans biais (rejet des octets >= 248).
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  b int;
begin
  while length(result) < 12 loop
    b := get_byte(gen_random_bytes(1), 0);
    if b < 248 then
      result := result || substr(alphabet, (b % 31) + 1, 1);
    end if;
  end loop;
  return result;
end;
$$;

-- Empreinte d'un code saisi par l'utilisateur (majuscules, sans tirets/espaces).
create or replace function public.invite_code_hash(code text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex');
$$;

-- Réponse commune aux fonctions de création / renvoi (le code n'est renvoyé
-- qu'ici, une seule fois).
create or replace function public.invite_payload(target_invite_id uuid, plain_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', i.id,
    'agency_id', i.agency_id,
    'code', plain_code,
    'email', i.email,
    'prenom', i.prenom,
    'nom', i.nom,
    'role', i.role,
    'branch_id', i.branch_id,
    'branch_name', b.nom,
    'agency_name', a.nom,
    'inviter_name', (
      select coalesce(m.nom_complet, trim(coalesce(m.prenom, '') || ' ' || coalesce(m.nom, '')))
      from public.agency_members m
      where m.agency_id = i.agency_id and m.user_id = auth.uid()
    ),
    'expires_at', i.expires_at
  )
  from public.agency_invites i
  join public.agencies a on a.id = i.agency_id
  left join public.branches b on b.id = i.branch_id
  where i.id = target_invite_id;
$$;

revoke all on function public.generate_invite_code() from public, anon, authenticated;
revoke all on function public.invite_payload(uuid, text) from public, anon, authenticated;

-- ==================================================================
-- Créer une invitation
-- ==================================================================

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
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_prenom text := trim(coalesce(p_prenom, ''));
  v_nom text := trim(coalesce(p_nom, ''));
  v_caller_role public.agency_role;
  v_caller_branch uuid;
  v_branch uuid := p_branch_id;
  v_code text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select m.role, m.branch_id into v_caller_role, v_caller_branch
  from public.agency_members m
  where m.agency_id = p_agency_id and m.user_id = auth.uid();

  if v_caller_role is null or v_caller_role not in ('owner', 'manager') then
    raise exception 'not_allowed';
  end if;

  if p_role not in ('manager', 'employee') then
    raise exception 'role_not_allowed';
  end if;

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;
  if length(v_prenom) < 2 or length(v_prenom) > 60 or v_prenom ~ '\d'
     or length(v_nom) < 2 or length(v_nom) > 60 or v_nom ~ '\d' then
    raise exception 'invalid_name';
  end if;

  -- Un responsable rattaché à une filiale invite uniquement dans SA filiale.
  if v_caller_role <> 'owner' and v_caller_branch is not null then
    v_branch := coalesce(v_branch, v_caller_branch);
    if v_branch is distinct from v_caller_branch then
      raise exception 'branch_access_denied';
    end if;
  end if;

  if v_branch is not null and not exists (
    select 1 from public.branches where id = v_branch and agency_id = p_agency_id
  ) then
    raise exception 'branch_must_belong_to_same_agency';
  end if;

  if exists (
    select 1
    from public.agency_members m
    join auth.users u on u.id = m.user_id
    where m.agency_id = p_agency_id and lower(u.email) = v_email
  ) then
    raise exception 'already_member';
  end if;

  -- Une ancienne invitation expirée pour le même e-mail ne bloque pas la nouvelle.
  update public.agency_invites
  set revoked_at = now()
  where agency_id = p_agency_id
    and lower(email) = v_email
    and used_at is null and revoked_at is null
    and expires_at <= now();

  v_code := public.generate_invite_code();

  begin
    insert into public.agency_invites
      (agency_id, role, branch_id, email, prenom, nom, code_hash, created_by, expires_at)
    values
      (p_agency_id, p_role, v_branch, v_email, v_prenom, v_nom,
       public.invite_code_hash(v_code), auth.uid(), now() + interval '7 days')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'invite_already_pending';
  end;

  return public.invite_payload(v_id, v_code);
end;
$$;

-- ==================================================================
-- Renvoyer (nouveau code, nouvelle échéance ; l'ancien code ne marche plus)
-- ==================================================================

create or replace function public.resend_agency_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.agency_invites%rowtype;
  v_code text;
  v_actor text;
begin
  select * into v_invite from public.agency_invites where id = p_invite_id for update;
  if v_invite.id is null then
    raise exception 'invite_not_found';
  end if;

  if not public.is_agency_manager(v_invite.agency_id)
     or not public.can_access_branches(v_invite.agency_id, v_invite.branch_id) then
    raise exception 'not_allowed';
  end if;

  if v_invite.used_at is not null or v_invite.revoked_at is not null then
    raise exception 'invite_not_pending';
  end if;

  v_code := public.generate_invite_code();
  update public.agency_invites
  set code_hash = public.invite_code_hash(v_code),
      expires_at = now() + interval '7 days'
  where id = p_invite_id;

  select nom_complet into v_actor from public.agency_members
    where agency_id = v_invite.agency_id and user_id = auth.uid();
  insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label)
  values (v_invite.agency_id, auth.uid(), v_actor, 'invite_resent', v_invite.email);

  return public.invite_payload(p_invite_id, v_code);
end;
$$;

-- ==================================================================
-- Annuler
-- ==================================================================

create or replace function public.revoke_agency_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.agency_invites%rowtype;
  v_actor text;
begin
  select * into v_invite from public.agency_invites where id = p_invite_id for update;
  if v_invite.id is null then
    raise exception 'invite_not_found';
  end if;

  if not public.is_agency_manager(v_invite.agency_id)
     or not public.can_access_branches(v_invite.agency_id, v_invite.branch_id) then
    raise exception 'not_allowed';
  end if;

  if v_invite.used_at is not null or v_invite.revoked_at is not null then
    raise exception 'invite_not_pending';
  end if;

  update public.agency_invites set revoked_at = now() where id = p_invite_id;

  select nom_complet into v_actor from public.agency_members
    where agency_id = v_invite.agency_id and user_id = auth.uid();
  insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label)
  values (v_invite.agency_id, auth.uid(), v_actor, 'invite_revoked', v_invite.email);
end;
$$;

-- ==================================================================
-- Rejoindre avec un code : e-mail confirmé identique à l'invitation exigé.
-- ==================================================================

create or replace function public.redeem_invite(invite_code text)
returns public.agency_role
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
  v_user_email text;
  v_confirmed timestamptz;
  meta jsonb;
  member_prenom text;
  member_nom text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into invite
  from public.agency_invites
  where code_hash = public.invite_code_hash(invite_code)
    and email is not null
    and used_at is null
    and revoked_at is null
    and expires_at > now()
  limit 1
  for update;

  if invite is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  select u.email, u.email_confirmed_at, u.raw_user_meta_data
  into v_user_email, v_confirmed, meta
  from auth.users u where u.id = auth.uid();

  if v_confirmed is null then
    raise exception 'email_not_confirmed';
  end if;

  if lower(coalesce(v_user_email, '')) <> lower(invite.email) then
    raise exception 'invite_email_mismatch';
  end if;

  if exists (
    select 1 from public.agency_members
    where agency_id = invite.agency_id and user_id = auth.uid()
  ) then
    raise exception 'already_member';
  end if;

  -- Identité : celle saisie par la personne à l'inscription, sinon celle
  -- indiquée par le responsable dans l'invitation.
  member_prenom := coalesce(nullif(trim(coalesce(meta ->> 'prenom', '')), ''), invite.prenom);
  member_nom := coalesce(nullif(trim(coalesce(meta ->> 'nom', '')), ''), invite.nom);

  insert into public.agency_members (agency_id, user_id, role, branch_id, prenom, nom, nom_complet)
  values (
    invite.agency_id, auth.uid(), invite.role, invite.branch_id,
    member_prenom, member_nom,
    nullif(trim(coalesce(member_prenom, '') || ' ' || coalesce(member_nom, '')), '')
  );

  update public.agency_invites
  set used_at = now(), used_by = auth.uid()
  where id = invite.id;

  return invite.role;
end;
$$;

-- ==================================================================
-- Journal d'audit : l'e-mail remplace le code (qui n'existe plus en clair).
-- ==================================================================

create or replace function public.audit_agency_invites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  branch_label text;
begin
  select nom_complet into actor_name from public.agency_members
    where agency_id = NEW.agency_id and user_id = auth.uid();
  if NEW.branch_id is not null then
    select nom into branch_label from public.branches where id = NEW.branch_id;
  end if;

  insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label, details)
  values (
    NEW.agency_id, auth.uid(), actor_name, 'invite_created', NEW.email,
    jsonb_build_object('role', NEW.role, 'branch', branch_label)
  );
  return NEW;
end;
$$;

-- ==================================================================
-- Droits d'exécution : réservés aux utilisateurs connectés.
-- ==================================================================

revoke all on function public.create_agency_invite(uuid, text, text, text, public.agency_role, uuid) from public, anon;
revoke all on function public.resend_agency_invite(uuid) from public, anon;
revoke all on function public.revoke_agency_invite(uuid) from public, anon;
revoke all on function public.redeem_invite(text) from public, anon;
grant execute on function public.create_agency_invite(uuid, text, text, text, public.agency_role, uuid) to authenticated;
grant execute on function public.resend_agency_invite(uuid) to authenticated;
grant execute on function public.revoke_agency_invite(uuid) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
