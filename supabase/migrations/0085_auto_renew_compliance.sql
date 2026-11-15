-- M3ak — renouvellement AUTOMATIQUE des obligations périodiques (assurance, visite technique), sans confirmation à chaque période.
--
-- Une obligation est « périodique » quand une durée en mois a été réglée sur sa période (period_months) : c'est le choix explicite de l'agence.
-- À la fin de la période, BIBIP crée seul la suivante (début = lendemain, même durée). Garde-fous (BIBIP informe, ce n'est pas une preuve
-- d'assurance ni une autorisation légale) :
--  * seulement si la période vient de finir (3 jours au plus) : une obligation laissée expirer longtemps reste « À régulariser » ;
--  * une période créée automatiquement est marquée (`auto_created`) ; elle ne peut pas en entraîner une autre tant qu'AUCUN papier n'y a
--    été ajouté : au plus un renouvellement automatique d'affilée sans justificatif ;
--  * une notification d'information prévient les responsables (« renouvelée automatiquement, ajoutez le papier »), une seule par période ;
--  * jamais pour la vignette (année civile), ni pour un véhicule archivé ; toujours dans la même agence que le véhicule.

alter table public.vehicle_compliance add column if not exists auto_created boolean not null default false;

create or replace function public.auto_renew_compliance(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (p_now at time zone 'Africa/Casablanca')::date;
  r record;
  v_start date;
  v_end date;
  v_id uuid;
  v_vehicle record;
begin
  for r in
    select distinct on (c.vehicle_id, c.kind) c.*
    from public.vehicle_compliance c join public.vehicles v on v.id = c.vehicle_id
    where c.kind in ('assurance', 'visite_technique') and v.archived_at is null
    order by c.vehicle_id, c.kind, c.valid_until desc, c.created_at desc
  loop
    -- Période finie depuis 3 jours au plus, durée réglée, et pas de chaîne de renouvellements sans papier.
    continue when r.period_months is null or r.valid_until >= v_today or v_today - r.valid_until > 3;
    continue when r.auto_created and r.document_path is null;
    v_start := r.valid_until + 1;
    v_end := (v_start + make_interval(months => r.period_months))::date - 1;
    begin
      insert into public.vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until, period_months, auto_created)
      values (r.agency_id, r.vehicle_id, r.kind, v_start, v_end, r.period_months, true)
      on conflict (vehicle_id, kind, valid_until) do nothing
      returning id into v_id;
      if v_id is not null then
        select trim(coalesce(marque, '') || ' ' || coalesce(modele, '')) as name, immatriculation as plate, branch_id into v_vehicle from public.vehicles where id = r.vehicle_id;
        perform public.audit_event(r.agency_id, 'compliance_auto_renewed', v_vehicle.plate, jsonb_build_object('vehicle', v_vehicle.name, 'kind', r.kind, 'valid_until', v_end));
        perform public.notify_agency(r.agency_id, 'compliance_auto_renewed', 'maintenance', 'info',
          jsonb_build_object('vehicle', v_vehicle.name, 'plate', v_vehicle.plate, 'maintenance', r.kind, 'date', v_end),
          array[v_vehicle.branch_id], 'managers', 'vehicle', r.vehicle_id, 'compliance_auto_renewed:' || v_id);
      end if;
    exception when others then
      raise warning 'auto_renew_compliance: échec ignoré (%)', sqlerrm;
    end;
    v_id := null;
  end loop;
end;
$$;

revoke all on function public.auto_renew_compliance(timestamptz) from public, anon, authenticated;

-- Appelée avec les rappels (toutes les heures) : renouvellement automatique, puis mise d'accord des anciens écrans, puis rappels « non couvert ».
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
  perform public.auto_renew_compliance(p_now);
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
