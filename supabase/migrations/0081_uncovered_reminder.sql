-- M3ak — rappel hebdomadaire « non couvert aujourd'hui » : un véhicule dont l'assurance (ou la visite technique) n'a QUE des périodes à venir.
--
-- Exemple : une assurance saisie du 16/11/2028 au 15/11/2029 alors que nous sommes en 2026 ne couvre pas la voiture aujourd'hui. Le robot
-- quotidien ne trouvait aucune période commencée et n'envoyait rien. Maintenant : une notification urgente aux responsables (jamais à
-- l'employé), au plus UNE par véhicule, par obligation et par semaine, tant qu'aucune période ne couvre le véhicule. BIBIP informe : rien n'est bloqué.

create or replace function public.generate_uncovered_notifications(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := ((p_now at time zone 'Africa/Casablanca'))::date;
  r record;
begin
  for r in
    select c.agency_id, c.vehicle_id, c.kind, min(c.valid_from) as starts_on, v.branch_id,
           trim(coalesce(v.marque, '') || ' ' || coalesce(v.modele, '')) as vehicle, v.immatriculation as plate
    from public.vehicle_compliance c
    join public.vehicles v on v.id = c.vehicle_id
    where v.archived_at is null and c.kind in ('assurance', 'visite_technique')
    group by c.agency_id, c.vehicle_id, c.kind, v.branch_id, v.marque, v.modele, v.immatriculation
    -- Aucune période commencée (toutes à venir) : sinon le rappel quotidien habituel s'en charge.
    having bool_and(c.valid_from is not null and c.valid_from > v_today)
  loop
    perform public.notify_agency(r.agency_id, 'compliance_uncovered', 'maintenance', 'urgent',
      jsonb_build_object('vehicle', r.vehicle, 'plate', r.plate, 'maintenance', r.kind, 'date', r.starts_on),
      array[r.branch_id], 'managers', 'vehicle', r.vehicle_id,
      'compliance_uncovered:' || r.vehicle_id || ':' || r.kind || ':' || ((v_today - date '2024-01-01') / 7));
  end loop;
end;
$$;

revoke all on function public.generate_uncovered_notifications(timestamptz) from public, anon, authenticated;

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
  perform public.generate_uncovered_notifications(p_now);
end;
$$;

revoke all on function public.generate_compliance_notifications(timestamptz) from public, anon, authenticated;
