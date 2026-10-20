-- M3ak — exigences de création décidées par le PROPRIÉTAIRE de l'agence.
--
-- 1) require_id_at_rental (défaut : non) : la location exige que le client ait un CIN ou un passeport enregistré
--    (numéro sur la fiche, ou document « CIN » / « passeport » dans son dossier). Appliqué par le serveur à la création
--    d'une location, pas seulement par l'écran.
-- 2) require_licence_at_customer (défaut : oui, comme avant) : la création d'un client particulier exige son permis
--    (recto, verso, numéro, date d'expiration). Appliqué par l'écran ; le propriétaire peut le désactiver.
-- Rien n'est supprimé ; les agences existantes gardent leur comportement actuel.

alter table public.agency_departure_policies
  add column if not exists require_id_at_rental boolean not null default false,
  add column if not exists require_licence_at_customer boolean not null default true;

create or replace function public.get_departure_policy(p_agency_id uuid)
returns public.agency_departure_policies
language plpgsql
stable
set search_path = public
as $$
declare
  v_policy public.agency_departure_policies;
begin
  select * into v_policy from public.agency_departure_policies where agency_id = p_agency_id;
  if v_policy.agency_id is null then
    v_policy.agency_id := p_agency_id;
    v_policy.block_departure := false;
    v_policy.require_customer_id_document := true;
    v_policy.require_driver_licence := true;
    v_policy.require_licence_valid_until_end := true;
    v_policy.require_manual_confirmation := true;
    v_policy.confirmation_role := 'employee';
    v_policy.max_additional_drivers := 3;
    v_policy.require_id_at_rental := false;
    v_policy.require_licence_at_customer := true;
  end if;
  return v_policy;
end;
$$;

-- Création d'une location : si le propriétaire l'exige, le client doit avoir un CIN ou un passeport.
create or replace function public.require_customer_identity_for_rental()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_required boolean;
begin
  select coalesce((select require_id_at_rental from public.agency_departure_policies where agency_id = NEW.agency_id), false)
    into v_required;
  if not v_required then
    return NEW;
  end if;

  if exists (
    select 1 from public.customers c
    where c.id = NEW.customer_id and nullif(btrim(coalesce(c.cin_ou_passeport, '')), '') is not null
  ) or exists (
    select 1 from public.customer_documents d
    where d.customer_id = NEW.customer_id
      and d.deleted_at is null
      and d.doc_type in ('cin', 'passeport')
      and (nullif(btrim(coalesce(d.reference, '')), '') is not null or d.file_path is not null)
  ) then
    return NEW;
  end if;

  raise exception 'customer_id_required';
end;
$$;

drop trigger if exists trg_require_customer_identity_for_rental on public.rentals;
create trigger trg_require_customer_identity_for_rental
  before insert on public.rentals
  for each row execute function public.require_customer_identity_for_rental();
