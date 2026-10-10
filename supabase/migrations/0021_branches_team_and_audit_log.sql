-- M3ak — filiales, permissions d'équipe étendues, profils et journal d'audit.
--
-- 1) Rattache les invitations et les membres à une filiale (branches
--    existait déjà dans le schéma depuis l'étape 0, mais n'était utilisée
--    nulle part dans l'app).
-- 2) Ajoute prénom/nom et photo de profil sur agency_members, et autorise
--    chaque membre à modifier SA PROPRE fiche (mais jamais son rôle ou sa
--    filiale — ça reste réservé au owner, via un déclencheur dédié, même
--    famille que le correctif d'escalade de privilèges de la migration
--    0010).
-- 3) Un manager peut désormais supprimer un employee (pas un autre manager,
--    pas le owner) ; seul le owner pouvait supprimer un membre jusqu'ici.
-- 4) Seuls owner/manager peuvent créer/modifier une filiale (c'était ouvert
--    à tout membre par erreur depuis l'étape 0).
-- 5) Nouveau journal d'audit (agency_audit_log), alimenté uniquement par des
--    déclencheurs serveur — jamais par un INSERT direct du client — et
--    visible seulement par le owner de l'agence.

-- ==================================================================
-- Filiales : colonnes de rattachement
-- ==================================================================

alter table public.agency_invites
  add column branch_id uuid references public.branches (id) on delete set null;

alter table public.agency_members
  add column prenom text,
  add column nom text,
  add column photo_path text,
  add column branch_id uuid references public.branches (id) on delete set null;

create or replace function public.validate_branch_belongs_to_agency()
returns trigger
language plpgsql
as $$
begin
  if NEW.branch_id is not null and not exists (
    select 1 from public.branches where id = NEW.branch_id and agency_id = NEW.agency_id
  ) then
    raise exception 'branch_must_belong_to_same_agency';
  end if;
  return NEW;
end;
$$;

create trigger trg_agency_invites_validate_branch
  before insert or update of branch_id, agency_id on public.agency_invites
  for each row execute function public.validate_branch_belongs_to_agency();

create trigger trg_agency_members_validate_branch
  before insert or update of branch_id, agency_id on public.agency_members
  for each row execute function public.validate_branch_belongs_to_agency();

-- redeem_invite propage désormais la filiale de l'invitation au nouveau membre.
create or replace function public.redeem_invite(invite_code text)
returns public.agency_role
language plpgsql
security definer
set search_path = public
as $$
declare
  invite record;
begin
  select * into invite
  from public.agency_invites
  where code = invite_code
    and used_at is null
    and expires_at > now()
  limit 1;

  if invite is null then
    raise exception 'invite_invalid_or_expired';
  end if;

  if exists (
    select 1 from public.agency_members
    where agency_id = invite.agency_id and user_id = auth.uid()
  ) then
    raise exception 'already_member';
  end if;

  insert into public.agency_members (agency_id, user_id, role, branch_id)
  values (invite.agency_id, auth.uid(), invite.role, invite.branch_id);

  update public.agency_invites
  set used_at = now(), used_by = auth.uid()
  where id = invite.id;

  return invite.role;
end;
$$;

-- ==================================================================
-- Permissions étendues : filiales réservées à owner/manager, suppression
-- d'un employee ouverte au manager, mise à jour de sa propre fiche ouverte
-- à chaque membre (mais pas de son rôle/filiale — voir le déclencheur
-- restrict_self_member_update ci-dessous).
-- ==================================================================

drop policy if exists "branches_write" on public.branches;
create policy "branches_write" on public.branches
  for insert with check (public.is_agency_manager(agency_id));

drop policy if exists "branches_update" on public.branches;
create policy "branches_update" on public.branches
  for update using (public.is_agency_manager(agency_id));

drop policy if exists "agency_members_update" on public.agency_members;
create policy "agency_members_update" on public.agency_members
  for update using (
    public.agency_role_of(agency_id) = 'owner'
    or user_id = auth.uid()
  );

drop policy if exists "agency_members_delete" on public.agency_members;
create policy "agency_members_delete" on public.agency_members
  for delete using (
    public.agency_role_of(agency_id) = 'owner'
    or (public.agency_role_of(agency_id) = 'manager' and role = 'employee')
  );

