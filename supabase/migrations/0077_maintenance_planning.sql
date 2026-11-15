-- M3ak — planification d'une échéance d'entretien (rendez-vous), conflits avec les locations, rappels, clôture des notifications.
--
--  * « Planifiée » = un rendez-vous est renseigné (planned_at) : état dérivé, aucun nouveau statut en base.
--  * Conflits : les locations et réservations ouvertes qui chevauchent le créneau (durée inconnue = 2 heures). Avec un conflit, l'application
--    avertit ; on peut poursuivre en signalant le conflit au responsable (notification). Jamais bloquant pour l'employé.
--  * Rappels : la veille (9 h) et le jour même (8 h) ; pas de « est-ce fait ? » avant le rendez-vous.
--  * Début d'intervention : si une location chevauche, le responsable est informé.
--  * Échéance effectuée ou supprimée : les notifications actives associées sont clôturées. Une notification lue ne vaut PAS échéance résolue.

alter table public.maintenance_items
  add column if not exists planned_at timestamptz,
  add column if not exists planned_minutes int check (planned_minutes is null or planned_minutes between 5 and 10080),
  add column if not exists planned_garage text check (planned_garage is null or char_length(planned_garage) between 1 and 120),
  add column if not exists planned_conflict boolean not null default false;

-- Locations et réservations ouvertes qui chevauchent le créneau [début, début + durée] (2 h par défaut). Droits de l'appelant (RLS).
create or replace function public.maintenance_conflicts(p_vehicle uuid, p_start timestamptz, p_minutes int default null)
returns table (rental_id uuid, customer text, statut text, date_debut timestamptz, date_fin timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  select r.id, c.nom_complet, r.statut::text, r.date_debut_prevue, r.date_fin_prevue
  from public.rentals r
  join public.customers c on c.id = r.customer_id
  where r.vehicle_id = p_vehicle
    and r.statut::text not in ('terminee', 'annulee')
    and r.date_debut_prevue < p_start + make_interval(mins => coalesce(p_minutes, 120))
    and r.date_fin_prevue > p_start
  order by r.date_debut_prevue;
$$;

revoke all on function public.maintenance_conflicts(uuid, timestamptz, int) from public, anon;
grant execute on function public.maintenance_conflicts(uuid, timestamptz, int) to authenticated;

-- Planifier (ou annuler le rendez-vous avec p_at null). Avec un conflit : refus « maintenance_conflict » sauf p_proceed (on poursuit en le signalant).
create or replace function public.plan_maintenance(p_id uuid, p_at timestamptz, p_minutes int default null, p_garage text default null, p_proceed boolean default false)
returns public.maintenance_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.maintenance_items;
  v_conflicts int := 0;
begin
  select * into v_item from public.maintenance_items where id = p_id for update;
  if not found or v_item.statut::text not in ('a_venir', 'due', 'en_retard') then
    raise exception 'maintenance_not_found';
  end if;
  if p_at is null then
    update public.maintenance_items set planned_at = null, planned_minutes = null, planned_garage = null, planned_conflict = false where id = p_id returning * into v_item;
    return v_item;
  end if;
  if p_at < now() - interval '1 hour' then
    raise exception 'invalid_date';
  end if;
  select count(*) into v_conflicts from public.maintenance_conflicts(v_item.vehicle_id, p_at, p_minutes);
  if v_conflicts > 0 and not coalesce(p_proceed, false) then
    raise exception 'maintenance_conflict' using detail = 'count=' || v_conflicts;
  end if;
  update public.maintenance_items
    set planned_at = p_at, planned_minutes = p_minutes, planned_garage = nullif(btrim(p_garage), ''), planned_conflict = v_conflicts > 0
    where id = p_id returning * into v_item;
  return v_item;
end;
$$;

revoke all on function public.plan_maintenance(uuid, timestamptz, int, text, boolean) from public, anon;
grant execute on function public.plan_maintenance(uuid, timestamptz, int, text, boolean) to authenticated;

-- Conflit signalé au responsable : à la planification (poursuivie malgré le conflit) et au début de l'intervention.
create or replace function public.maintenance_notify_conflict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tz constant text := 'Africa/Casablanca';
  v_vehicle record;
  v_customer text;
  v_start timestamptz;
begin
  if TG_OP = 'UPDATE' and new.planned_conflict and new.planned_at is not null
     and (old.planned_conflict is distinct from new.planned_conflict or old.planned_at is distinct from new.planned_at) then
    v_start := new.planned_at;
    select trim(coalesce(marque, '') || ' ' || coalesce(modele, '')) as name, immatriculation as plate, branch_id into v_vehicle from public.vehicles where id = new.vehicle_id;
    select customer into v_customer from public.maintenance_conflicts(new.vehicle_id, new.planned_at, new.planned_minutes) limit 1;
    perform public.notify_agency(new.agency_id, 'maintenance_conflict', 'maintenance', 'urgent',
      jsonb_build_object('maintenance', new.type::text, 'label', case when new.type::text = 'autre' then new.titre end, 'vehicle', v_vehicle.name, 'plate', v_vehicle.plate, 'customer', v_customer, 'date', new.planned_at, 'time', to_char(new.planned_at at time zone c_tz, 'HH24:MI')),
      array[v_vehicle.branch_id], 'managers', 'maintenance', new.id, 'maintenance_conflict:' || new.id || ':' || to_char(new.planned_at, 'YYYY-MM-DD"T"HH24:MI'));
  elsif TG_OP = 'UPDATE' and new.statut::text = 'en_cours' and old.statut::text is distinct from 'en_cours' then
    select customer into v_customer from public.maintenance_conflicts(new.vehicle_id, now(), 120) limit 1;
    if v_customer is not null then
      select trim(coalesce(marque, '') || ' ' || coalesce(modele, '')) as name, immatriculation as plate, branch_id into v_vehicle from public.vehicles where id = new.vehicle_id;
      perform public.notify_agency(new.agency_id, 'maintenance_conflict', 'maintenance', 'urgent',
        jsonb_build_object('maintenance', new.type::text, 'label', case when new.type::text = 'autre' then new.titre end, 'vehicle', v_vehicle.name, 'plate', v_vehicle.plate, 'customer', v_customer, 'date', now(), 'time', to_char(now() at time zone c_tz, 'HH24:MI')),
        array[v_vehicle.branch_id], 'managers', 'maintenance', new.id, 'maintenance_conflict:' || new.id || ':start:' || to_char(now(), 'YYYY-MM-DD"T"HH24'));
    end if;
  end if;
  return new;
exception when others then
  raise warning 'maintenance_notify_conflict: échec ignoré (%)', sqlerrm;
  return new;
end;
$$;

revoke all on function public.maintenance_notify_conflict() from public, anon, authenticated;
drop trigger if exists trg_maintenance_notify_conflict on public.maintenance_items;
create trigger trg_maintenance_notify_conflict
  after update of planned_at, planned_conflict, statut on public.maintenance_items
  for each row execute function public.maintenance_notify_conflict();

-- Échéance effectuée ou supprimée : on clôture ses notifications actives (une notification lue ne vaut pas résolue : seul le statut compte).
create or replace function public.maintenance_close_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := case when TG_OP = 'DELETE' then old.id else new.id end;
begin
  if TG_OP = 'DELETE' or (new.statut::text = 'effectuee' and old.statut::text is distinct from 'effectuee') then
    update public.notifications set dismissed_at = now() where link_type = 'maintenance' and link_id = v_id and dismissed_at is null;
  end if;
  return coalesce(new, old);
exception when others then
  raise warning 'maintenance_close_notifications: échec ignoré (%)', sqlerrm;
  return coalesce(new, old);
end;
$$;

revoke all on function public.maintenance_close_notifications() from public, anon, authenticated;
drop trigger if exists trg_maintenance_close_notifications on public.maintenance_items;
create trigger trg_maintenance_close_notifications
  after update of statut or delete on public.maintenance_items
  for each row execute function public.maintenance_close_notifications();

create or replace function public.generate_maintenance_notifications(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tz constant text := 'Africa/Casablanca';
  c_max_followups constant int := 3;
  v_local timestamp := p_now at time zone c_tz;
  v_today date := v_local::date;
  v_hour int := extract(hour from v_local);
  r record;
  v_params jsonb;
begin
  if v_hour < 7 or v_hour >= 21 then
    return;
  end if;

  for r in
    select mi.id, mi.agency_id, mi.type::text as mtype, mi.titre, mi.planned_at, mi.planned_garage, mi.echeance_date, mi.echeance_km, mi.followup_count, mi.last_followup_at, mi.snoozed_until,
           v.id as vehicle_id, v.branch_id, v.kilometrage,
           trim(coalesce(v.marque, '') || ' ' || coalesce(v.modele, '')) as vehicle, v.immatriculation as plate,
           (mi.echeance_date is not null and mi.echeance_date <= v_today) as date_reached,
           (mi.echeance_km is not null and v.kilometrage >= mi.echeance_km) as km_reached
    from public.maintenance_items mi
    join public.vehicles v on v.id = mi.vehicle_id
    where v.archived_at is null
      and mi.statut::text in ('a_venir', 'due', 'en_retard')
  loop
    v_params := jsonb_build_object('maintenance', r.mtype, 'label', case when r.mtype = 'autre' then r.titre end, 'vehicle', r.vehicle, 'plate', r.plate, 'date', r.echeance_date, 'km', r.echeance_km);

    -- Intervention planifiée : rappel la veille (à partir de 9 h) et le jour même (à partir de 8 h).
    if r.planned_at is not null then
      if (r.planned_at at time zone c_tz)::date = v_today + 1 and v_hour >= 9 then
        perform public.notify_agency(r.agency_id, 'maintenance_planned_eve', 'maintenance', 'info', v_params || jsonb_build_object('time', to_char(r.planned_at at time zone c_tz, 'HH24:MI'), 'garage', r.planned_garage),
          array[r.branch_id], 'all', 'maintenance', r.id, 'maintenance_planned_eve:' || r.id || ':' || to_char(r.planned_at, 'YYYY-MM-DD"T"HH24:MI'));
      end if;
      if (r.planned_at at time zone c_tz)::date = v_today and v_hour >= 8 then
        perform public.notify_agency(r.agency_id, 'maintenance_planned_today', 'maintenance', 'warning', v_params || jsonb_build_object('time', to_char(r.planned_at at time zone c_tz, 'HH24:MI'), 'garage', r.planned_garage),
          array[r.branch_id], 'all', 'maintenance', r.id, 'maintenance_planned_today:' || r.id || ':' || to_char(r.planned_at, 'YYYY-MM-DD"T"HH24:MI'));
      end if;
    end if;

    -- Veille (date).
    if r.echeance_date = v_today + 1 and v_hour >= 9 then
      perform public.notify_agency(r.agency_id, 'maintenance_eve', 'maintenance', 'info', v_params, array[r.branch_id], 'all', 'maintenance', r.id,
        'maintenance_eve:' || r.id || ':' || r.echeance_date);
    end if;

    -- Jour même (date).
    if r.echeance_date = v_today and v_hour >= 8 then
      perform public.notify_agency(r.agency_id, 'maintenance_today', 'maintenance', 'warning', v_params, array[r.branch_id], 'all', 'maintenance', r.id,
        'maintenance_today:' || r.id || ':' || r.echeance_date);
    end if;

    -- Kilométrage : bientôt (moins de 500 km), puis atteint — une fois chacun.
    if r.echeance_km is not null and v_hour >= 8 then
      if not r.km_reached and r.echeance_km - r.kilometrage <= 500 then
        perform public.notify_agency(r.agency_id, 'maintenance_km_soon', 'maintenance', 'warning', v_params || jsonb_build_object('left', r.echeance_km - r.kilometrage),
          array[r.branch_id], 'all', 'maintenance', r.id, 'maintenance_km_soon:' || r.id || ':' || r.echeance_km);
      elsif r.km_reached then
        perform public.notify_agency(r.agency_id, 'maintenance_km_reached', 'maintenance', 'warning', v_params, array[r.branch_id], 'all', 'maintenance', r.id,
          'maintenance_km_reached:' || r.id || ':' || r.echeance_km);
      end if;
    end if;

    -- Échéance atteinte (date OU kilométrage) : suivi « est-ce fait ? » à partir de 12 h, une fois par jour, 3 fois au plus.
    -- Pas de « est-ce fait ? » tant que le rendez-vous planifié n'est pas arrivé (l'échéance est déjà prise en charge).
    if (r.date_reached or r.km_reached) and v_hour >= 12 and (r.planned_at is null or r.planned_at <= p_now) then
      if r.followup_count < c_max_followups then
        if (r.snoozed_until is null or r.snoozed_until <= p_now)
           and (r.last_followup_at is null or (r.last_followup_at at time zone c_tz)::date < v_today) then
          perform public.notify_agency(r.agency_id, 'maintenance_followup', 'maintenance', 'warning', v_params, array[r.branch_id], 'all', 'maintenance', r.id,
            'maintenance_followup:' || r.id || ':' || v_today);
          update public.maintenance_items set followup_count = followup_count + 1, last_followup_at = p_now where id = r.id;
        end if;
      else
        -- Suivis épuisés : plus de relance « est-ce fait ? », un rappel « en retard » par semaine (l'alerte reste dans l'application).
        perform public.notify_agency(r.agency_id, 'maintenance_overdue', 'maintenance', 'urgent', v_params, array[r.branch_id], 'all', 'maintenance', r.id,
          'maintenance_overdue:' || r.id || ':' || to_char(v_today, 'IYYY-IW'));
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_maintenance_notifications(timestamptz) from public, anon, authenticated;
