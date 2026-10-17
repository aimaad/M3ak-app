-- M3ak — signatures manuscrites : celle de chaque membre (profil) et celle du client (contrat).
-- Une signature est un petit fichier JSON de tracés (pas d'image, pas de script) dans un bucket PRIVÉ.
--   {agence}/staff/{utilisateur}.json              signature du membre (modifiable par lui seul)
--   {agence}/contracts/{contrat}/client-….json     signature du client, copie figée à la signature
--   {agence}/contracts/{contrat}/agence-….json     copie figée de la signature du membre au moment de la signature
-- Les copies d'un contrat sont ajoutées une fois et ne sont jamais modifiées ni supprimées (preuve).

alter table public.agency_members add column if not exists signature_path text;

alter table public.contracts
  add column if not exists client_signature_path text,
  add column if not exists agency_signature_path text,
  add column if not exists client_signed_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('signatures', 'signatures', false, 200 * 1024, array['application/json'])
on conflict (id) do update
  set public = false, file_size_limit = 200 * 1024, allowed_mime_types = array['application/json'];

drop policy if exists "signatures_select" on storage.objects;
create policy "signatures_select" on storage.objects
  for select using (
    bucket_id = 'signatures'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "signatures_insert" on storage.objects;
create policy "signatures_insert" on storage.objects
  for insert with check (
    bucket_id = 'signatures'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
    and (
      ((storage.foldername(name))[2] = 'staff' and storage.filename(name) = auth.uid()::text || '.json')
      or (storage.foldername(name))[2] = 'contracts'
    )
  );

-- Seule la signature personnelle peut être remplacée ou retirée ; celles des contrats sont définitives.
drop policy if exists "signatures_update" on storage.objects;
create policy "signatures_update" on storage.objects
  for update using (
    bucket_id = 'signatures'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
    and (storage.foldername(name))[2] = 'staff'
    and storage.filename(name) = auth.uid()::text || '.json'
  );

drop policy if exists "signatures_delete" on storage.objects;
create policy "signatures_delete" on storage.objects
  for delete using (
    bucket_id = 'signatures'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
    and (storage.foldername(name))[2] = 'staff'
    and storage.filename(name) = auth.uid()::text || '.json'
  );

-- Un membre ne peut référencer que SON fichier de signature.
create or replace function public.check_member_signature_path()
returns trigger
language plpgsql
as $$
begin
  if NEW.signature_path is not null
     and NEW.signature_path is distinct from OLD.signature_path
     and NEW.signature_path <> NEW.agency_id::text || '/staff/' || NEW.user_id::text || '.json' then
    raise exception 'invalid_signature_path';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_check_member_signature_path on public.agency_members;
create trigger trg_check_member_signature_path
  before update on public.agency_members
  for each row execute function public.check_member_signature_path();

-- Contrat : le passage à « signé » exige la signature du client ; les fichiers doivent appartenir à CE contrat ;
-- une fois posées, les signatures ne changent plus.
create or replace function public.require_signature_proof()
returns trigger
language plpgsql
as $$
declare
  prefix text := NEW.agency_id::text || '/contracts/' || NEW.id::text || '/';
begin
  if NEW.statut = 'signe' and (NEW.signed_at is null or NEW.signed_by is null) then
    raise exception 'contract_signature_proof_required';
  end if;

  if TG_OP = 'UPDATE' and OLD.statut is distinct from 'signe' and NEW.statut = 'signe' and NEW.client_signature_path is null then
    raise exception 'contract_client_signature_required';
  end if;

  if (NEW.client_signature_path is not null and left(NEW.client_signature_path, length(prefix)) <> prefix)
     or (NEW.agency_signature_path is not null and left(NEW.agency_signature_path, length(prefix)) <> prefix) then
    raise exception 'invalid_signature_path';
  end if;

  if TG_OP = 'UPDATE' and (
       (OLD.client_signature_path is not null and NEW.client_signature_path is distinct from OLD.client_signature_path)
    or (OLD.agency_signature_path is not null and NEW.agency_signature_path is distinct from OLD.agency_signature_path)
    or (OLD.client_signed_at is not null and NEW.client_signed_at is distinct from OLD.client_signed_at)
  ) then
    raise exception 'contract_signature_locked';
  end if;

  return NEW;
end;
$$;
