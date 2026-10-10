-- M3ak — accès limité par filiale.
--
-- Règle :
--   * membre SANS filiale (agency_members.branch_id is null) -> accès à TOUTES
--     les filiales de l'agence ;
--   * membre rattaché à UNE filiale -> accès uniquement aux données de cette
--     filiale (véhicules, locations et tout ce qui en dépend).
--
-- Les clients, conducteurs et le reste de l'agence restent communs à toute
-- l'agence. Un véhicule sans filiale n'est visible que par les membres sans
-- filiale (à rattacher à une filiale pour qu'un employé de filiale le voie).

-- ==================================================================
-- Fonctions d'aide (SECURITY DEFINER : lisent agency_members sans récursion RLS)
-- ==================================================================

-- Vrai si le membre connecté appartient à l'agence ET (n'a pas de filiale
-- OU sa filiale est l'une des filiales passées en paramètre).
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
        m.branch_id is null
        or m.branch_id in (branch_a, branch_b, branch_c)
      )
  );
$$;

create or replace function public.can_access_vehicle(target_vehicle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select public.can_access_branches(v.agency_id, v.branch_id)
    from public.vehicles v
    where v.id = target_vehicle_id
  ), false);
$$;

create or replace function public.can_access_rental(target_rental_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select public.can_access_branches(r.agency_id, v.branch_id, r.branch_depart_id, r.branch_retour_id)
    from public.rentals r
    join public.vehicles v on v.id = r.vehicle_id
    where r.id = target_rental_id
  ), false);
$$;

create or replace function public.can_access_inspection(target_inspection_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select public.can_access_vehicle(i.vehicle_id)
    from public.inspections i
    where i.id = target_inspection_id
  ), false);
$$;

-- ==================================================================
-- Véhicules
-- ==================================================================

drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select" on public.vehicles
  for select using (public.can_access_branches(agency_id, branch_id));

drop policy if exists "vehicles_insert" on public.vehicles;
create policy "vehicles_insert" on public.vehicles
  for insert with check (public.can_access_branches(agency_id, branch_id));

drop policy if exists "vehicles_update" on public.vehicles;
create policy "vehicles_update" on public.vehicles
  for update using (public.can_access_branches(agency_id, branch_id));

drop policy if exists "vehicles_delete" on public.vehicles;
create policy "vehicles_delete" on public.vehicles
  for delete using (
    public.is_agency_manager(agency_id)
    and public.can_access_branches(agency_id, branch_id)
  );

-- Un membre de filiale crée toujours ses véhicules dans sa propre filiale
-- (l'app n'a pas besoin de la préciser) et ne peut pas les déplacer ailleurs.
create or replace function public.enforce_member_branch_on_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_branch uuid;
begin
  select m.branch_id into member_branch
  from public.agency_members m
  where m.agency_id = NEW.agency_id and m.user_id = auth.uid();

  if member_branch is not null then
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

create trigger trg_vehicles_enforce_member_branch
  before insert or update of branch_id on public.vehicles
  for each row execute function public.enforce_member_branch_on_vehicle();

-- ==================================================================
-- Locations : accessibles si le véhicule, le départ ou le retour est dans
-- la filiale du membre.
-- ==================================================================

drop policy if exists "rentals_select" on public.rentals;
create policy "rentals_select" on public.rentals
  for select using (
    public.can_access_branches(
      agency_id,
      (select v.branch_id from public.vehicles v where v.id = vehicle_id),
      branch_depart_id,
      branch_retour_id
    )
  );

drop policy if exists "rentals_insert" on public.rentals;
create policy "rentals_insert" on public.rentals
  for insert with check (public.can_access_vehicle(vehicle_id));

drop policy if exists "rentals_update" on public.rentals;
create policy "rentals_update" on public.rentals
  for update using (
    public.can_access_branches(
      agency_id,
      (select v.branch_id from public.vehicles v where v.id = vehicle_id),
      branch_depart_id,
      branch_retour_id
    )
  );

drop policy if exists "rentals_delete" on public.rentals;
create policy "rentals_delete" on public.rentals
  for delete using (
    public.is_agency_manager(agency_id)
    and public.can_access_rental(id)
  );

-- La filiale de départ par défaut est celle du véhicule loué.
create or replace function public.default_rental_branch_from_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.branch_depart_id is null then
    select v.branch_id into NEW.branch_depart_id
    from public.vehicles v where v.id = NEW.vehicle_id;
  end if;
  return NEW;
end;
$$;

create trigger trg_rentals_default_branch
  before insert on public.rentals
  for each row execute function public.default_rental_branch_from_vehicle();

-- ==================================================================
-- Tables dépendantes d'un véhicule, d'une location ou d'une inspection :
-- mêmes droits d'écriture qu'avant (suppression réservée aux managers),
-- mais limités à la filiale du membre.
-- ==================================================================

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('inspections',               'public.can_access_vehicle(vehicle_id)',          true),
      ('maintenance_items',         'public.can_access_vehicle(vehicle_id)',          true),
      ('inspection_photos',         'public.can_access_inspection(inspection_id)',    true),
      ('damages',                   'public.can_access_inspection(inspection_id)',    true),
      ('deposits',                  'public.can_access_rental(rental_id)',            true),
      ('payments',                  'public.can_access_rental(rental_id)',            true),
      ('invoices',                  'public.can_access_rental(rental_id)',            true),
      ('contracts',                 'public.can_access_rental(rental_id)',            true),
      ('rental_additional_drivers', 'public.can_access_rental(rental_id)',            false)
    ) as t(tbl, scope, has_update)
  loop
    execute format('drop policy if exists %I on public.%I', spec.tbl || '_select', spec.tbl);
    execute format('create policy %I on public.%I for select using (%s)',
      spec.tbl || '_select', spec.tbl, spec.scope);

    execute format('drop policy if exists %I on public.%I', spec.tbl || '_insert', spec.tbl);
    execute format('create policy %I on public.%I for insert with check (%s)',
      spec.tbl || '_insert', spec.tbl, spec.scope);

    if spec.has_update then
      -- Les droits de mise à jour d'origine sont conservés (manager pour
      -- payments/invoices, membre pour le reste) et on ajoute la filiale.
      execute format('drop policy if exists %I on public.%I', spec.tbl || '_update', spec.tbl);
      if spec.tbl in ('payments', 'invoices') then
        execute format(
          'create policy %I on public.%I for update using (public.is_agency_manager(agency_id) and %s)',
          spec.tbl || '_update', spec.tbl, spec.scope);
      else
        execute format('create policy %I on public.%I for update using (%s)',
          spec.tbl || '_update', spec.tbl, spec.scope);
      end if;
    end if;

    execute format('drop policy if exists %I on public.%I', spec.tbl || '_delete', spec.tbl);
    if spec.tbl = 'rental_additional_drivers' then
      execute format('create policy %I on public.%I for delete using (%s)',
        spec.tbl || '_delete', spec.tbl, spec.scope);
    else
      execute format(
        'create policy %I on public.%I for delete using (public.is_agency_manager(agency_id) and %s)',
        spec.tbl || '_delete', spec.tbl, spec.scope);
    end if;
  end loop;
end;
$$;
