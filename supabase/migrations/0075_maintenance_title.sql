-- M3ak — nom d'un entretien « Autre » (ex. « Courroie de distribution »), pour que l'écran et les notifications disent de quoi il s'agit.
-- Facultatif côté base (80 caractères au plus) ; l'application l'exige pour le type « Autre ».

alter table public.maintenance_items
  add column if not exists titre text check (titre is null or char_length(titre) between 1 and 80);

-- Les notifications d'entretien disent le nom d'un « Autre » (paramètre « label »).
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
    select mi.id, mi.agency_id, mi.type::text as mtype, mi.titre, mi.echeance_date, mi.echeance_km, mi.followup_count, mi.last_followup_at, mi.snoozed_until,
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
    if (r.date_reached or r.km_reached) and v_hour >= 12 then
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
