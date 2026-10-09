-- M3ak — documents véhicule (carte grise, assurance, visite technique).
-- Même principe que les documents clients : bucket privé, une seule photo par
-- type (upsert sur reprise), chemin {agency_id}/{vehicle_id}/{type}-{timestamp}.jpg

alter table public.vehicles add column documents jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do nothing;

create policy "vehicle_documents_storage_select" on storage.objects
  for select using (
    bucket_id = 'vehicle-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "vehicle_documents_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'vehicle-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "vehicle_documents_storage_update" on storage.objects
  for update using (
    bucket_id = 'vehicle-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "vehicle_documents_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'vehicle-documents'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );
