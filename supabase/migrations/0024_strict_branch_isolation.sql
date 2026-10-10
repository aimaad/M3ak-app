-- M3ak — isolation stricte par filiale.
--
-- Règle (complète 0022) :
--   * owner (admin)                          -> voit TOUTES les filiales, toujours ;
--   * manager/employee SANS filiale          -> voit toutes les filiales, avec les
--                                               droits de son rôle ;
--   * manager/employee RATTACHÉ à une filiale -> ne voit RIEN des autres filiales
--     (ni véhicules, ni locations, ni équipe, ni invitations, ni la liste des
--     filiales, ni les fichiers), même s'il est responsable. Un responsable de
--     filiale gère l'équipe de SA filiale seulement et ne gère pas les filiales
--     elles-mêmes.

-- ==================================================================
-- Fonctions d'aide
-- ==================================================================

-- Membre "agence entière" : owner, ou membre sans filiale.
create or replace function public.is_agency_wide(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.agency_members m
    where m.agency_id = target_agency_id
      and m.user_id = auth.uid()
      and (m.role = 'owner' or m.branch_id is null)
  );
$$;

-- owner/manager ET agence entière (peut gérer les filiales).
create or replace function public.is_agency_wide_manager(target_agency_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_agency_manager(target_agency_id) and public.is_agency_wide(target_agency_id);
$$;

-- Remplace la version de 0022 : le owner voit toujours tout.
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
  select exists (
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

-- Le owner n'est jamais bridé par sa propre filiale éventuelle.
create or replace function public.enforce_member_branch_on_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_role public.agency_role;
  member_branch uuid;
begin
  select m.role, m.branch_id into member_role, member_branch
  from public.agency_members m
  where m.agency_id = NEW.agency_id and m.user_id = auth.uid();

  if member_role is distinct from 'owner' and member_branch is not null then
    if TG_OP = 'INSERT' then
      NEW.branch_id := coalesce(NEW.branch_id, member_branch);
    end if;
    if NEW.branch_id is distinct from member_branch then
      raise exception 'branch_access_denied';
    end if;
  end if;
  return NEW;
end;
$$;

-- ==================================================================
-- Filiales : un membre de filiale ne voit que la sienne ; seuls owner et
-- responsables "agence entière" créent / modifient / suppriment.
-- ==================================================================

drop policy if exists "branches_select" on public.branches;
create policy "branches_select" on public.branches
  for select using (public.can_access_branches(agency_id, id));

drop policy if exists "branches_write" on public.branches;
create policy "branches_write" on public.branches
  for insert with check (public.is_agency_wide_manager(agency_id));

drop policy if exists "branches_update" on public.branches;
create policy "branches_update" on public.branches
  for update using (public.is_agency_wide_manager(agency_id));

drop policy if exists "branches_delete" on public.branches;
create policy "branches_delete" on public.branches
  for delete using (public.is_agency_wide_manager(agency_id));

-- ==================================================================
-- Équipe : on ne voit que les membres de sa filiale et ceux de l'agence
-- entière ; un responsable de filiale n'ajoute / ne retire que dans sa filiale.
-- ==================================================================

drop policy if exists "agency_members_select" on public.agency_members;
create policy "agency_members_select" on public.agency_members
  for select using (
    user_id = auth.uid()
    or (
      public.is_agency_member(agency_id)
      and (
        public.is_agency_wide(agency_id)
        or branch_id is null
        or public.can_access_branches(agency_id, branch_id)
      )
    )
  );

drop policy if exists "agency_members_insert" on public.agency_members;
create policy "agency_members_insert" on public.agency_members
  for insert with check (
    (
      public.is_agency_manager(agency_id)
      and role in ('manager', 'employee')
      and public.can_access_branches(agency_id, branch_id)
    )
    or (
      role = 'owner'
      and user_id = auth.uid()
      and not exists (select 1 from public.agency_members m where m.agency_id = agency_members.agency_id)
      and exists (
        select 1 from public.agencies a
        where a.id = agency_members.agency_id and a.created_by = auth.uid()
      )
    )
  );

drop policy if exists "agency_members_delete" on public.agency_members;
create policy "agency_members_delete" on public.agency_members
  for delete using (
    public.agency_role_of(agency_id) = 'owner'
    or (
      public.agency_role_of(agency_id) = 'manager'
      and role = 'employee'
      and public.can_access_branches(agency_id, branch_id)
    )
  );

-- ==================================================================
-- Invitations : un responsable de filiale invite uniquement dans sa filiale.
-- ==================================================================

drop policy if exists "agency_invites_select" on public.agency_invites;
create policy "agency_invites_select" on public.agency_invites
  for select using (public.can_access_branches(agency_id, branch_id));

drop policy if exists "agency_invites_insert" on public.agency_invites;
create policy "agency_invites_insert" on public.agency_invites
  for insert with check (
    public.is_agency_manager(agency_id)
    and role in ('manager', 'employee')
    and public.can_access_branches(agency_id, branch_id)
  );

drop policy if exists "agency_invites_delete" on public.agency_invites;
create policy "agency_invites_delete" on public.agency_invites
  for delete using (
    public.is_agency_manager(agency_id)
    and public.can_access_branches(agency_id, branch_id)
  );

-- Sans filiale précisée, l'invitation d'un responsable de filiale est
-- rattachée à SA filiale (jamais à l'agence entière).
create or replace function public.default_invite_branch_from_inviter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inviter_role public.agency_role;
  inviter_branch uuid;
begin
  select m.role, m.branch_id into inviter_role, inviter_branch
  from public.agency_members m
  where m.agency_id = NEW.agency_id and m.user_id = auth.uid();

  if inviter_role is distinct from 'owner' and inviter_branch is not null then
    NEW.branch_id := coalesce(NEW.branch_id, inviter_branch);
  end if;
  return NEW;
end;
$$;

create trigger trg_agency_invites_default_branch
  before insert on public.agency_invites
  for each row execute function public.default_invite_branch_from_inviter();

-- ==================================================================
-- Fichiers (photos, documents, PDF) : même règle que les données associées.
-- Le 2e dossier du chemin est l'id du véhicule / de l'entretien / du contrat.
-- ==================================================================

create or replace function public.can_access_storage_object(bucket text, object_name text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  owner_id uuid := (storage.foldername(object_name))[2]::uuid;
begin
  if bucket in ('vehicle-documents', 'vehicle-photos') then
    return public.can_access_vehicle(owner_id);
  elsif bucket = 'maintenance-documents' then
    return coalesce((
      select public.can_access_vehicle(mi.vehicle_id)
      from public.maintenance_items mi where mi.id = owner_id
    ), false);
  elsif bucket = 'contract-pdfs' then
    return coalesce((
      select public.can_access_rental(c.rental_id)
      from public.contracts c where c.id = owner_id
    ), false);
  elsif bucket = 'inspection-photos' then
    return public.can_access_inspection(owner_id);
  end if;
  return false;
end;
$$;

do $$
declare
  spec record;
  base text := 'public.is_agency_member((storage.foldername(name))[1]::uuid)';
  scope text;
begin
  for spec in
    select * from (values
      ('inspection-photos',     'inspection_photos_storage_', true),
      ('vehicle-documents',     'vehicle_documents_storage_', true),
      ('vehicle-photos',        'vehicle_photos_storage_',    false),
      ('maintenance-documents', 'maintenance_documents_storage_', true),
      ('contract-pdfs',         'contract_pdfs_',             true)
    ) as t(bucket, prefix, has_update)
  loop
    scope := format('public.can_access_storage_object(%L, name)', spec.bucket);

    execute format('drop policy if exists %I on storage.objects', spec.prefix || 'select');
    execute format('create policy %I on storage.objects for select using (bucket_id = %L and %s and %s)',
      spec.prefix || 'select', spec.bucket, base, scope);

    execute format('drop policy if exists %I on storage.objects', spec.prefix || 'insert');
    execute format('create policy %I on storage.objects for insert with check (bucket_id = %L and %s and %s)',
      spec.prefix || 'insert', spec.bucket, base, scope);

    if spec.has_update then
      execute format('drop policy if exists %I on storage.objects', spec.prefix || 'update');
      execute format('create policy %I on storage.objects for update using (bucket_id = %L and %s and %s)',
        spec.prefix || 'update', spec.bucket, base, scope);
    end if;

    execute format('drop policy if exists %I on storage.objects', spec.prefix || 'delete');
    execute format(
      'create policy %I on storage.objects for delete using (bucket_id = %L and public.is_agency_manager((storage.foldername(name))[1]::uuid) and %s)',
      spec.prefix || 'delete', spec.bucket, scope);
  end loop;
end;
$$;
