-- M3ak — bucket de stockage pour les photos d'inspection (départ / retour)
-- Chemin des fichiers : inspection-photos/{agency_id}/{inspection_id}/{angle}.jpg
-- Le bucket est privé : la lecture passe par une URL signée générée côté app.

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;

create policy "inspection_photos_storage_select" on storage.objects
  for select using (
    bucket_id = 'inspection-photos'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "inspection_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'inspection-photos'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "inspection_photos_storage_update" on storage.objects
  for update using (
    bucket_id = 'inspection-photos'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "inspection_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'inspection-photos'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );
