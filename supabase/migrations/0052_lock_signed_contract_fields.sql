-- M3ak — une fois le contrat signé, ce qui a été signé ne change plus, même en contournant l'application.
-- Verrouillés : parties (client, conducteurs), véhicule, dates, prix, caution, conditions particulières, numéro, location liée.
-- Restent modifiables : le statut (départ, clôture, annulation), l'état des lieux, les frais de retour, les notes internes, le PDF.
-- Pour corriger un contrat signé : l'annuler puis en créer un nouveau (le client signe à nouveau).

create or replace function public.lock_contract_terms_snapshot()
returns trigger
language plpgsql
as $$
begin
  if OLD.client_signed_at is not null and (
       NEW.terms_snapshot is distinct from OLD.terms_snapshot
    or NEW.snapshot_values is distinct from OLD.snapshot_values
  ) then
    raise exception 'contract_signature_locked';
  end if;

  if (OLD.client_signed_at is not null or OLD.statut in ('signe', 'en_cours', 'cloture')) and (
       NEW.agency_id is distinct from OLD.agency_id
    or NEW.rental_id is distinct from OLD.rental_id
    or NEW.numero is distinct from OLD.numero
    or NEW.customer_nom is distinct from OLD.customer_nom
    or NEW.customer_telephone is distinct from OLD.customer_telephone
    or NEW.customer_cin is distinct from OLD.customer_cin
    or NEW.driver_nom is distinct from OLD.driver_nom
    or NEW.autres_conducteurs is distinct from OLD.autres_conducteurs
    or NEW.vehicle_immatriculation is distinct from OLD.vehicle_immatriculation
    or NEW.vehicle_marque is distinct from OLD.vehicle_marque
    or NEW.vehicle_modele is distinct from OLD.vehicle_modele
    or NEW.date_debut_prevue is distinct from OLD.date_debut_prevue
    or NEW.date_fin_prevue is distinct from OLD.date_fin_prevue
    or NEW.prix_total is distinct from OLD.prix_total
    or NEW.caution_montant is distinct from OLD.caution_montant
    or NEW.conditions_particulieres is distinct from OLD.conditions_particulieres
  ) then
    raise exception 'contract_signed_fields_locked';
  end if;
  return NEW;
end;
$$;
