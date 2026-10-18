-- M3ak — le départ d'une location exige l'inspection de départ (photos du véhicule) terminée.
--
-- Une location ne peut plus démarrer tant que l'inspection de départ n'est pas terminée et que ses photos ne sont
-- pas enregistrées : sans elles, impossible de prouver l'état de la voiture au départ (et donc de comparer au retour).
-- Cette règle est appliquée par le serveur (et pas seulement par l'écran) ; elle ne dépend pas de la politique de
-- départ de l'agence. Le reste de la fonction est celui de la migration 0029.

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

  -- Inspection de départ obligatoire : terminée, avec au moins 8 photos (le guide actuel en demande 24 ;
  -- 8 est le minimum des anciennes inspections, qui restent valables).
  select id, statut into v_inspection
  from public.inspections
  where rental_id = p_rental_id and type = 'depart';
  if v_inspection is null or v_inspection.statut not in ('terminee', 'validee') then
    raise exception 'departure_inspection_required';
  end if;
  select count(*) into v_photos from public.inspection_photos where inspection_id = v_inspection.id;
  if v_photos < 8 then
    raise exception 'departure_inspection_required';
  end if;

  -- Exigences de l'agence (politique de départ) : bloquant seulement si l'agence l'a activé.
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