create or replace function public.restrict_self_member_update()
returns trigger
language plpgsql
as $$
begin
  if public.agency_role_of(NEW.agency_id) <> 'owner' then
    if NEW.role is distinct from OLD.role
       or NEW.branch_id is distinct from OLD.branch_id
       or NEW.agency_id is distinct from OLD.agency_id
       or NEW.user_id is distinct from OLD.user_id then
      raise exception 'only_owner_can_change_role_or_branch';
    end if;
    if OLD.user_id is distinct from auth.uid() then
      raise exception 'can_only_update_own_profile';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger trg_restrict_self_member_update
  before update on public.agency_members
  for each row execute function public.restrict_self_member_update();

-- ==================================================================
-- Photos de profil : bucket privé, chaque membre ne peut écrire que dans
-- son propre dossier ({agency_id}/{user_id}/...), lisible par toute
-- l'agence (même principe que les autres buckets du projet).
-- ==================================================================

insert into storage.buckets (id, name, public)
values ('member-avatars', 'member-avatars', false)
on conflict (id) do nothing;

create policy "member_avatars_select" on storage.objects
  for select using (
    bucket_id = 'member-avatars'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "member_avatars_insert" on storage.objects
  for insert with check (
    bucket_id = 'member-avatars'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "member_avatars_update" on storage.objects
  for update using (
    bucket_id = 'member-avatars'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "member_avatars_delete" on storage.objects
  for delete using (
    bucket_id = 'member-avatars'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ==================================================================
-- Journal d'audit — visible uniquement par le owner. Jamais écrit
-- directement par le client : seulement par les déclencheurs ci-dessous,
-- qui s'exécutent avec les droits du propriétaire de la fonction
-- (SECURITY DEFINER), donc indépendamment des policies RLS d'écriture
-- (il n'y en a volontairement aucune pour authenticated).
-- ==================================================================

create table public.agency_audit_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  actor_id uuid references auth.users (id),
  actor_name text,
  action text not null,
  target_label text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index agency_audit_log_agency_id_idx on public.agency_audit_log (agency_id, created_at desc);

alter table public.agency_audit_log enable row level security;

create policy "agency_audit_log_select" on public.agency_audit_log
  for select using (public.agency_role_of(agency_id) = 'owner');

create or replace function public.audit_branches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  select nom_complet into actor_name from public.agency_members
    where agency_id = coalesce(NEW.agency_id, OLD.agency_id) and user_id = auth.uid();

  if TG_OP = 'INSERT' then
    insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label)
    values (NEW.agency_id, auth.uid(), actor_name, 'branch_created', NEW.nom);
  elsif TG_OP = 'UPDATE' then
    insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label)
    values (NEW.agency_id, auth.uid(), actor_name, 'branch_updated', NEW.nom);
  elsif TG_OP = 'DELETE' then
    insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label)
    values (OLD.agency_id, auth.uid(), actor_name, 'branch_deleted', OLD.nom);
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

create trigger trg_audit_branches
  after insert or update or delete on public.branches
  for each row execute function public.audit_branches();

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
    NEW.agency_id, auth.uid(), actor_name, 'invite_created', NEW.code,
    jsonb_build_object('role', NEW.role, 'branch', branch_label)
  );
  return NEW;
end;
$$;

create trigger trg_audit_agency_invites
  after insert on public.agency_invites
  for each row execute function public.audit_agency_invites();

create or replace function public.audit_agency_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
  display_name text;
begin
  select nom_complet into actor_name from public.agency_members
    where agency_id = coalesce(NEW.agency_id, OLD.agency_id) and user_id = auth.uid();

  if TG_OP = 'INSERT' then
    display_name := coalesce(NEW.nom_complet, NEW.prenom || ' ' || NEW.nom);
    insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label, details)
    values (NEW.agency_id, auth.uid(), actor_name, 'member_joined', display_name, jsonb_build_object('role', NEW.role));
  elsif TG_OP = 'UPDATE' and OLD.role is distinct from NEW.role then
    display_name := coalesce(NEW.nom_complet, OLD.nom_complet);
    insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label, details)
    values (NEW.agency_id, auth.uid(), actor_name, 'member_role_changed', display_name, jsonb_build_object('from', OLD.role, 'to', NEW.role));
  elsif TG_OP = 'DELETE' then
    insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label, details)
    values (OLD.agency_id, auth.uid(), actor_name, 'member_removed', OLD.nom_complet, jsonb_build_object('role', OLD.role));
  end if;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

create trigger trg_audit_agency_members
  after insert or update or delete on public.agency_members
  for each row execute function public.audit_agency_members();
