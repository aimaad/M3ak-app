-- M3ak — Phase de stabilisation (suite) : corrige l'usurpation possible de
-- "created_by" signalée dans le rapport d'audit. Même famille que la faille
-- de signature corrigée en 0016 : rien n'empêchait un appel direct à l'API
-- d'attribuer la création d'une agence, d'une réservation, d'une invitation
-- ou d'un contrat à un AUTRE utilisateur réel que l'appelant.

create or replace function public.enforce_created_by_is_caller()
returns trigger
language plpgsql
as $$
begin
  if NEW.created_by is not null and NEW.created_by is distinct from auth.uid() then
    raise exception 'created_by_must_be_caller';
  end if;
  return NEW;
end;
$$;

create trigger trg_agencies_created_by_caller
  before insert or update of created_by on public.agencies
  for each row execute function public.enforce_created_by_is_caller();

create trigger trg_rentals_created_by_caller
  before insert or update of created_by on public.rentals
  for each row execute function public.enforce_created_by_is_caller();

create trigger trg_agency_invites_created_by_caller
  before insert or update of created_by on public.agency_invites
  for each row execute function public.enforce_created_by_is_caller();

create trigger trg_contracts_created_by_caller
  before insert or update of created_by on public.contracts
  for each row execute function public.enforce_created_by_is_caller();
