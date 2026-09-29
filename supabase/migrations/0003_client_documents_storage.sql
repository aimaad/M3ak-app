-- M3ak — bucket de stockage pour les documents clients (CIN, permis)
-- Chemin des fichiers : client-documents/{agency_id}/{customer_id}/{fichier}
-- Le bucket est privé : la lecture passe par une URL signée générée côté app.

insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do nothing;

create policy "client_documents_select" on storage.objects
  for select using (
    bucket_id = 'client-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "client_documents_insert" on storage.objects
  for insert with check (
    bucket_id = 'client-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "client_documents_update" on storage.objects
  for update using (
    bucket_id = 'client-documents'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "client_documents_delete" on storage.objects
  for delete using (
    bucket_id = 'client-documents'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );
