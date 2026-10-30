-- M3ak — l'employé peut ignorer l'inspection, ou décliner l'analyse IA des photos.
--
-- 1) inspections.skipped : l'inspection est « ignorée » (aucune photo prise). Qui et quand sont enregistrés, et un
--    événement est ajouté au journal d'activité. Le départ d'une location est alors accepté sans photos.
-- 2) analysis_status « refusee » : les photos sont prises mais l'employé a décliné l'analyse par M3ak. Les photos restent
--    stockées pour l'inspection et la comparaison au retour ; les dommages éventuels sont écrits à la main.
-- 3) damages.dans_contrat : pour chaque dommage confirmé à l'inspection de départ, l'employé choisit s'il est inscrit
--    au contrat (oui par défaut).

alter table public.inspections
  add column if not exists skipped boolean not null default false,
  add column if not exists skipped_by uuid references auth.users (id),
  add column if not exists skipped_at timestamptz;

alter table public.inspections drop constraint if exists inspections_analysis_status_check;
alter table public.inspections
  add constraint inspections_analysis_status_check
  check (analysis_status in ('aucune', 'en_cours', 'terminee', 'partielle', 'echec', 'refusee'));

alter table public.damages add column if not exists dans_contrat boolean not null default true;

-- Qui a ignoré l'inspection, et quand (posé par le serveur, pas par l'écran).
create or replace function public.stamp_inspection_skip()
returns trigger
language plpgsql
as $$
begin
  if NEW.skipped and (TG_OP = 'INSERT' or not OLD.skipped) then
    NEW.skipped_by := auth.uid();
    NEW.skipped_at := now();
  elsif not NEW.skipped then
    NEW.skipped_by := null;
    NEW.skipped_at := null;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_stamp_inspection_skip on public.inspections;
create trigger trg_stamp_inspection_skip
  before insert or update on public.inspections
  for each row execute function public.stamp_inspection_skip();

-- Journal d'activité : une inspection ignorée est tracée.
create or replace function public.audit_inspections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle_label text;
begin
  select marque || ' ' || modele into vehicle_label from public.vehicles where id = NEW.vehicle_id;
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'inspection_created', vehicle_label, jsonb_build_object('type', NEW.type));
    if NEW.skipped then
      perform public.audit_event(NEW.agency_id, 'inspection_skipped', vehicle_label, jsonb_build_object('type', NEW.type));
    end if;
  elsif NEW.skipped and not OLD.skipped then
    perform public.audit_event(NEW.agency_id, 'inspection_skipped', vehicle_label, jsonb_build_object('type', NEW.type));
  elsif OLD.statut is distinct from NEW.statut and NEW.statut in ('terminee', 'validee') then
    perform public.audit_event(NEW.agency_id, 'inspection_completed', vehicle_label, jsonb_build_object('type', NEW.type));
  end if;
  return NEW;
end;
$$;

-- Le départ exige une inspection de départ terminée avec ses photos, OU explicitement ignorée par l'employé.
create or replace function public.start_rental_with_contract(
  p_rental_id uuid,
  p_contract_id uuid,
  p_km_depart int,
  p_carburant_depart int,
  p_etat_depart public.vehicle_condition,
  p_accessoires_depart jsonb,
  p_observations_depart text
)
returns void
language plpgsql
as $$
declare
  v_rental record;
  v_contract record;
  v_check jsonb;
  v_inspection record;
  v_photos int;
begin
  select id, vehicle_id, statut into v_rental from public.rentals where id = p_rental_id;
  if v_rental is null then
    raise exception 'rental_not_found';
  end if;
  if v_rental.statut not in ('confirmee', 'reservee') then
    raise exception 'rental_departure_already_recorded_or_invalid_state: %', v_rental.statut;
  end if;

  select id, statut into v_contract from public.contracts where id = p_contract_id and rental_id = p_rental_id;
  if v_contract is null then
    raise exception 'contract_not_found_for_rental';
  end if;
  if v_contract.statut <> 'signe' then
    raise exception 'contract_not_signed: %', v_contract.statut;
  end if;

  select id, statut, skipped into v_inspection
  from public.inspections
  where rental_id = p_rental_id and type = 'depart';
  if v_inspection is null or v_inspection.statut not in ('terminee', 'validee') then
    raise exception 'departure_inspection_required';
  end if;
  if not v_inspection.skipped then
    select count(*) into v_photos from public.inspection_photos where inspection_id = v_inspection.id;
    if v_photos < 8 then
      raise exception 'departure_inspection_required';
    end if;
  end if;

  v_check := public.rental_departure_check(p_rental_id);
  if (v_check ->> 'enforced')::boolean and not (v_check ->> 'ok')::boolean then
    raise exception 'departure_requirements_not_met';
  end if;

  update public.rentals
  set statut = 'en_cours', date_depart_reel = now(), km_depart = p_km_depart, carburant_depart = p_carburant_depart
  where id = p_rental_id;

  update public.vehicles
  set statut = 'en_location', kilometrage = p_km_depart
  where id = v_rental.vehicle_id;

  update public.contracts
  set statut = 'en_cours', etat_depart = p_etat_depart, accessoires_depart = p_accessoires_depart, observations_depart = p_observations_depart
  where id = p_contract_id;
end;
$$;
