-- M3ak — la couverture RÉELLE d'aujourd'hui, et non « la période qui finit le plus tard » (qui peut ne pas avoir commencé).
--
-- Exemple (nous sommes le 15/11/2026) : une assurance saisie du 16/11/2028 au 15/11/2029 ne couvre PAS la voiture aujourd'hui. Avant,
-- BIBIP la voyait « à jour » (fin lointaine) ; maintenant :
--  * `vehicle_noncompliance` (trace de la remise, notification au responsable) : une obligation est à régulariser si AUCUNE période commencée
--    ne couvre le jour (dernière période commencée terminée, ou seules des périodes à venir). Début inconnu = commencée (anciennes données).
--  * `generate_compliance_notifications` (rappels « bientôt / expirée ») : ne regarde que les périodes commencées, et se tait si une période
--    suivante s'enchaîne sans trou.
-- Reste une limite connue : un véhicule qui n'a QUE des périodes à venir n'a pas de rappel quotidien (il est tout de même signalé à la remise).

create or replace function public.vehicle_noncompliance(p_vehicle uuid, p_today date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with today as (select coalesce(p_today, (now() at time zone 'Africa/Casablanca')::date) as d),
  kinds as (
    select k.kind
    from (values ('assurance'), ('visite_technique')) as k(kind)
    where exists (select 1 from public.vehicle_compliance c where c.vehicle_id = p_vehicle and c.kind = k.kind)
  ),
  covered as (
    select k.kind,
           (select max(c.valid_until) from public.vehicle_compliance c, today t
            where c.vehicle_id = p_vehicle and c.kind = k.kind and (c.valid_from is null or c.valid_from <= t.d) and c.valid_until >= t.d) as covering_until,
           (select max(c.valid_until) from public.vehicle_compliance c, today t
            where c.vehicle_id = p_vehicle and c.kind = k.kind and c.valid_until < t.d) as past_until
    from kinds k
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'valid_until', coalesce(x.past_until, (select d from today))) order by x.kind), '[]'::jsonb)
  from covered x
  where x.covering_until is null;
$$;

revoke all on function public.vehicle_noncompliance(uuid, date) from public, anon, authenticated;

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
      -- Seule une période COMMENCÉE compte (une période à venir ne couvre rien aujourd'hui)…
      and (c.valid_from is null or c.valid_from <= v_today)
      -- … et si une période suivante s'enchaîne sans trou (renouvellement fait à l'avance), il n'y a rien à rappeler.
      and not exists (
        select 1 from public.vehicle_compliance n
        where n.vehicle_id = c.vehicle_id and n.kind = c.kind and n.valid_until > c.valid_until
          and (n.valid_from is null or n.valid_from <= c.valid_until + 1))
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
