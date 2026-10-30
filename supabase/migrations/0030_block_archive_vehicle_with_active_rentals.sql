-- M3ak — un véhicule réservé ou en location ne peut pas être archivé.
-- La règle est appliquée côté serveur (trigger), donc aussi contre un appel REST direct.
-- Un véhicule dont les locations sont toutes terminées ou annulées reste archivable.

create or replace function public.restrict_vehicle_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (OLD.archived_at is distinct from NEW.archived_at) and not public.is_agency_manager(NEW.agency_id) then
    raise exception 'archive_requires_manager';
  end if;

  if OLD.archived_at is null and NEW.archived_at is not null then
    if NEW.statut = 'en_location' or exists (
      select 1
      from public.rentals r
      where r.vehicle_id = NEW.id
        and r.statut not in ('terminee', 'annulee')
    ) then
      raise exception 'vehicle_has_active_rentals';
    end if;
  end if;

  return NEW;
end;
$$;
