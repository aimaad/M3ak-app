-- M3ak — invitations d'employés par code.
-- Un owner/manager génère un code ; le nouvel employé crée son compte puis
-- rejoint l'agence en entrant ce code (via la fonction redeem_invite ci-dessous).

create table public.agency_invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  code text not null unique,
  role public.agency_role not null default 'employee',
  created_by uuid references auth.users (id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index agency_invites_agency_id_idx on public.agency_invites (agency_id);

alter table public.agency_invites enable row level security;

-- Seuls les membres de l'agence voient ses invitations (liste des invitations en attente).
create policy "agency_invites_select" on public.agency_invites
  for select using (public.is_agency_member(agency_id));

-- Seuls owner/manager peuvent créer des invitations.
create policy "agency_invites_insert" on public.agency_invites
  for insert with check (public.is_agency_manager(agency_id));

create policy "agency_invites_delete" on public.agency_invites
  for delete using (public.is_agency_manager(agency_id));

-- ==================================================================
-- redeem_invite : un utilisateur quelconque (pas encore membre) peut
-- rejoindre une agence avec un code valide. SECURITY DEFINER car
-- l'utilisateur n'est pas encore agency_member au moment de l'appel
-- (la policy agency_invites_select / agency_members_insert le bloquerait sinon).
-- ==================================================================

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

  insert into public.agency_members (agency_id, user_id, role)
  values (invite.agency_id, auth.uid(), invite.role);

  update public.agency_invites
  set used_at = now(), used_by = auth.uid()
  where id = invite.id;

  return invite.role;
end;
$$;

grant execute on function public.redeem_invite(text) to authenticated;
