-- M3ak — Étape 2 : module complet de gestion du parc automobile.
-- Enrichit la fiche véhicule (caractéristiques, tarification, photos,
-- échéances de documents, archivage) sans toucher aux statuts déjà pilotés
-- par le module locations (en_location / a_inspecter restent inchangés).

create type public.vehicle_category as enum (
  'economique', 'compacte', 'berline', 'suv', 'utilitaire', 'minibus', 'luxe'
);

create type public.vehicle_transmission as enum ('manuelle', 'automatique');

-- Nouveaux statuts manuels (en plus de disponible/en_location/maintenance/a_inspecter
-- déjà utilisés par la flotte et le module locations).
alter type public.vehicle_status add value if not exists 'en_preparation';
alter type public.vehicle_status add value if not exists 'indisponible';

alter table public.vehicles
  add column categorie public.vehicle_category,
  add column couleur text,
  add column nombre_places int,
  add column transmission public.vehicle_transmission,
  add column niveau_carburant int,
  add column prix_semaine numeric(10, 2),
  add column prix_mois numeric(10, 2),
  add column description text,
  add column photos jsonb not null default '[]'::jsonb,
  add column archived_at timestamptz,
  add constraint vehicles_nombre_places_check check (nombre_places is null or (nombre_places between 1 and 9)),
  add constraint vehicles_niveau_carburant_check check (niveau_carburant is null or (niveau_carburant between 0 and 100));

-- Les documents véhicule (jsonb) peuvent désormais porter une date d'expiration ;
-- aucune migration de données n'est nécessaire, les entrées existantes sont
-- simplement traitées comme "sans échéance connue" (expiresAt absent = null).

create index vehicles_archived_at_idx on public.vehicles (agency_id, archived_at);

-- ==================================================================
-- L'archivage (et la réactivation) remplace la suppression définitive et
-- doit rester réservé à owner/manager, comme la suppression — quel que soit
-- le chemin d'appel (y compris un appel REST direct qui contournerait l'UI).
-- ==================================================================

create or replace function public.restrict_vehicle_archive()
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

drop trigger if exists trg_restrict_vehicle_archive on public.vehicles;
create trigger trg_restrict_vehicle_archive
  before update on public.vehicles
  for each row execute function public.restrict_vehicle_archive();

-- ==================================================================
-- Bucket pour les photos générales du véhicule (galerie), séparé des
-- documents administratifs. Même principe de permissions que
-- vehicle-documents : lecture/ajout pour tout membre, suppression réservée
-- à owner/manager.
-- ==================================================================

insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', false)
on conflict (id) do nothing;

create policy "vehicle_photos_storage_select" on storage.objects
  for select using (
    bucket_id = 'vehicle-photos'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "vehicle_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'vehicle-photos'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "vehicle_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'vehicle-photos'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );
