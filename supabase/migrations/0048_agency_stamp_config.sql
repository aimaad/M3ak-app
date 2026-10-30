-- M3ak — cachet de l'agence généré (vrai tampon dessiné : rond, rectangulaire ou ovale).
--
-- La configuration du cachet (forme, couleur, nom, lignes, ville) est enregistrée sur l'agence ; M3ak en dessine le
-- tampon (SVG) sur le contrat. La photo d'un cachet physique (stamp_path) reste possible. Pour signer un contrat, il
-- faut l'un OU l'autre. Rien n'est supprimé : les agences qui ont déjà une photo de cachet ne changent pas.

alter table public.agencies add column if not exists stamp_config jsonb;

alter table public.agencies drop constraint if exists agencies_stamp_config_check;
alter table public.agencies
  add constraint agencies_stamp_config_check
  check (stamp_config is null or (jsonb_typeof(stamp_config) = 'object' and pg_column_size(stamp_config) <= 2000));

-- Signature d'un contrat : cachet (photo OU cachet généré) et logo de l'agence obligatoires, en plus de la signature du client.
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
    if not exists (
      select 1 from public.agencies a
      where a.id = NEW.agency_id and (a.stamp_path is not null or a.stamp_config is not null)
    ) then
      raise exception 'contract_agency_stamp_required';
    end if;
    if not exists (select 1 from public.agencies a where a.id = NEW.agency_id and a.logo_url is not null) then
      raise exception 'contract_agency_logo_required';
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
