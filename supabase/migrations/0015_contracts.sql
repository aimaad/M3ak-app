-- M3ak — Étape 5 : contrats de location, départ et retour.
--
-- Choix documentés :
-- - Le contrat enregistre un INSTANTANÉ des données contractuelles au moment
--   de sa création (nom du client, immatriculation, prix, caution…) : une
--   modification ultérieure du profil client ou du tarif du véhicule ne
--   réécrit jamais un contrat déjà établi.
-- - Signature : aucun service de signature électronique n'est configuré.
--   Le passage à "signe" est une action manuelle explicite (un membre
--   confirme qu'une signature papier/manuelle a eu lieu, horodatée et
--   attribuée à son auteur) — jamais automatique.
-- - PDF généré côté app (expo-print), pas via Edge Function : plus simple,
--   fonctionne dans Expo Go, aucune infrastructure serveur supplémentaire.
-- - Les photos et l'état des lieux par angle existent déjà (table
--   inspections / inspection_photos, étape 3) : le contrat s'appuie sur ces
--   inspections existantes plutôt que de dupliquer la capture photo. Seules
--   les informations propres au contrat (état général, accessoires,
--   observations, retard, frais proposés) sont ajoutées ici.

create type public.contract_status as enum (
  'preparation', 'pret_a_signer', 'signe', 'en_cours', 'cloture', 'annule'
);

create type public.vehicle_condition as enum ('bon', 'moyen', 'mauvais');

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  rental_id uuid not null references public.rentals (id) on delete cascade,
  numero text,
  statut public.contract_status not null default 'preparation',

  -- Instantané au moment de la création du contrat.
  customer_nom text not null,
  customer_telephone text,
  customer_cin text,
  driver_nom text,
  vehicle_immatriculation text not null,
  vehicle_marque text not null,
  vehicle_modele text not null,
  date_debut_prevue timestamptz not null,
  date_fin_prevue timestamptz not null,
  prix_total numeric(10, 2),
  caution_montant numeric(10, 2) not null default 0,

  conditions_particulieres text,
  notes text,

  signed_at timestamptz,
  signed_by uuid references auth.users (id),

  etat_depart public.vehicle_condition,
  accessoires_depart jsonb not null default '[]'::jsonb,
  observations_depart text,

  etat_retour public.vehicle_condition,
  accessoires_retour jsonb not null default '[]'::jsonb,
  observations_retour text,
  retard_minutes int,
  frais_retard_propose numeric(10, 2),
  frais_carburant_propose numeric(10, 2),
  frais_justification text,
  frais_appliques boolean not null default false,

  pdf_path text,

  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contracts_agency_id_idx on public.contracts (agency_id);
create index contracts_rental_id_idx on public.contracts (rental_id);

-- Un seul contrat actif (non annulé) par réservation.
create unique index contracts_one_active_per_rental_idx on public.contracts (rental_id) where (statut <> 'annule');

create trigger trg_contracts_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

-- ==================================================================
-- Référence lisible et unique (ex. CTR-2026-00001), même principe que pour
-- les réservations.
-- ==================================================================

create sequence public.contracts_numero_seq;

create or replace function public.set_contract_numero()
returns trigger
language plpgsql
as $$
begin
  if NEW.numero is null then
    NEW.numero := 'CTR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.contracts_numero_seq')::text, 5, '0');
  end if;
  return NEW;
end;
$$;

create trigger trg_contracts_numero
  before insert on public.contracts
  for each row execute function public.set_contract_numero();

create unique index contracts_numero_unique_idx on public.contracts (agency_id, numero);

-- ==================================================================
-- Le véhicule, le client et la réservation référencés doivent appartenir à
-- la même entreprise que le contrat.
-- ==================================================================

create or replace function public.validate_contract_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.rentals r where r.id = NEW.rental_id and r.agency_id = NEW.agency_id
  ) then
    raise exception 'rental_agency_mismatch';
  end if;

  return NEW;
end;
$$;

create trigger trg_validate_contract_references
  before insert or update on public.contracts
  for each row execute function public.validate_contract_references();

