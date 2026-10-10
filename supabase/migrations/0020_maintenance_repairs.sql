-- M3ak — chantier B (maintenance) : réparations, pannes et immobilisation.
-- Doit être exécuté APRÈS 0019 (séparé pour la même raison que 0013/0014 —
-- voir le commentaire dans 0019).

alter table public.maintenance_items
  add column garage text,
  add column cout numeric(10, 2),
  add column pieces_remplacees text,
  add column facture_path text,
  add column date_intervention date;

create trigger trg_maintenance_items_updated_at
  before update on public.maintenance_items
  for each row execute function public.set_updated_at();

-- ==================================================================
-- Stockage des factures de maintenance (même principe que les documents
-- client/véhicule : bucket privé, accès limité aux membres de l'agence).
-- ==================================================================

insert into storage.buckets (id, name, public)
values ('maintenance-documents', 'maintenance-documents', false)
on conflict (id) do nothing;

create policy "maintenance_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'maintenance-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "maintenance_documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'maintenance-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "maintenance_documents_storage_update" on storage.objects
  for update using (
    bucket_id = 'maintenance-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "maintenance_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'maintenance-documents'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );

-- ==================================================================
-- Immobilisation automatique du véhicule pendant une intervention.
-- Passage d'un item de maintenance à "en_cours" => véhicule mis en
-- "maintenance" (sauf s'il est loué ou en attente d'inspection, cas où le
-- module locations garde la main sur le statut). Sortie de "en_cours" =>
-- le véhicule redevient "disponible", mais seulement s'il n'y a plus
-- aucune autre intervention "en_cours" sur ce même véhicule, et seulement
-- si son statut est toujours "maintenance" (ne touche pas à un statut
-- changé manuellement entre-temps, ex. "indisponible").
-- ==================================================================

create or replace function public.sync_vehicle_status_with_maintenance()
returns trigger
language plpgsql
as $$
begin
  if NEW.statut = 'en_cours' and (TG_OP = 'INSERT' or OLD.statut is distinct from 'en_cours') then
    update public.vehicles
      set statut = 'maintenance'
      where id = NEW.vehicle_id and statut not in ('en_location', 'a_inspecter');
  elsif TG_OP = 'UPDATE' and OLD.statut = 'en_cours' and NEW.statut is distinct from 'en_cours' then
    if not exists (
      select 1 from public.maintenance_items
      where vehicle_id = NEW.vehicle_id and statut = 'en_cours' and id <> NEW.id
    ) then
      update public.vehicles
        set statut = 'disponible'
        where id = NEW.vehicle_id and statut = 'maintenance';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger trg_maintenance_sync_vehicle_status
  after insert or update of statut on public.maintenance_items
  for each row execute function public.sync_vehicle_status_with_maintenance();
