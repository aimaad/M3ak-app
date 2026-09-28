-- M3ak — schéma initial (Étape 0)
-- Modèle de données décrit dans docs/ARCHITECTURE.md

create extension if not exists pgcrypto;

-- ==================================================================
-- Types énumérés
-- ==================================================================

create type public.agency_role as enum ('owner', 'manager', 'employee');
create type public.agency_plan as enum ('trial', 'starter', 'pro', 'business');

create type public.vehicle_status as enum ('disponible', 'en_location', 'maintenance', 'a_inspecter');
create type public.fuel_type as enum ('essence', 'diesel', 'hybride', 'electrique');

create type public.rental_status as enum (
  'reservee', 'en_cours', 'terminee', 'annulee'
);

create type public.inspection_type as enum ('depart', 'retour');
create type public.inspection_status as enum ('en_cours', 'terminee', 'validee');
create type public.photo_angle as enum (
  'avant', 'arriere', 'lateral_gauche', 'lateral_droit',
  'jante_avant_gauche', 'jante_avant_droit', 'jante_arriere_gauche', 'jante_arriere_droit',
  'interieur', 'tableau_de_bord', 'autre'
);

create type public.damage_zone as enum (
  'pare_choc_avant', 'pare_choc_arriere', 'capot', 'toit', 'coffre',
  'aile_avant_gauche', 'aile_avant_droit', 'aile_arriere_gauche', 'aile_arriere_droit',
  'portiere_avant_gauche', 'portiere_avant_droit', 'portiere_arriere_gauche', 'portiere_arriere_droit',
  'pare_brise', 'vitre', 'retroviseur_gauche', 'retroviseur_droit',
  'jante_avant_gauche', 'jante_avant_droit', 'jante_arriere_gauche', 'jante_arriere_droit',
  'interieur', 'autre'
);
create type public.damage_type as enum ('rayure', 'choc', 'bosse', 'fissure', 'piece_manquante', 'salissure', 'autre');
create type public.damage_severity as enum ('leger', 'modere', 'grave');

create type public.maintenance_type as enum ('vidange', 'assurance', 'visite_technique', 'freins', 'pneus', 'autre');
create type public.maintenance_status as enum ('a_venir', 'due', 'en_retard', 'effectuee');

create type public.payment_method as enum ('especes', 'carte', 'virement', 'cheque');
create type public.payment_status as enum ('en_attente', 'paye', 'echoue', 'rembourse');
create type public.deposit_status as enum ('bloquee', 'partiellement_retenue', 'retenue', 'restituee');

-- ==================================================================
-- Agences et membres
-- ==================================================================

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ville text,
  plan public.agency_plan not null default 'trial',
  created_at timestamptz not null default now()
);

create table public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.agency_role not null default 'employee',
  nom_complet text,
  telephone text,
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  nom text not null,
  ville text,
  adresse text,
  created_at timestamptz not null default now()
);

-- ==================================================================
-- Flotte et clients
-- ==================================================================

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  immatriculation text not null,
  marque text not null,
  modele text not null,
  annee int,
  carburant public.fuel_type not null default 'essence',
  kilometrage int not null default 0,
  statut public.vehicle_status not null default 'disponible',
  prix_jour numeric(10, 2) not null default 0,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, immatriculation)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  nom_complet text not null,
  cin_ou_passeport text,
  numero_permis text,
  telephone text,
  email text,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ==================================================================
-- Réservations et locations
-- ==================================================================

create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  customer_id uuid not null references public.customers (id) on delete restrict,
  statut public.rental_status not null default 'reservee',
  date_debut_prevue timestamptz not null,
  date_fin_prevue timestamptz not null,
  date_depart_reel timestamptz,
  date_retour_reel timestamptz,
  km_depart int,
  km_retour int,
  carburant_depart int,
  carburant_retour int,
  prix_total numeric(10, 2),
  caution_montant numeric(10, 2) not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  montant_bloque numeric(10, 2) not null default 0,
  montant_retenu numeric(10, 2) not null default 0,
  montant_restitue numeric(10, 2) not null default 0,
  statut public.deposit_status not null default 'bloquee',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==================================================================
-- Inspections et dommages (fonctionnalité phare)
-- ==================================================================

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  rental_id uuid not null references public.rentals (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  type public.inspection_type not null,
  statut public.inspection_status not null default 'en_cours',
  employee_id uuid references auth.users (id),
  date_inspection timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  angle public.photo_angle not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table public.damages (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  photo_id uuid references public.inspection_photos (id) on delete set null,
  zone public.damage_zone not null,
  type public.damage_type not null,
  gravite public.damage_severity not null default 'leger',
  confiance numeric(4, 3),
  nouveau boolean not null default true,
  cout_estime numeric(10, 2),
  bbox jsonb,
  valide_par_employe boolean not null default false,
  created_at timestamptz not null default now()
);

-- ==================================================================
-- Maintenance
-- ==================================================================

create table public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  type public.maintenance_type not null,
  echeance_date date,
  echeance_km int,
  statut public.maintenance_status not null default 'a_venir',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==================================================================
-- Paiements et factures
-- ==================================================================

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  rental_id uuid not null references public.rentals (id) on delete cascade,
  montant numeric(10, 2) not null,
  methode public.payment_method not null default 'especes',
  statut public.payment_status not null default 'en_attente',
  date_paiement timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  rental_id uuid not null references public.rentals (id) on delete cascade,
  numero text not null,
  montant numeric(10, 2) not null,
  statut public.payment_status not null default 'en_attente',
  pdf_url text,
  created_at timestamptz not null default now(),
  unique (agency_id, numero)
);

-- ==================================================================
-- Chat M3ak (assistant IA)
-- ==================================================================

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  reponse text,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ==================================================================
-- Index utiles
-- ==================================================================

create index vehicles_agency_id_idx on public.vehicles (agency_id);
create index vehicles_statut_idx on public.vehicles (agency_id, statut);
create index customers_agency_id_idx on public.customers (agency_id);
create index rentals_agency_id_idx on public.rentals (agency_id);
create index rentals_vehicle_id_idx on public.rentals (vehicle_id);
create index rentals_customer_id_idx on public.rentals (customer_id);
create index rentals_statut_idx on public.rentals (agency_id, statut);
create index inspections_rental_id_idx on public.inspections (rental_id);
create index inspection_photos_inspection_id_idx on public.inspection_photos (inspection_id);
create index damages_inspection_id_idx on public.damages (inspection_id);
create index maintenance_items_agency_id_idx on public.maintenance_items (agency_id);
create index maintenance_items_echeance_idx on public.maintenance_items (agency_id, statut, echeance_date);
create index payments_rental_id_idx on public.payments (rental_id);
create index chat_messages_agency_id_idx on public.chat_messages (agency_id, created_at desc);
create index agency_members_user_id_idx on public.agency_members (user_id);
