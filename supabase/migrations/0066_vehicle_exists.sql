-- M3ak — « ce véhicule existe-t-il déjà dans l'agence ? », même dans une autre filiale.
--
-- Un employé rattaché à une filiale ne voit (RLS) que les véhicules de SA filiale et les véhicules partagés : le contrôle de doublon de l'app
-- ne peut donc pas voir un véhicule d'une autre filiale. Cette fonction répond à cette seule question, sans rien révéler d'autre :
--   found        : un véhicule de l'agence a cette plaque (normalisée) ou ce VIN, archivés compris ;
--   branch_name  : le nom de sa filiale (null = véhicule sans filiale, à l'échelle de l'agence).
-- Aucun identifiant, aucune marque, aucun modèle, aucun statut : ni ouverture de fiche, ni fuite de données entre filiales.
-- Réservée aux membres de l'agence.

-- Même normalisation que l'app (src/features/vehicles/add/plate.ts, `plateKey`) : sans espaces, barres, tirets, points ni soulignés ;
-- sans marques invisibles de sens d'écriture ni allongement « ـ » ; « إ آ ٱ » = « أ » ; « ة ە » = « ه » ; en majuscules.
create or replace function public.vehicle_plate_key(p_plate text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(
    regexp_replace(
      translate(
        regexp_replace(coalesce(p_plate, ''), '[‎‏؜‪-‮⁦-⁩ـ]', '', 'g'),
        'إآٱةە',
        'أأأهه'
      ),
      '[\s|/\-._]+', '', 'g'
    )
  );
$$;

-- Normalisation du VIN (app : `vinKey`) : sans espaces, tirets, points ni soulignés ; en majuscules.
create or replace function public.vehicle_vin_key(p_vin text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(regexp_replace(coalesce(p_vin, ''), '[\s\-_.]+', '', 'g'));
$$;

-- La recherche par plaque normalisée s'appuie sur cet index (sinon : lecture de tous les véhicules de l'agence).
create index if not exists vehicles_agency_plate_key_idx on public.vehicles (agency_id, public.vehicle_plate_key(immatriculation));

create or replace function public.vehicle_exists(p_agency_id uuid, p_plate text default null, p_vin text default null)
returns table (found boolean, branch_name text)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  plate_key text := public.vehicle_plate_key(p_plate);
  vin_key text := public.vehicle_vin_key(p_vin);
  hit record;
begin
  if auth.uid() is null or not public.is_agency_member(p_agency_id) then
    raise exception 'not_allowed';
  end if;

  -- La plaque l'emporte sur le VIN (comme dans l'app) ; un VIN de moins de 5 caractères est ignoré.
  select v.id, v.branch_id, (plate_key <> '' and public.vehicle_plate_key(v.immatriculation) = plate_key) as by_plate
    into hit
    from public.vehicles v
   where v.agency_id = p_agency_id
     and (
       (plate_key <> '' and public.vehicle_plate_key(v.immatriculation) = plate_key)
       or (length(vin_key) >= 5 and v.vin is not null and public.vehicle_vin_key(v.vin) = vin_key)
     )
   order by 3 desc, v.created_at
   limit 1;

  if not found then
    return query select false, null::text;
    return;
  end if;

  return query select true, (select b.nom from public.branches b where b.id = hit.branch_id);
end;
$$;

revoke all on function public.vehicle_exists(uuid, text, text) from public, anon;
grant execute on function public.vehicle_exists(uuid, text, text) to authenticated;
