-- M3ak — échéances d'entretien : notifications « veille », « jour même », « est-ce fait ? » et alertes au kilométrage.
--
-- Pour chaque entretien ouvert (à venir / dû / en retard ; jamais celui qui est en intervention) d'un véhicule non archivé :
--   * veille de l'échéance (date) : une notification à partir de 9 h ;
--   * jour même : une notification à partir de 8 h ;
--   * kilométrage : « bientôt » (moins de 500 km) puis « atteint », une fois chacun ;
--   * suivi « avez-vous fait … ? » : dès que l'échéance est atteinte (date OU kilométrage, le premier des deux), à partir de 12 h, une fois par
--     jour, au plus 3 fois ; « pas encore » reporte le suivi (snoozed_until) ; après 3 suivis, un rappel « en retard » par semaine.
-- Pas de rappel en pleine nuit (7 h – 21 h, heure du Maroc). Destinataires : comme les autres rappels d'entretien (notify_agency).
-- Une seule notification par échéance, par jour et par palier (dedupe_key) : rejouer la fonction ne crée aucun doublon.
-- La fonction du rappel général (0053) n'envoie plus les anciens messages d'entretien (« à prévoir » / « en retard ») : ils sont remplacés.

alter table public.maintenance_items
  add column if not exists followup_count int not null default 0 check (followup_count between 0 and 100),
  add column if not exists last_followup_at timestamptz,
  add column if not exists snoozed_until timestamptz;

