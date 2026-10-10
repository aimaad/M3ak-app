-- M3ak — Phase de stabilisation : corrige une usurpation de signature trouvée
-- lors de l'audit. Le déclencheur require_signature_proof (migration 0015)
-- vérifiait seulement que signed_at/signed_by étaient renseignés, pas que
-- signed_by correspondait réellement à l'auteur de l'action : n'importe quel
-- membre pouvait donc signer "au nom" d'un autre utilisateur de l'agence
-- (ex. un employé attribuant la signature au propriétaire). Reproduit et
-- vérifié via scripts/signature-spoof-check.mjs contre une instance locale.

create or replace function public.require_signature_proof()
returns trigger
language plpgsql
as $$
begin
  if NEW.statut = 'signe' and (NEW.signed_at is null or NEW.signed_by is null) then
    raise exception 'contract_signature_proof_required';
  end if;

  if NEW.signed_by is not null and NEW.signed_by is distinct from auth.uid() then
    raise exception 'signed_by_must_be_caller';
  end if;

  return NEW;
end;
$$;
