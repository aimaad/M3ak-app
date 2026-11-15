-- M3ak — un renouvellement REMPLACE le papier de l'obligation (la photo est facultative).
-- Avant : une nouvelle période enregistrée sans photo laissait l'ANCIEN papier (périmé) rattaché à la nouvelle date. Maintenant, le document
-- « Assurance » / « Visite technique » du véhicule porte la date de la période en cours et SON papier ; sans photo pour cette période,
-- l'entrée garde un chemin vide (« papier à ajouter ») au lieu de montrer l'ancien papier expiré.

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
  -- Le papier suit la PÉRIODE : celui de la période en cours, sinon (même date de fin) celui déjà rangé dans les documents. Un renouvellement
  -- enregistré SANS photo ne garde donc jamais l'ancien papier périmé : le nouveau est facultatif, l'ancien est remplacé.
  v_path := coalesce(v_latest.document_path, case when (v_entry ->> 'expiresAt') = coalesce(v_end, v_latest.valid_until)::text then nullif(v_entry ->> 'path', '') end);

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
