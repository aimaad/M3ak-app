-- M3ak — « Fait » en un geste : marquer un entretien comme effectué sans passer par « Démarrer » puis « Terminer ».
-- Une seule opération (donc sûre) : kilométrage du véhicule mis à jour s'il est plus grand, entretien clôturé, et la suivante
-- est créée par le déclencheur de périodicité (0071) à partir de ce kilométrage et de cette date.
-- La fonction s'exécute avec les droits de l'appelant : l'isolation par agence et par filiale (RLS) s'applique comme d'habitude.
-- Le statut du véhicule n'est pas touché (pas d'immobilisation pour une intervention déjà faite).

create or replace function public.complete_maintenance_quick(
  p_id uuid,
  p_km int default null,
  p_date date default current_date,
  p_garage text default null,
  p_cout numeric default null
)
returns public.maintenance_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.maintenance_items;
  v_vehicle_km int;
begin
  select * into v_item from public.maintenance_items where id = p_id for update;
  if not found then
    raise exception 'maintenance_not_found';
  end if;
  if v_item.statut::text = 'effectuee' then
    raise exception 'maintenance_already_done';
  end if;
  if p_km is not null and (p_km < 0 or p_km > 2000000) then
    raise exception 'invalid_km';
  end if;
  if p_date is not null and p_date > current_date + 1 then
    raise exception 'invalid_date';
  end if;
  if p_cout is not null and p_cout < 0 then
    raise exception 'invalid_cost';
  end if;

  -- Le kilométrage du véhicule ne baisse jamais : on le met à jour seulement s'il est plus grand.
  select kilometrage into v_vehicle_km from public.vehicles where id = v_item.vehicle_id;
  if p_km is not null and p_km > coalesce(v_vehicle_km, 0) then
    update public.vehicles set kilometrage = p_km where id = v_item.vehicle_id;
  end if;

  update public.maintenance_items
    set statut = 'effectuee',
        date_intervention = coalesce(p_date, current_date),
        garage = coalesce(nullif(btrim(p_garage), ''), garage),
        cout = coalesce(p_cout, cout)
    where id = p_id
    returning * into v_item;
  return v_item;
end;
$$;

revoke all on function public.complete_maintenance_quick(uuid, int, date, text, numeric) from public, anon;
grant execute on function public.complete_maintenance_quick(uuid, int, date, text, numeric) to authenticated;