-- ==================================================================
-- Transitions de statut validées côté serveur.
-- preparation -> pret_a_signer -> signe -> en_cours -> cloture
-- annule atteignable depuis preparation / pret_a_signer / signe uniquement
-- (jamais depuis en_cours ou cloture : on ne défait pas une location déjà
-- commencée ou terminée).
-- ==================================================================

create or replace function public.validate_contract_status_transition()
returns trigger
language plpgsql
as $$
begin
  if OLD.statut = NEW.statut then
    return NEW;
  end if;

  if OLD.statut in ('cloture', 'annule') then
    raise exception 'contract_status_terminal: % -> %', OLD.statut, NEW.statut;
  end if;

  if OLD.statut = 'preparation' and NEW.statut not in ('pret_a_signer', 'annule') then
    raise exception 'contract_status_invalid_transition: % -> %', OLD.statut, NEW.statut;
  end if;

  if OLD.statut = 'pret_a_signer' and NEW.statut not in ('signe', 'annule') then
    raise exception 'contract_status_invalid_transition: % -> %', OLD.statut, NEW.statut;
  end if;

  if OLD.statut = 'signe' and NEW.statut not in ('en_cours', 'annule') then
    raise exception 'contract_status_invalid_transition: % -> %', OLD.statut, NEW.statut;
  end if;

  if OLD.statut = 'en_cours' and NEW.statut <> 'cloture' then
    raise exception 'contract_status_invalid_transition: % -> %', OLD.statut, NEW.statut;
  end if;

  return NEW;
end;
$$;

create trigger trg_validate_contract_status_transition
  before update on public.contracts
  for each row execute function public.validate_contract_status_transition();

-- Le passage à "signe" doit toujours être accompagné d'une preuve (horodatage + auteur).
create or replace function public.require_signature_proof()
returns trigger
language plpgsql
as $$
begin
  if NEW.statut = 'signe' and (NEW.signed_at is null or NEW.signed_by is null) then
    raise exception 'contract_signature_proof_required';
  end if;
  return NEW;
end;
$$;

create trigger trg_require_signature_proof
  before insert or update on public.contracts
  for each row execute function public.require_signature_proof();

alter table public.contracts enable row level security;

create policy "contracts_select" on public.contracts
  for select using (public.is_agency_member(agency_id));
create policy "contracts_insert" on public.contracts
  for insert with check (public.is_agency_member(agency_id));
create policy "contracts_update" on public.contracts
  for update using (public.is_agency_member(agency_id));
create policy "contracts_delete" on public.contracts
  for delete using (public.is_agency_manager(agency_id));

-- ==================================================================
-- Stockage privé des PDF de contrat.
-- ==================================================================

insert into storage.buckets (id, name, public)
values ('contract-pdfs', 'contract-pdfs', false)
on conflict (id) do nothing;

