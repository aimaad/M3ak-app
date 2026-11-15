-- M3ak — les anciens écrans (« À surveiller », liste des documents, chat) lisent la date d'expiration du DOCUMENT et l'échéance d'entretien :
-- ils sont remis d'accord avec la couverture RÉELLE d'aujourd'hui (voir 0080), et non plus avec « la période qui finit le plus tard ».
--  * couverture continue (périodes enchaînées sans trou) : la fin de la chaîne ;
--  * trou ou période terminée : la fin de la dernière période terminée (donc EXPIRÉE) ;
--  * seules des périodes à venir : une échéance EN RETARD (hier) ; le document garde sa vraie date (on n'invente jamais de période).
-- Le temps passe sans écriture : la tâche horaire `refresh_compliance_bridge` remet d'accord les véhicules dont la situation a changé
-- (une période qui commence, une période qui se termine), sans rien recréer quand tout est déjà d'accord.

create or replace function public.vehicle_compliance_effective(p_vehicle uuid, p_kind text, p_today date)
returns table (end_date date, only_future boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_end date;
  v_next date;
begin
  select max(c.valid_until) into v_end from public.vehicle_compliance c
  where c.vehicle_id = p_vehicle and c.kind = p_kind and (c.valid_from is null or c.valid_from <= p_today) and c.valid_until >= p_today;
  if v_end is not null then
    loop
      select max(c.valid_until) into v_next from public.vehicle_compliance c
      where c.vehicle_id = p_vehicle and c.kind = p_kind and c.valid_until > v_end and (c.valid_from is null or c.valid_from <= v_end + 1);
      exit when v_next is null;
      v_end := v_next;
    end loop;
    return query select v_end, false;
    return;
  end if;
  select max(c.valid_until) into v_end from public.vehicle_compliance c where c.vehicle_id = p_vehicle and c.kind = p_kind and c.valid_until < p_today;
  if v_end is not null then
    return query select v_end, false;
    return;
  end if;
  return query select null::date, true;
end;
$$;

revoke all on function public.vehicle_compliance_effective(uuid, text, date) from public, anon, authenticated;

drop function if exists public.vehicle_compliance_resync(uuid, text, uuid);

create or replace function public.vehicle_compliance_resync(p_vehicle uuid, p_kind text, p_agency uuid, p_today date default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest public.vehicle_compliance;
  v_path text;
  v_entry jsonb;
  v_today date := coalesce(p_today, (now() at time zone 'Africa/Casablanca')::date);
  v_end date;
  v_only_future boolean;
begin
  if p_kind not in ('assurance', 'visite_technique') then
    return;
  end if;

  select * into v_latest from public.vehicle_compliance
  where vehicle_id = p_vehicle and kind = p_kind
  order by valid_until desc, created_at desc
  limit 1;

  -- Plus aucune période (tout supprimé) : on ne touche à rien, l'existant reste tel quel.
  if v_latest.id is null then
    return;
  end if;

  -- Ce qui couvre AUJOURD'HUI (et non « la période qui finit le plus tard », qui peut ne pas avoir commencé).
  select e.end_date, e.only_future into v_end, v_only_future from public.vehicle_compliance_effective(p_vehicle, p_kind, v_today) e;

  delete from public.maintenance_items
  where vehicle_id = p_vehicle and type::text = p_kind and statut::text in ('a_venir', 'due', 'en_retard');
  if v_only_future then
    -- Seules des périodes à venir : rien ne couvre aujourd'hui → échéance EN RETARD (hier), vue par « À surveiller » et le chat.
    insert into public.maintenance_items (agency_id, vehicle_id, type, echeance_date, statut)
    values (p_agency, p_vehicle, p_kind::public.maintenance_type, v_today - 1, 'en_retard');
  else
    insert into public.maintenance_items (agency_id, vehicle_id, type, echeance_date, statut)
    values (p_agency, p_vehicle, p_kind::public.maintenance_type, v_end, 'a_venir');
  end if;

  -- Entrée « document » existante de ce type : une date saisie à l'ajout du véhicule est enregistrée SANS fichier (chemin vide).
  select d into v_entry
  from public.vehicles v, jsonb_array_elements(case when jsonb_typeof(v.documents) = 'array' then v.documents else '[]'::jsonb end) d
  where v.id = p_vehicle and d ->> 'type' = p_kind
  limit 1;
  v_path := coalesce(v_latest.document_path, nullif(v_entry ->> 'path', ''));

  -- Rien à écrire s'il n'y a ni entrée ni photo : l'échéance d'entretien ci-dessus suffit aux anciens écrans.
  if v_entry is not null or v_path is not null then
    update public.vehicles v
    set documents = coalesce((
          select jsonb_agg(d) from jsonb_array_elements(case when jsonb_typeof(v.documents) = 'array' then v.documents else '[]'::jsonb end) d
          where d ->> 'type' <> p_kind), '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
             'type', p_kind,
             'path', coalesce(v_path, ''),
             'uploadedAt', coalesce(v_entry ->> 'uploadedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
             'expiresAt', case when v_only_future then v_latest.valid_until else v_end end))
    where v.id = p_vehicle;
  end if;
end;
$$;

revoke all on function public.vehicle_compliance_resync(uuid, text, uuid, date) from public, anon, authenticated;

create or replace function public.refresh_compliance_bridge(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (p_now at time zone 'Africa/Casablanca')::date;
  r record;
  e record;
begin
  for r in
    select distinct c.vehicle_id, c.kind, c.agency_id
    from public.vehicle_compliance c join public.vehicles v on v.id = c.vehicle_id
    where c.kind in ('assurance', 'visite_technique') and v.archived_at is null
  loop
    select * into e from public.vehicle_compliance_effective(r.vehicle_id, r.kind, v_today);
    if e.only_future then
      if exists (select 1 from public.maintenance_items m where m.vehicle_id = r.vehicle_id and m.type::text = r.kind and m.statut::text = 'en_retard') then
        continue;
      end if;
    elsif exists (select 1 from public.maintenance_items m where m.vehicle_id = r.vehicle_id and m.type::text = r.kind
                  and m.statut::text in ('a_venir', 'due', 'en_retard') and m.echeance_date = e.end_date) then
      continue;
    end if;
    perform public.vehicle_compliance_resync(r.vehicle_id, r.kind, r.agency_id, v_today);
  end loop;
exception when others then
  raise warning 'refresh_compliance_bridge: échec ignoré (%)', sqlerrm;
end;
$$;

revoke all on function public.refresh_compliance_bridge(timestamptz) from public, anon, authenticated;

-- Appelée avec les rappels (toutes les heures) : la mise à jour se fait avant de générer les rappels « non couvert ».
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
