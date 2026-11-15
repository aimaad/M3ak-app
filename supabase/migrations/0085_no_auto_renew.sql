-- M3ak — PAS de renouvellement automatique : une assurance ou une visite technique n'est renouvelée que lorsque quelqu'un le CONFIRME (« Fait »).
--
-- Cette migration est sans danger dans tous les cas : si un essai de renouvellement automatique avait été installé, elle le retire (la tâche
-- horaire redevient celle d'avant) ; sinon elle ne change rien. Aucune période n'est jamais créée sans qu'une personne l'ait enregistrée.

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
  perform public.refresh_compliance_bridge(p_now);
  for r in
    select c.agency_id, c.vehicle_id, c.kind, min(c.valid_from) as starts_on, v.branch_id,
           trim(coalesce(v.marque, '') || ' ' || coalesce(v.modele, '')) as vehicle, v.immatriculation as plate
    from public.vehicle_compliance c
    join public.vehicles v on v.id = c.vehicle_id
    where v.archived_at is null and c.kind in ('assurance', 'visite_technique')
    group by c.agency_id, c.vehicle_id, c.kind, v.branch_id, v.marque, v.modele, v.immatriculation
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

drop function if exists public.auto_renew_compliance(timestamptz);
alter table public.vehicle_compliance drop column if exists auto_created;
