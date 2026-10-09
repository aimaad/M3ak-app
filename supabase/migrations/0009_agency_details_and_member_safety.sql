-- M3ak — fiche entreprise complète + protection du dernier propriétaire.

-- ==================================================================
-- Champs entreprise supplémentaires
-- ==================================================================

alter table public.agencies
  add column raison_sociale text,
  add column email text,
  add column telephone text,
  add column adresse text,
  add column pays text not null default 'Maroc',
  add column devise text not null default 'MAD',
  add column logo_url text;

-- ==================================================================
-- Protection : impossible de supprimer ou rétrograder le dernier owner
-- d'une agence (contrôle serveur, indépendant du client).
-- ==================================================================

create or replace function public.prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'DELETE' and OLD.role = 'owner')
     or (TG_OP = 'UPDATE' and OLD.role = 'owner' and NEW.role <> 'owner') then
    if (
      select count(*) from public.agency_members
      where agency_id = OLD.agency_id and role = 'owner'
    ) <= 1 then
      raise exception 'last_owner_cannot_be_removed';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_last_owner_removal on public.agency_members;
create trigger trg_prevent_last_owner_removal
  before update or delete on public.agency_members
  for each row execute function public.prevent_last_owner_removal();

-- ==================================================================
-- Bucket pour le logo de l'agence (un seul fichier par agence, upsert)
-- ==================================================================

insert into storage.buckets (id, name, public)
values ('agency-assets', 'agency-assets', false)
on conflict (id) do nothing;

create policy "agency_assets_select" on storage.objects
  for select using (
    bucket_id = 'agency-assets'
    and public.is_agency_member((storage.foldername(name))[1]::uuid)
  );

create policy "agency_assets_insert" on storage.objects
  for insert with check (
    bucket_id = 'agency-assets'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );

create policy "agency_assets_update" on storage.objects
  for update using (
    bucket_id = 'agency-assets'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );

create policy "agency_assets_delete" on storage.objects
  for delete using (
    bucket_id = 'agency-assets'
    and public.is_agency_manager((storage.foldername(name))[1]::uuid)
  );
