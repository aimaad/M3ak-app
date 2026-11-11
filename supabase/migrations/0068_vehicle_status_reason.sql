-- M3ak — motif facultatif d'un véhicule rendu indisponible (fiche véhicule : « Rendre indisponible »).
-- Une courte note libre (200 caractères au plus). Elle disparaît d'elle-même dès que le véhicule n'est plus « indisponible » :
-- on ne garde jamais un motif périmé.

alter table public.vehicles
  add column if not exists statut_motif text
  check (statut_motif is null or char_length(statut_motif) <= 200);

create or replace function public.clear_vehicle_status_reason()
returns trigger
language plpgsql
as $$
begin
  if NEW.statut is distinct from 'indisponible' then
    NEW.statut_motif := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_clear_vehicle_status_reason on public.vehicles;
create trigger trg_clear_vehicle_status_reason
  before insert or update of statut, statut_motif on public.vehicles
  for each row execute function public.clear_vehicle_status_reason();
