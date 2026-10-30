-- M3ak — informations complémentaires figées sur le contrat à sa création (adresse, naissance, permis, conducteur 2…)
-- pour remplir le modèle de contrat. Comme le reste du contrat, elles ne changent plus une fois le contrat signé.

alter table public.contracts add column if not exists snapshot_values jsonb;

alter table public.contracts drop constraint if exists contracts_snapshot_values_check;
alter table public.contracts
  add constraint contracts_snapshot_values_check
  check (snapshot_values is null or (jsonb_typeof(snapshot_values) = 'object' and pg_column_size(snapshot_values) <= 20000));

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
  return NEW;
end;
$$;
