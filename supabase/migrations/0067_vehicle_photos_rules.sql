-- M3ak — photos du véhicule : angle, 12 photos au maximum, droits de l'employé ; archivage : message plus précis.
--
-- Les photos sont dans `vehicles.photos` (JSON : une liste de { path, uploadedAt, angle }). La PREMIÈRE de la liste est la photo principale,
-- l'ordre de la liste est l'ordre de défilement de la fiche. Aucune colonne n'est ajoutée.
-- Les règles ci-dessous sont appliquées par la base, donc aussi contre un appel direct à l'API (pas seulement par l'écran) :
--   - 12 photos au maximum ;
--   - angles valides : avant, arrière, côté gauche, côté droit, intérieur, coffre, autre (un angle nommé ne sert qu'une fois ; « autre » peut se répéter) ;
--   - propriétaire et responsable : tout (changer la principale, réordonner, remplacer, supprimer) ;
--   - employé : AJOUT seulement (les photos déjà là restent, dans le même ordre ; les nouvelles viennent à la fin).
-- La suppression du fichier dans le stockage reste réservée au propriétaire et au responsable (policy déjà en place).

create or replace function public.restrict_vehicle_photos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  photo jsonb;
  seen text[] := '{}';
  angle text;
  old_count int;
  new_count int;
begin
  -- Rien à contrôler si la liste n'a pas changé (une modification d'un autre champ ne doit jamais échouer à cause des photos).
  if TG_OP = 'UPDATE' and NEW.photos is not distinct from OLD.photos then
    return NEW;
  end if;

  if jsonb_typeof(NEW.photos) is distinct from 'array' then
    raise exception 'vehicle_photos_invalid';
  end if;
  new_count := jsonb_array_length(NEW.photos);
  if new_count > 12 then
    raise exception 'vehicle_photos_too_many';
  end if;

  for photo in select * from jsonb_array_elements(NEW.photos) loop
    if jsonb_typeof(photo) is distinct from 'object' or jsonb_typeof(photo -> 'path') is distinct from 'string' then
      raise exception 'vehicle_photos_invalid';
    end if;
    angle := photo ->> 'angle';
    if angle is not null then
      if angle not in ('avant', 'arriere', 'cote_gauche', 'cote_droit', 'interieur', 'coffre', 'autre') then
        raise exception 'vehicle_photo_angle_invalid';
      end if;
      if angle <> 'autre' then
        if angle = any (seen) then
          raise exception 'vehicle_photo_angle_duplicate';
        end if;
        seen := seen || angle;
      end if;
    end if;
  end loop;

  -- Droits : un employé ne peut qu'AJOUTER des photos à la fin (pas de suppression, de remplacement, de changement de principale ni d'ordre).
  -- Appel sans utilisateur (migration, fonction serveur) : pas de restriction.
  if TG_OP = 'UPDATE' and auth.uid() is not null and not public.is_agency_manager(NEW.agency_id) then
    old_count := jsonb_array_length(coalesce(OLD.photos, '[]'::jsonb));
    if new_count < old_count
       or (select jsonb_agg(e) from jsonb_array_elements(NEW.photos) with ordinality as t(e, n) where n <= old_count)
          is distinct from coalesce(OLD.photos, '[]'::jsonb) then
      raise exception 'vehicle_photos_manager_only';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_restrict_vehicle_photos on public.vehicles;
create trigger trg_restrict_vehicle_photos
  before insert or update of photos on public.vehicles
  for each row execute function public.restrict_vehicle_photos();

-- Archivage : même règle qu'avant (propriétaire ou responsable ; refusé si le véhicule est en location ou a une location qui n'est ni terminée
-- ni annulée : en cours, en retard, réservée à venir), mais l'erreur dit combien de locations bloquent (`detail` : « count=N »).
-- Le message reste « vehicle_has_active_rentals » : l'app le reconnaît déjà.
create or replace function public.restrict_vehicle_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  blocking int;
begin
  if (OLD.archived_at is distinct from NEW.archived_at) and not public.is_agency_manager(NEW.agency_id) then
    raise exception 'archive_requires_manager';
  end if;

  if OLD.archived_at is null and NEW.archived_at is not null then
    select count(*) into blocking
      from public.rentals r
     where r.vehicle_id = NEW.id
       and r.statut not in ('terminee', 'annulee');
    if blocking > 0 or NEW.statut = 'en_location' then
      raise exception 'vehicle_has_active_rentals' using detail = format('count=%s', greatest(blocking, 1));
    end if;
  end if;

  return NEW;
end;
$$;
