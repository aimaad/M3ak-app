-- M3ak — véhicule SANS filiale = véhicule de l'agence entière, accessible à
-- tous les membres de l'agence (toutes les filiales). Un véhicule rattaché à
-- une filiale reste visible uniquement par cette filiale, l'admin et les
-- membres « agence entière » (voir 0022 / 0024).

-- Accès à un véhicule : partagé (sans filiale) -> tout membre de l'agence ;
-- sinon règle par filiale.
create or replace function public.can_access_vehicle_branch(target_agency_id uuid, vehicle_branch uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_agency_member(target_agency_id)
    and (vehicle_branch is null or public.can_access_branches(target_agency_id, vehicle_branch));
$$;

create or replace function public.can_access_vehicle(target_vehicle_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select public.can_access_vehicle_branch(v.agency_id, v.branch_id)
    from public.vehicles v
    where v.id = target_vehicle_id
  ), false);
$$;

drop policy if exists "vehicles_select" on public.vehicles;
create policy "vehicles_select" on public.vehicles
  for select using (public.can_access_vehicle_branch(agency_id, branch_id));

drop policy if exists "vehicles_insert" on public.vehicles;
create policy "vehicles_insert" on public.vehicles
  for insert with check (public.can_access_vehicle_branch(agency_id, branch_id));

drop policy if exists "vehicles_update" on public.vehicles;
create policy "vehicles_update" on public.vehicles
  for update using (public.can_access_vehicle_branch(agency_id, branch_id));

-- vehicles_delete (0022) reste inchangé : supprimer un véhicule partagé est
-- réservé aux responsables « agence entière » et à l'admin.

-- Un membre de filiale ne peut pas « s'approprier » ou déplacer un véhicule :
-- changer la filiale d'un véhicule est réservé à l'admin et aux membres
-- « agence entière ». À la création, son véhicule est rattaché à sa filiale.
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
      if NEW.branch_id is distinct from member_branch then
        raise exception 'branch_access_denied';
      end if;
    elsif NEW.branch_id is distinct from OLD.branch_id then
      raise exception 'branch_access_denied';
    end if;
  end if;
  return NEW;
end;
$$;

-- Location d'un véhicule partagé : la filiale de départ par défaut est celle
-- du véhicule, sinon celle de l'employé qui crée la location (pour que sa
-- filiale voie sa location sans l'ouvrir aux autres filiales).
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
  if NEW.branch_depart_id is null then
    select m.branch_id into NEW.branch_depart_id
    from public.agency_members m
    where m.agency_id = NEW.agency_id and m.user_id = auth.uid() and m.role <> 'owner';
  end if;
  return NEW;
end;
$$;
