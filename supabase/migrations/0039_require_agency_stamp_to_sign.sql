-- M3ak — le cachet de l'agence est obligatoire pour signer un contrat.
-- Appliqué côté serveur (contre un appel REST direct aussi) : le passage à « signé » est refusé
-- tant que l'agence n'a pas enregistré son cachet. Les contrats déjà signés ne sont pas touchés.

create or replace function public.require_signature_proof()
returns trigger
language plpgsql
as $$
declare
  prefix text := NEW.agency_id::text || '/contracts/' || NEW.id::text || '/';
begin
  if NEW.statut = 'signe' and (NEW.signed_at is null or NEW.signed_by is null) then
    raise exception 'contract_signature_proof_required';
  end if;

  if TG_OP = 'UPDATE' and OLD.statut is distinct from 'signe' and NEW.statut = 'signe' then
    if NEW.client_signature_path is null then
      raise exception 'contract_client_signature_required';
    end if;
    if not exists (select 1 from public.agencies a where a.id = NEW.agency_id and a.stamp_path is not null) then
      raise exception 'contract_agency_stamp_required';
    end if;
  end if;

  if (NEW.client_signature_path is not null and left(NEW.client_signature_path, length(prefix)) <> prefix)
     or (NEW.agency_signature_path is not null and left(NEW.agency_signature_path, length(prefix)) <> prefix) then
    raise exception 'invalid_signature_path';
  end if;

  if TG_OP = 'UPDATE' and (
       (OLD.client_signature_path is not null and NEW.client_signature_path is distinct from OLD.client_signature_path)
    or (OLD.agency_signature_path is not null and NEW.agency_signature_path is distinct from OLD.agency_signature_path)
    or (OLD.client_signed_at is not null and NEW.client_signed_at is distinct from OLD.client_signed_at)
  ) then
    raise exception 'contract_signature_locked';
  end if;

  return NEW;
end;
$$;
