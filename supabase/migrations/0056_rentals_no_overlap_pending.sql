-- M3ak — une voiture ne peut pas être promise deux fois sur le même créneau, même en attente de confirmation.
--
-- Jusqu'ici, seule la contrainte d'exclusion (migration 0014) protégeait les locations réservées / confirmées / en cours ;
-- les locations « en attente de confirmation » pouvaient donc se chevaucher entre elles (et avec une location confirmée
-- créée après coup), ce qui donnait des doubles réservations visibles dans la liste et le calendrier.
--
-- Cette règle s'applique aux locations CRÉÉES ou DÉPLACÉES (autre voiture ou autres dates) et à celles qui se confirment,
-- jamais aux chevauchements déjà présents : ils restent visibles (alerte « chevauchement » dans l'app) et se règlent en
-- annulant ou en déplaçant l'une des deux locations. Démarrer une location (confirmée → en cours) n'est jamais bloqué.
-- Le créneau est comparé en instants : un retour à 18 h et un départ à 18 h ne se chevauchent pas ; 09 h < 18 h, si.

create or replace function public.prevent_rental_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.statut::text not in ('en_attente_confirmation', 'reservee', 'confirmee', 'en_cours') then
    return NEW;
  end if;

  -- Démarrage d'une location déjà en place : ni voiture ni dates ne changent, rien à vérifier.
  if TG_OP = 'UPDATE'
     and NEW.statut::text = 'en_cours'
     and NEW.vehicle_id = OLD.vehicle_id
     and NEW.date_debut_prevue = OLD.date_debut_prevue
     and NEW.date_fin_prevue = OLD.date_fin_prevue then
    return NEW;
  end if;

  if exists (
    select 1
    from public.rentals r
    where r.vehicle_id = NEW.vehicle_id
      and r.id is distinct from NEW.id
      and r.statut::text in ('en_attente_confirmation', 'reservee', 'confirmee', 'en_cours')
      and tstzrange(r.date_debut_prevue, r.date_fin_prevue, '[)') && tstzrange(NEW.date_debut_prevue, NEW.date_fin_prevue, '[)')
  ) then
    -- Même code que la contrainte d'exclusion : l'app l'affiche déjà comme « véhicule déjà réservé sur cette période ».
    raise exception 'rental_overlap' using errcode = '23P01';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_rental_overlap on public.rentals;
create trigger trg_prevent_rental_overlap
  before insert or update of vehicle_id, date_debut_prevue, date_fin_prevue, statut on public.rentals
  for each row execute function public.prevent_rental_overlap();
