-- M3ak — Étape 4 : réservations, disponibilité et tarification.
--
-- ⚠️ Exécutez d'abord 0013_rentals_status_enum.sql séparément (clic "Run" à
-- part) avant ce fichier — voir l'explication dans ce fichier-là. Si les
-- deux sont collés et lancés ensemble, l'étape "rentals_no_overlap"
-- ci-dessous échoue avec une erreur Postgres 55P04.
--
-- Choix documentés :
-- - "reservee" (ancien statut unique) est conservé pour les données déjà
--   créées, mais plus jamais attribué : toute nouvelle réservation démarre
--   en 'en_attente_confirmation' ou 'confirmee'.
-- - Seuls les statuts 'reservee', 'confirmee' et 'en_cours' bloquent la
--   disponibilité du véhicule. Un brouillon/une demande en attente n'empêche
--   PAS une autre réservation de chevaucher les mêmes dates — seule une
--   confirmation explicite réserve réellement le véhicule. C'est une règle
--   produit, pas une contrainte technique : elle évite qu'une simple demande
--   non confirmée bloque le planning indéfiniment.
-- - La protection contre les doubles réservations concurrentes est assurée
--   par une contrainte d'exclusion PostgreSQL (EXCLUDE ... USING gist), pas
--   seulement par une vérification applicative : deux transactions qui
--   essaient de réserver le même véhicule sur des dates qui se chevauchent
--   ne peuvent JAMAIS toutes les deux réussir, même si elles s'exécutent au
--   même instant (contrairement à un simple "SELECT puis INSERT" qui reste
--   vulnérable à une course concurrente).

create extension if not exists btree_gist;

create type public.rental_payment_status as enum ('non_paye', 'acompte_verse', 'paye_integralement');

-- ==================================================================
-- Enrichissement de la réservation
-- ==================================================================

alter table public.rentals
  add column numero text,
  add column driver_id uuid references public.drivers (id) on delete set null,
  add column branch_depart_id uuid references public.branches (id) on delete set null,
  add column branch_retour_id uuid references public.branches (id) on delete set null,
  add column lieu_depart text,
  add column lieu_retour text,
  add column duree_jours int,
  add column prix_jour_applique numeric(10, 2),
  add column sous_total numeric(10, 2),
  add column frais_supplementaires numeric(10, 2) not null default 0,
  add column remise_montant numeric(10, 2) not null default 0,
  add column devise text not null default 'MAD',
  add column acompte_prevu numeric(10, 2) not null default 0,
  add column acompte_paye numeric(10, 2) not null default 0,
  add column statut_paiement public.rental_payment_status not null default 'non_paye',
  add column notes text;

-- "updated_at" existe déjà depuis la migration 0001 ; seul le déclencheur qui
-- le tient à jour manquait (jusqu'ici personne ne le mettait à jour).
create trigger trg_rentals_updated_at
  before update on public.rentals
  for each row execute function public.set_updated_at();

-- ==================================================================
-- Identifiant lisible et unique (ex. RES-2026-00001). Une séquence globale
-- suffit à garantir l'unicité par entreprise (elle garantit même l'unicité
-- globale, plus forte que ce qui est demandé).
-- ==================================================================

create sequence public.rentals_numero_seq;

create or replace function public.set_rental_numero()
returns trigger
language plpgsql
as $$
begin
  if NEW.numero is null then
    NEW.numero := 'RES-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.rentals_numero_seq')::text, 5, '0');
  end if;
  return NEW;
end;
$$;

create trigger trg_rentals_numero
  before insert on public.rentals
  for each row execute function public.set_rental_numero();

create unique index rentals_numero_unique_idx on public.rentals (agency_id, numero);

-- ==================================================================
-- Un véhicule, un client, un conducteur ou une agence de retrait/retour ne
-- peuvent jamais appartenir à une autre entreprise que celle de la
-- réservation — vérifié ici, pas seulement supposé côté client.
-- ==================================================================

create or replace function public.validate_rental_references()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.vehicles v where v.id = NEW.vehicle_id and v.agency_id = NEW.agency_id) then
    raise exception 'vehicle_agency_mismatch';
  end if;

  if not exists (select 1 from public.customers c where c.id = NEW.customer_id and c.agency_id = NEW.agency_id) then
    raise exception 'customer_agency_mismatch';
  end if;

  if NEW.driver_id is not null and not exists (
    select 1 from public.drivers d where d.id = NEW.driver_id and d.agency_id = NEW.agency_id
  ) then
    raise exception 'driver_agency_mismatch';
  end if;

  if NEW.branch_depart_id is not null and not exists (
    select 1 from public.branches b where b.id = NEW.branch_depart_id and b.agency_id = NEW.agency_id
  ) then
    raise exception 'branch_depart_agency_mismatch';
  end if;

  if NEW.branch_retour_id is not null and not exists (
    select 1 from public.branches b where b.id = NEW.branch_retour_id and b.agency_id = NEW.agency_id
  ) then
    raise exception 'branch_retour_agency_mismatch';
  end if;

  return NEW;
end;
$$;

create trigger trg_validate_rental_references
  before insert or update on public.rentals
  for each row execute function public.validate_rental_references();

-- ==================================================================
-- Le prix est calculé et figé côté serveur, à partir des tarifs du véhicule
-- au moment de la réservation : le client ne peut jamais imposer un montant
-- (les champs envoyés par l'appelant pour duree_jours/prix_jour_applique/
-- sous_total/prix_total sont systématiquement écrasés). Un changement
-- ultérieur du tarif du véhicule ne modifie jamais une réservation déjà
-- créée (recalcul uniquement si les dates ou les frais/remise changent).
-- ==================================================================

