-- M3ak — Étape 3 : module complet de gestion des clients et des conducteurs.

create type public.customer_type as enum ('particulier', 'entreprise');
create type public.preferred_language as enum ('fr', 'ar', 'darija');

-- ==================================================================
-- Fonction générique pour tenir "updated_at" à jour (réutilisable plus tard).
-- ==================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==================================================================
-- Enrichissement de la fiche client
-- ==================================================================

alter table public.customers
  add column prenom text,
  add column nom text,
  add column telephone_secondaire text,
  add column adresse text,
  add column ville text,
  add column pays text not null default 'Maroc',
  add column date_naissance date,
  add column langue_preferee public.preferred_language,
  add column type_client public.customer_type not null default 'particulier',
  add column raison_sociale text,
  add column ice text,
  add column notes text,
  add column archived_at timestamptz,
  add column updated_at timestamptz not null default now();

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create index customers_archived_at_idx on public.customers (agency_id, archived_at);

-- ==================================================================
-- Comme pour les véhicules : l'archivage remplace la suppression
-- définitive et doit rester réservé à owner/manager, quel que soit le
-- chemin d'appel (pas seulement un bouton caché côté UI).
-- ==================================================================

create or replace function public.restrict_customer_archive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (OLD.archived_at is distinct from NEW.archived_at) and not public.is_agency_manager(NEW.agency_id) then
    raise exception 'archive_requires_manager';
  end if;
  return NEW;
end;
$$;

create trigger trg_restrict_customer_archive
  before update on public.customers
  for each row execute function public.restrict_customer_archive();

-- Les documents clients (jsonb) peuvent désormais porter une référence, des
-- dates de délivrance/expiration et l'utilisateur qui les a ajoutés ; les
-- entrées existantes sont traitées comme "sans métadonnée connue" (absente = null).

-- ==================================================================
-- Conducteurs supplémentaires : rattachés à un client, pour un futur lien
-- avec les contrats de location (table rentals, à ajouter plus tard sans
-- toucher à ce modèle).
-- ==================================================================

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  nom_complet text not null,
  cin_ou_passeport text,
  numero_permis text,
  telephone text,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index drivers_customer_id_idx on public.drivers (customer_id);
create index drivers_agency_id_idx on public.drivers (agency_id);

create trigger trg_drivers_updated_at
  before update on public.drivers
  for each row execute function public.set_updated_at();

alter table public.drivers enable row level security;

create policy "drivers_select" on public.drivers
  for select using (public.is_agency_member(agency_id));
create policy "drivers_insert" on public.drivers
  for insert with check (public.is_agency_member(agency_id));
create policy "drivers_update" on public.drivers
  for update using (public.is_agency_member(agency_id));
create policy "drivers_delete" on public.drivers
  for delete using (public.is_agency_manager(agency_id));
