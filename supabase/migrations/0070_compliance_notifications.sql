-- M3ak — rappels des obligations du véhicule (assurance, visite technique, vignette), pour le propriétaire et les responsables.
--
-- Chaque heure (pg_cron, comme les autres rappels), pour la période EN COURS de chaque véhicule non archivé :
--   - avant l'échéance : une notification quand on franchit 30, 15, 7, 3, 1 jour(s), puis le jour même (une seule fois par palier ;
--     si le planificateur a été arrêté, la première exécution suivante envoie le palier le plus proche, pas tous) ;
--   - après l'échéance : « expirée » dès le lendemain, rappelée tous les 7 jours jusqu'au renouvellement (un renouvellement = une nouvelle période,
--     donc de nouveaux paliers).
-- Vignette : la « date limite » est le 31 janvier de l'année qui n'est pas encore couverte (ou de l'année suivante si l'année en cours l'est).
-- Un véhicule sans aucune période enregistrée ne déclenche rien (on ne peut pas affirmer qu'il manque quelque chose) : l'application
-- le signale d'une autre façon (« non renseignée », avertissement avant location).
-- Pas de rappel en pleine nuit (7 h – 21 h, heure du Maroc). Destinataires : propriétaire et responsables (filiales respectées).

create or replace function public.generate_compliance_notifications(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tz constant text := 'Africa/Casablanca';
  v_local timestamp := p_now at time zone c_tz;
  v_today date := v_local::date;
  v_deadline date;
  v_days int;
  v_threshold int;
  r record;
begin
  if extract(hour from v_local) < 7 or extract(hour from v_local) >= 21 then
    return;
  end if;

  for r in
    select distinct on (c.vehicle_id, c.kind)
           c.id, c.agency_id, c.vehicle_id, c.kind, c.valid_until, v.branch_id,
           trim(coalesce(v.marque, '') || ' ' || coalesce(v.modele, '')) as vehicle, v.immatriculation as plate
    from public.vehicle_compliance c
    join public.vehicles v on v.id = c.vehicle_id
    where v.archived_at is null
    order by c.vehicle_id, c.kind, c.valid_until desc, c.created_at desc
  loop
    if r.kind = 'vignette' then
      v_deadline := case
        when extract(year from r.valid_until) >= extract(year from v_today)
          then make_date(extract(year from r.valid_until)::int + 1, 1, 31)
        else make_date(extract(year from v_today)::int, 1, 31)
      end;
    else
      v_deadline := r.valid_until;
    end if;
    v_days := v_deadline - v_today;

    if v_days < 0 then
      perform public.notify_agency(r.agency_id, 'compliance_expired', 'maintenance', 'urgent',
        jsonb_build_object('vehicle', r.vehicle, 'plate', r.plate, 'maintenance', r.kind, 'date', v_deadline),
        array[r.branch_id], 'managers', 'vehicle', r.vehicle_id,
        'compliance_expired:' || r.id || ':' || ((-v_days - 1) / 7));
    elsif v_days <= 30 then
      v_threshold := case when v_days = 0 then 0 when v_days <= 1 then 1 when v_days <= 3 then 3 when v_days <= 7 then 7 when v_days <= 15 then 15 else 30 end;
      perform public.notify_agency(r.agency_id, 'compliance_due', 'maintenance',
        case when v_threshold <= 7 then 'warning' else 'info' end,
        jsonb_build_object('vehicle', r.vehicle, 'plate', r.plate, 'maintenance', r.kind, 'date', v_deadline, 'days', v_days),
        array[r.branch_id], 'managers', 'vehicle', r.vehicle_id,
        'compliance_due:' || r.id || ':' || v_threshold);
    end if;
  end loop;
end;
$$;

revoke all on function public.generate_compliance_notifications(timestamptz) from public, anon, authenticated;

-- Planification toutes les heures si pg_cron est disponible (même principe que les autres rappels).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule('m3ak_compliance') from cron.job where jobname = 'm3ak_compliance';
      perform cron.schedule('m3ak_compliance', '5 * * * *', 'select public.generate_compliance_notifications()');
    exception when others then
      raise notice 'pg_cron non activé (%) : activez l''extension puis rejouez cette migration', sqlerrm;
    end;
  else
    raise notice 'pg_cron indisponible : les rappels des obligations ne seront pas générés';
  end if;
end;
$$;