create policy "contract_pdfs_select" on storage.objects
  for select using (
    bucket_id = 'contract-pdfs'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "contract_pdfs_insert" on storage.objects
  for insert with check (
    bucket_id = 'contract-pdfs'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "contract_pdfs_update" on storage.objects
  for update using (
    bucket_id = 'contract-pdfs'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "contract_pdfs_delete" on storage.objects
  for delete using (
    bucket_id = 'contract-pdfs'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );

-- ==================================================================
-- Départ et retour comme opérations atomiques : rental + véhicule + contrat
-- mis à jour ensemble dans une seule transaction (une fonction Postgres
-- s'exécute entièrement ou pas du tout). SECURITY INVOKER (par défaut) :
-- les mises à jour internes restent soumises aux RLS de l'appelant, aucune
-- élévation de privilège. Chaque fonction vérifie elle-même l'état de
-- départ attendu — ça empêche un double départ ou un double retour même si
-- le déclencheur générique de transition laisse passer un statut inchangé.
-- ==================================================================

create or replace function public.start_rental_with_contract(
  p_rental_id uuid,
  p_contract_id uuid,
  p_km_depart int,
  p_carburant_depart int,
  p_etat_depart public.vehicle_condition,
  p_accessoires_depart jsonb,
  p_observations_depart text
)
returns void
language plpgsql
as $$
declare
  v_rental record;
  v_contract record;
begin
  select id, vehicle_id, statut into v_rental from public.rentals where id = p_rental_id;
  if v_rental is null then
    raise exception 'rental_not_found';
  end if;
  if v_rental.statut not in ('confirmee', 'reservee') then
    raise exception 'rental_departure_already_recorded_or_invalid_state: %', v_rental.statut;
  end if;

  select id, statut into v_contract from public.contracts where id = p_contract_id and rental_id = p_rental_id;
  if v_contract is null then
    raise exception 'contract_not_found_for_rental';
  end if;
  if v_contract.statut <> 'signe' then
    raise exception 'contract_not_signed: %', v_contract.statut;
  end if;

  update public.rentals
  set statut = 'en_cours', date_depart_reel = now(), km_depart = p_km_depart, carburant_depart = p_carburant_depart
  where id = p_rental_id;

  update public.vehicles
  set statut = 'en_location', kilometrage = p_km_depart
  where id = v_rental.vehicle_id;

  update public.contracts
  set statut = 'en_cours', etat_depart = p_etat_depart, accessoires_depart = p_accessoires_depart, observations_depart = p_observations_depart
  where id = p_contract_id;
end;
$$;

grant execute on function public.start_rental_with_contract(uuid, uuid, int, int, public.vehicle_condition, jsonb, text) to authenticated;

create or replace function public.complete_rental_with_contract(
  p_rental_id uuid,
  p_contract_id uuid,
  p_km_retour int,
  p_carburant_retour int,
  p_etat_retour public.vehicle_condition,
  p_accessoires_retour jsonb,
  p_observations_retour text,
  p_retard_minutes int,
  p_frais_retard_propose numeric,
  p_frais_carburant_propose numeric,
  p_frais_justification text,
  p_appliquer_frais boolean
)
returns void
language plpgsql
as $$
declare
  v_rental record;
  v_contract record;
  v_vehicle_statut public.vehicle_status;
begin
  select id, vehicle_id, statut, frais_supplementaires into v_rental from public.rentals where id = p_rental_id;
  if v_rental is null then
    raise exception 'rental_not_found';
  end if;
  if v_rental.statut <> 'en_cours' then
    raise exception 'rental_return_already_recorded_or_invalid_state: %', v_rental.statut;
  end if;

  select id, statut into v_contract from public.contracts where id = p_contract_id and rental_id = p_rental_id;
  if v_contract is null then
    raise exception 'contract_not_found_for_rental';
  end if;
  if v_contract.statut <> 'en_cours' then
    raise exception 'contract_not_in_progress: %', v_contract.statut;
  end if;

  update public.rentals
  set
    statut = 'terminee',
    date_retour_reel = now(),
    km_retour = p_km_retour,
    carburant_retour = p_carburant_retour,
    frais_supplementaires = case
      when p_appliquer_frais then coalesce(v_rental.frais_supplementaires, 0) + coalesce(p_frais_retard_propose, 0) + coalesce(p_frais_carburant_propose, 0)
      else v_rental.frais_supplementaires
    end
  where id = p_rental_id;

  -- Ne jamais écraser un véhicule déjà en maintenance/indisponible : le
  -- retour ne doit pas le rendre "disponible" ou "à inspecter" par-dessus
  -- une immobilisation déjà en place.
  select statut into v_vehicle_statut from public.vehicles where id = v_rental.vehicle_id;
  if v_vehicle_statut not in ('maintenance', 'indisponible') then
    update public.vehicles set statut = 'a_inspecter', kilometrage = p_km_retour where id = v_rental.vehicle_id;
  else
    update public.vehicles set kilometrage = p_km_retour where id = v_rental.vehicle_id;
  end if;

  update public.contracts
  set
    statut = 'cloture',
    etat_retour = p_etat_retour,
    accessoires_retour = p_accessoires_retour,
    observations_retour = p_observations_retour,
    retard_minutes = p_retard_minutes,
    frais_retard_propose = p_frais_retard_propose,
    frais_carburant_propose = p_frais_carburant_propose,
    frais_justification = p_frais_justification,
    frais_appliques = p_appliquer_frais
  where id = p_contract_id;
end;
$$;

grant execute on function public.complete_rental_with_contract(uuid, uuid, int, int, public.vehicle_condition, jsonb, text, int, numeric, numeric, text, boolean) to authenticated;
