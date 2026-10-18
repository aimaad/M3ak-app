-- M3ak — (1) prénom et nom séparés pour les conducteurs (contrat) ; (2) le logo de l'agence est obligatoire pour signer.

alter table public.drivers
  add column if not exists prenom text,
  add column if not exists nom text;

-- Le conducteur lié à une fiche client reprend le prénom et le nom de ce client.
create or replace function public.ensure_customer_driver(p_customer_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_customer record;
  v_id uuid;
begin
  select id, agency_id, nom_complet, prenom, nom, cin_ou_passeport, numero_permis, telephone
  into v_customer
  from public.customers where id = p_customer_id;

  if v_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  select id into v_id from public.drivers
  where agency_id = v_customer.agency_id and linked_customer_id = p_customer_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.drivers
    (agency_id, customer_id, linked_customer_id, nom_complet, prenom, nom, cin_ou_passeport, numero_permis, telephone)
  values
    (v_customer.agency_id, p_customer_id, p_customer_id, v_customer.nom_complet, v_customer.prenom, v_customer.nom,
     v_customer.cin_ou_passeport, v_customer.numero_permis, v_customer.telephone)
  on conflict (agency_id, linked_customer_id) where linked_customer_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.drivers
    where agency_id = v_customer.agency_id and linked_customer_id = p_customer_id;
  end if;
  return v_id;
end;
$$;

update public.drivers d
set prenom = c.prenom, nom = c.nom
from public.customers c
where d.linked_customer_id = c.id and d.prenom is null and d.nom is null;

-- Signature d'un contrat : cachet ET logo de l'agence obligatoires (en plus de la signature du client).
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