create or replace function public.generate_scheduled_notifications(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tz constant text := 'Africa/Casablanca';
  v_local timestamp := p_now at time zone c_tz;
  v_today date := v_local::date;
  r record;
begin
  -- Pas de rappel en pleine nuit (le téléphone sonnerait pour rien).
  if extract(hour from v_local) < 7 or extract(hour from v_local) >= 21 then
    return;
  end if;

  -- Retour prévu demain / aujourd'hui / en retard.
  for r in
    select rt.id, rt.agency_id, rt.date_fin_prevue, rt.branch_retour_id, rt.branch_depart_id, v.branch_id as vehicle_branch,
           (rt.date_fin_prevue at time zone c_tz)::date as end_day
    from public.rentals rt join public.vehicles v on v.id = rt.vehicle_id
    where rt.statut::text = 'en_cours' and (rt.date_fin_prevue at time zone c_tz)::date between v_today and v_today + 1
  loop
    perform public.notify_agency(r.agency_id,
      case when r.end_day = v_today then 'return_today' else 'return_tomorrow' end, 'reminder', 'warning',
      public.notification_rental_context(r.id),
      array[r.branch_retour_id, r.vehicle_branch, r.branch_depart_id], 'all', 'rental', r.id,
      (case when r.end_day = v_today then 'return_today:' else 'return_tomorrow:' end) || r.id || ':' || r.end_day);
  end loop;

  for r in
    select rt.id, rt.agency_id, rt.branch_retour_id, rt.branch_depart_id, v.branch_id as vehicle_branch
    from public.rentals rt join public.vehicles v on v.id = rt.vehicle_id
    where rt.statut::text = 'en_cours' and rt.date_fin_prevue < p_now - interval '1 hour'
  loop
    perform public.notify_agency(r.agency_id, 'return_late', 'reminder', 'urgent',
      public.notification_rental_context(r.id),
      array[r.branch_retour_id, r.vehicle_branch, r.branch_depart_id], 'all', 'rental', r.id,
      'return_late:' || r.id || ':' || v_today);
  end loop;

  -- Départ prévu aujourd'hui / demain / dépassé.
  for r in
    select rt.id, rt.agency_id, rt.branch_depart_id, v.branch_id as vehicle_branch,
           (rt.date_debut_prevue at time zone c_tz)::date as start_day
    from public.rentals rt join public.vehicles v on v.id = rt.vehicle_id
    where rt.statut::text in ('confirmee', 'reservee') and (rt.date_debut_prevue at time zone c_tz)::date between v_today and v_today + 1
  loop
    perform public.notify_agency(r.agency_id,
      case when r.start_day = v_today then 'departure_today' else 'departure_tomorrow' end, 'reminder', 'info',
      public.notification_rental_context(r.id),
      array[r.branch_depart_id, r.vehicle_branch], 'all', 'rental', r.id,
      (case when r.start_day = v_today then 'departure_today:' else 'departure_tomorrow:' end) || r.id || ':' || r.start_day);
  end loop;

  for r in
    select rt.id, rt.agency_id, rt.branch_depart_id, v.branch_id as vehicle_branch
    from public.rentals rt join public.vehicles v on v.id = rt.vehicle_id
    where rt.statut::text in ('confirmee', 'reservee') and rt.date_debut_prevue < p_now - interval '1 hour'
  loop
    perform public.notify_agency(r.agency_id, 'departure_late', 'reminder', 'warning',
      public.notification_rental_context(r.id),
      array[r.branch_depart_id, r.vehicle_branch], 'all', 'rental', r.id,
      'departure_late:' || r.id || ':' || v_today);
  end loop;

  -- Entretien : voir generate_maintenance_notifications (migration 0074) : veille, jour même, suivi « est-ce fait ? ».

  -- Permis du client qui expire dans les 14 jours alors qu'il a une location en cours ou à venir.
  for r in
    select d.id, d.agency_id, d.expires_at, c.nom_complet as customer, c.telephone as phone, rt.id as rental_id, rt.branch_depart_id, v.branch_id as vehicle_branch
    from public.customer_documents d
    join public.customers c on c.id = d.customer_id
    join public.rentals rt on rt.customer_id = c.id and rt.statut::text in ('en_cours', 'confirmee', 'reservee')
    join public.vehicles v on v.id = rt.vehicle_id
    where d.deleted_at is null and d.doc_type = 'permis' and d.expires_at is not null and d.expires_at between v_today and v_today + 14
  loop
    perform public.notify_agency(r.agency_id, 'licence_expiring', 'customer', 'warning',
      jsonb_build_object('customer', r.customer, 'phone', r.phone, 'date', r.expires_at),
      array[r.branch_depart_id, r.vehicle_branch], 'all', 'rental', r.rental_id,
      'licence_expiring:' || r.id || ':' || r.expires_at);
  end loop;

  -- Ménage : les notifications masquées depuis 30 jours, ou vieilles de 90 jours, sont effacées.
  delete from public.notifications where dismissed_at < p_now - interval '30 days' or created_at < p_now - interval '90 days';
end;
$$;

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
    select mi.id, mi.agency_id, mi.type::text as mtype, mi.echeance_date, mi.echeance_km, mi.followup_count, mi.last_followup_at, mi.snoozed_until,
           v.id as vehicle_id, v.branch_id, v.kilometrage,
           trim(coalesce(v.marque, '') || ' ' || coalesce(v.modele, '')) as vehicle, v.immatriculation as plate,
           (mi.echeance_date is not null and mi.echeance_date <= v_today) as date_reached,
           (mi.echeance_km is not null and v.kilometrage >= mi.echeance_km) as km_reached
    from public.maintenance_items mi
    join public.vehicles v on v.id = mi.vehicle_id
    where v.archived_at is null
      and mi.statut::text in ('a_venir', 'due', 'en_retard')
  loop
    v_params := jsonb_build_object('maintenance', r.mtype, 'vehicle', r.vehicle, 'plate', r.plate, 'date', r.echeance_date, 'km', r.echeance_km);

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

-- « Pas encore » : on reporte le suivi (à 9 h, heure du Maroc, dans N jours). Avec les droits de l'appelant : l'isolation par agence s'applique.
create or replace function public.snooze_maintenance_followup(p_id uuid, p_days int default 1, p_now timestamptz default now())
returns public.maintenance_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  c_tz constant text := 'Africa/Casablanca';
  v_item public.maintenance_items;
begin
  if p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'invalid_days';
  end if;
  update public.maintenance_items
    set snoozed_until = (((p_now at time zone c_tz)::date + p_days)::timestamp + interval '9 hours') at time zone c_tz
    where id = p_id and statut::text in ('a_venir', 'due', 'en_retard')
    returning * into v_item;
  if not found then
    raise exception 'maintenance_not_found';
  end if;
  return v_item;
end;
$$;

revoke all on function public.snooze_maintenance_followup(uuid, int, timestamptz) from public, anon;
grant execute on function public.snooze_maintenance_followup(uuid, int, timestamptz) to authenticated;

-- Planification toutes les heures si pg_cron est disponible (même principe que les autres rappels).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule('m3ak_maintenance') from cron.job where jobname = 'm3ak_maintenance';
      perform cron.schedule('m3ak_maintenance', '10 * * * *', 'select public.generate_maintenance_notifications()');
    exception when others then
      raise notice 'pg_cron non activé (%) : activez l''extension puis rejouez cette migration', sqlerrm;
    end;
  else
    raise notice 'pg_cron indisponible : les rappels d''entretien ne seront pas générés';
  end if;
end;
$$;