create or replace function public.compute_rental_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jour numeric;
  v_semaine numeric;
  v_mois numeric;
  v_duree int;
  v_sous_total numeric;
  v_unites int;
  v_reste int;
  v_should_compute boolean;
begin
  if TG_OP = 'INSERT' then
    v_should_compute := true;
  else
    v_should_compute :=
      NEW.date_debut_prevue is distinct from OLD.date_debut_prevue
      or NEW.date_fin_prevue is distinct from OLD.date_fin_prevue
      or NEW.frais_supplementaires is distinct from OLD.frais_supplementaires
      or NEW.remise_montant is distinct from OLD.remise_montant;
  end if;

  if not v_should_compute then
    return NEW;
  end if;

  select prix_jour, prix_semaine, prix_mois into v_jour, v_semaine, v_mois
  from public.vehicles where id = NEW.vehicle_id;

  v_duree := greatest(1, ceil(extract(epoch from (NEW.date_fin_prevue - NEW.date_debut_prevue)) / 86400.0))::int;

  if v_mois is not null and v_duree >= 28 then
    v_unites := v_duree / 28;
    v_reste := v_duree % 28;
    v_sous_total := v_unites * v_mois + v_reste * v_jour;
  elsif v_semaine is not null and v_duree >= 7 then
    v_unites := v_duree / 7;
    v_reste := v_duree % 7;
    v_sous_total := v_unites * v_semaine + v_reste * v_jour;
  else
    v_sous_total := v_duree * v_jour;
  end if;

  NEW.duree_jours := v_duree;
  NEW.prix_jour_applique := round(v_sous_total / v_duree, 2);
  NEW.sous_total := round(v_sous_total, 2);
  NEW.prix_total := greatest(0, round(v_sous_total + coalesce(NEW.frais_supplementaires, 0) - coalesce(NEW.remise_montant, 0), 2));

  return NEW;
end;
$$;

create trigger trg_compute_rental_price
  before insert or update on public.rentals
  for each row execute function public.compute_rental_price();

-- ==================================================================
-- Transitions de statut validées côté serveur, indépendamment de l'appelant
-- (API, console SQL, ou futur outil). Une réservation annulée ou terminée
-- est définitive.
-- ==================================================================

create or replace function public.validate_rental_status_transition()
returns trigger
language plpgsql
as $$
begin
  if OLD.statut = NEW.statut then
    return NEW;
  end if;

  if OLD.statut in ('terminee', 'annulee') then
    raise exception 'rental_status_terminal: % -> %', OLD.statut, NEW.statut;
  end if;

  if OLD.statut in ('confirmee', 'reservee') and NEW.statut not in ('en_cours', 'annulee') then
    raise exception 'rental_status_invalid_transition: % -> %', OLD.statut, NEW.statut;
  end if;

  if OLD.statut = 'en_attente_confirmation' and NEW.statut not in ('confirmee', 'annulee') then
    raise exception 'rental_status_invalid_transition: % -> %', OLD.statut, NEW.statut;
  end if;

  if OLD.statut = 'en_cours' and NEW.statut <> 'terminee' then
    raise exception 'rental_status_invalid_transition: % -> %', OLD.statut, NEW.statut;
  end if;

  return NEW;
end;
$$;

create trigger trg_validate_rental_status_transition
  before update on public.rentals
  for each row execute function public.validate_rental_status_transition();

-- ==================================================================
-- Protection anti-double-réservation : contrainte d'exclusion PostgreSQL.
-- La borne de fin est exclusive ('[)') : deux réservations qui se touchent
-- exactement (retour à 18h, départ suivant à 18h) ne sont PAS en conflit.
-- ==================================================================

alter table public.rentals
  add column periode tstzrange generated always as (
    tstzrange(date_debut_prevue, date_fin_prevue, '[)')
  ) stored;

alter table public.rentals
  add constraint rentals_no_overlap
  exclude using gist (vehicle_id with =, periode with &&)
  where (statut in ('reservee', 'confirmee', 'en_cours'));

-- ==================================================================
-- Fonction de vérification de disponibilité, réutilisable depuis le client
-- (retour immédiat dans l'interface) — la garantie réelle reste la
-- contrainte d'exclusion ci-dessus, appliquée quoi qu'il arrive à l'écriture.
-- ==================================================================

create or replace function public.check_vehicle_availability(
  p_vehicle_id uuid,
  p_debut timestamptz,
  p_fin timestamptz,
  p_exclude_rental_id uuid default null
)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1 from public.rentals r
    where r.vehicle_id = p_vehicle_id
      and r.statut in ('reservee', 'confirmee', 'en_cours')
      and (p_exclude_rental_id is null or r.id <> p_exclude_rental_id)
      and tstzrange(r.date_debut_prevue, r.date_fin_prevue, '[)') && tstzrange(p_debut, p_fin, '[)')
  );
$$;

grant execute on function public.check_vehicle_availability(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ==================================================================
-- Conducteurs supplémentaires d'une réservation (au-delà du conducteur
-- principal). Même principe que pour les clients : on ne duplique jamais
-- les informations personnelles, on référence la table drivers existante.
-- ==================================================================

create table public.rental_additional_drivers (
  rental_id uuid not null references public.rentals (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  primary key (rental_id, driver_id)
);

create index rental_additional_drivers_rental_id_idx on public.rental_additional_drivers (rental_id);

alter table public.rental_additional_drivers enable row level security;

create policy "rental_additional_drivers_select" on public.rental_additional_drivers
  for select using (public.is_agency_member(agency_id));
create policy "rental_additional_drivers_insert" on public.rental_additional_drivers
  for insert with check (public.is_agency_member(agency_id));
create policy "rental_additional_drivers_delete" on public.rental_additional_drivers
  for delete using (public.is_agency_member(agency_id));
