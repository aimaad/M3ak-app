-- M3ak — le statut d'un véhicule réservé ou en location ne se change pas à la main (règle aussi appliquée côté serveur,
-- donc contre un appel REST direct). Même esprit que 0030 (archivage).
--
--  * Changement MANUEL = mise à jour directe par un utilisateur connecté. Les mises à jour faites par le serveur lui-même
--    (départ, retour, panne, fonctions de l'application, déclencheurs) ne sont jamais bloquées.
--  * Bloqué : passer à « maintenance », « en préparation » ou « indisponible » quand une location est ouverte (ni terminée ni
--    annulée), et quitter « en location » à la main (c'est la location qui le fait, par son départ et son retour).
--  * Jamais bloqué : redevenir « disponible » depuis « maintenance » ou « indisponible » (ex. une panne pendant une location).

create or replace function public.vehicle_open_rentals(p_vehicle uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.rentals r where r.vehicle_id = p_vehicle and r.statut::text not in ('terminee', 'annulee'));
$$;

revoke all on function public.vehicle_open_rentals(uuid) from public, anon;
grant execute on function public.vehicle_open_rentals(uuid) to authenticated;

create or replace function public.restrict_vehicle_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.statut is not distinct from OLD.statut then
    return NEW;
  end if;
  -- Hors changement manuel (déclencheur, fonction du serveur, rôle de service) : on ne touche à rien.
  if pg_trigger_depth() > 1 or current_user not in ('authenticated', 'anon') then
    return NEW;
  end if;
  if OLD.statut::text = 'en_location'
     or (NEW.statut::text in ('maintenance', 'en_preparation', 'indisponible') and public.vehicle_open_rentals(NEW.id)) then
    raise exception 'vehicle_status_locked' using errcode = 'P0001';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_restrict_vehicle_status_change on public.vehicles;
create trigger trg_restrict_vehicle_status_change
  before update of statut on public.vehicles
  for each row execute function public.restrict_vehicle_status_change();
