-- M3ak — documents clients multiples, notes internes confidentielles, OCR sur option.
--
-- Évolution des modules existants (rien n'est supprimé ni réinitialisé) :
--
-- 1) customer_documents : remplace le champ JSON customers.documents (un seul
--    document par type, sans auteur nommé, modifiable en lecture-écriture
--    concurrente) par une vraie table : plusieurs documents par client et par type,
--    libellé libre, autorité de délivrance, catégories de permis, notes, auteur et
--    date d'ajout, suppression « douce » (la ligne et son historique restent, le
--    fichier est effacé). Les documents existants sont recopiés. L'ancien champ
--    JSON est conservé tel quel (lecture seule, plus alimenté) pour pouvoir revenir
--    en arrière. Un document peut aussi appartenir à un conducteur (driver_id).
--
-- 2) customer_notes + customer_note_revisions : notes internes avec auteur, date,
--    historique des modifications et suppression douce. Elles ne sont lues que par
--    les membres de l'agence propriétaire du client et ne figurent dans aucun
--    document remis au client (le contrat n'en recopie rien). L'ancien champ
--    customers.notes est recopié comme première note puis n'est plus utilisé.
--
-- 3) agencies.customer_ocr_enabled : l'analyse automatique des permis par un
--    fournisseur d'IA externe est DÉSACTIVÉE par défaut ; seul le propriétaire de
--    l'agence peut l'activer (données personnelles envoyées à un tiers).

-- ==================================================================
-- Documents clients
-- ==================================================================

create table public.customer_documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  driver_id uuid references public.drivers (id) on delete cascade,
  doc_type text not null check (
    doc_type in ('permis', 'cin', 'passeport', 'justificatif_domicile', 'autre_justificatif', 'autre')
  ),
  custom_label text check (custom_label is null or length(custom_label) <= 80),
  reference text check (reference is null or length(reference) <= 80),
  issuing_authority text check (issuing_authority is null or length(issuing_authority) <= 120),
  categories text[] not null default '{}',
  date_delivrance date,
  expires_at date,
  file_path text,
  notes text check (notes is null or length(notes) <= 1000),
  added_by uuid references auth.users (id),
  added_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  -- Un document appartient soit à un client, soit à un conducteur.
  constraint customer_documents_one_owner check ((customer_id is null) <> (driver_id is null)),
  constraint customer_documents_dates_order check (
    date_delivrance is null or expires_at is null or expires_at >= date_delivrance
  )
);

create index customer_documents_customer_idx on public.customer_documents (customer_id) where deleted_at is null;
create index customer_documents_driver_idx on public.customer_documents (driver_id) where deleted_at is null;
create index customer_documents_agency_idx on public.customer_documents (agency_id);

alter table public.customer_documents enable row level security;

create policy "customer_documents_select" on public.customer_documents
  for select using (public.is_agency_member(agency_id));
create policy "customer_documents_insert" on public.customer_documents
  for insert with check (public.is_agency_member(agency_id));
create policy "customer_documents_update" on public.customer_documents
  for update using (public.is_agency_member(agency_id));
-- Aucune policy DELETE : un document n'est jamais effacé physiquement (suppression douce
-- via deleted_at, réservée aux responsables par le déclencheur ci-dessous), ce qui
-- conserve l'historique d'une réservation ou d'un contrat.

-- Nom affiché d'un membre (prénom/nom du profil, sinon nom_complet).
create or replace function public.member_display_name(target_agency_id uuid, target_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    nullif(trim(coalesce(m.prenom, '') || ' ' || coalesce(m.nom, '')), ''),
    m.nom_complet
  )
  from public.agency_members m
  where m.agency_id = target_agency_id and m.user_id = target_user_id;
$$;

revoke all on function public.member_display_name(uuid, uuid) from public, anon;
grant execute on function public.member_display_name(uuid, uuid) to authenticated;

create or replace function public.guard_customer_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    -- Auteur imposé par le serveur : jamais fourni (ni falsifiable) par le client.
    if auth.uid() is not null then
      NEW.added_by := auth.uid();
      NEW.added_by_name := public.member_display_name(NEW.agency_id, auth.uid());
    end if;
    NEW.deleted_at := null;
    NEW.deleted_by := null;

    if NEW.customer_id is not null and not exists (
      select 1 from public.customers c where c.id = NEW.customer_id and c.agency_id = NEW.agency_id
    ) then
      raise exception 'document_customer_agency_mismatch';
    end if;
    if NEW.driver_id is not null and not exists (
      select 1 from public.drivers d where d.id = NEW.driver_id and d.agency_id = NEW.agency_id
    ) then
      raise exception 'document_driver_agency_mismatch';
    end if;
    return NEW;
  end if;

  -- UPDATE : l'identité du propriétaire et l'auteur d'origine ne changent jamais.
  if NEW.agency_id is distinct from OLD.agency_id
     or NEW.customer_id is distinct from OLD.customer_id
     or NEW.driver_id is distinct from OLD.driver_id
     or NEW.added_by is distinct from OLD.added_by
     or NEW.added_by_name is distinct from OLD.added_by_name
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'document_immutable_fields';
  end if;

  if OLD.deleted_at is not null then
    raise exception 'document_already_deleted';
  end if;

  -- Suppression : réservée aux responsables, trace de l'auteur, fichier détaché.
  if NEW.deleted_at is not null then
    if not public.is_agency_manager(NEW.agency_id) then
      raise exception 'document_delete_requires_manager';
    end if;
    NEW.deleted_by := auth.uid();
    NEW.file_path := null;
  else
    NEW.deleted_by := null;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger trg_guard_customer_document_insert
  before insert on public.customer_documents
  for each row execute function public.guard_customer_document();

create trigger trg_guard_customer_document_update
  before update on public.customer_documents
  for each row execute function public.guard_customer_document();

-- Reprise des documents existants (champ JSON customers.documents).
-- Les dates sont lues seulement si elles ont un format AAAA-MM-JJ valide.
insert into public.customer_documents
  (agency_id, customer_id, doc_type, reference, date_delivrance, expires_at, file_path, added_by, created_at)
select
  c.agency_id,
  c.id,
  case when d.value ->> 'type' in ('permis', 'cin', 'passeport') then d.value ->> 'type' else 'autre' end,
  nullif(trim(d.value ->> 'reference'), ''),
  case when d.value ->> 'dateDelivrance' ~ '^\d{4}-\d{2}-\d{2}' then left(d.value ->> 'dateDelivrance', 10)::date end,
  case when d.value ->> 'expiresAt' ~ '^\d{4}-\d{2}-\d{2}' then left(d.value ->> 'expiresAt', 10)::date end,
  nullif(d.value ->> 'path', ''),
  case when d.value ->> 'uploadedBy' ~ '^[0-9a-f-]{36}$'
            and exists (select 1 from auth.users u where u.id = (d.value ->> 'uploadedBy')::uuid)
       then (d.value ->> 'uploadedBy')::uuid end,
  case when d.value ->> 'uploadedAt' ~ '^\d{4}-\d{2}-\d{2}' then (d.value ->> 'uploadedAt')::timestamptz else now() end
from public.customers c
cross join lateral jsonb_array_elements(coalesce(c.documents, '[]'::jsonb)) as d(value)
where d.value ->> 'path' is not null;

-- ==================================================================
-- Notes internes
-- ==================================================================

create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_by uuid references auth.users (id),
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id)
);

create index customer_notes_customer_idx on public.customer_notes (customer_id, created_at desc) where deleted_at is null;
create index customer_notes_agency_idx on public.customer_notes (agency_id);

create table public.customer_note_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.customer_notes (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  body text not null,
  edited_by uuid references auth.users (id),
  edited_by_name text,
  edited_at timestamptz not null default now()
);

create index customer_note_revisions_note_idx on public.customer_note_revisions (note_id, edited_at desc);

alter table public.customer_notes enable row level security;
alter table public.customer_note_revisions enable row level security;

-- Lecture : membres de l'agence du client. Écriture : tout membre ajoute ; l'auteur
-- ou un responsable modifie/supprime (précisé par le déclencheur).
create policy "customer_notes_select" on public.customer_notes
  for select using (public.is_agency_member(agency_id));
create policy "customer_notes_insert" on public.customer_notes
  for insert with check (public.is_agency_member(agency_id));
create policy "customer_notes_update" on public.customer_notes
  for update using (
    public.is_agency_member(agency_id)
    and (created_by = auth.uid() or public.is_agency_manager(agency_id))
  );
-- Pas de DELETE : suppression douce uniquement (l'historique reste).

create policy "customer_note_revisions_select" on public.customer_note_revisions
  for select using (public.is_agency_member(agency_id));
-- Les révisions sont écrites uniquement par le déclencheur (SECURITY DEFINER) : aucune
-- policy INSERT/UPDATE/DELETE pour les utilisateurs.

create or replace function public.guard_customer_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if not exists (
      select 1 from public.customers c where c.id = NEW.customer_id and c.agency_id = NEW.agency_id
    ) then
      raise exception 'note_customer_agency_mismatch';
    end if;
    if auth.uid() is not null then
      NEW.created_by := auth.uid();
      NEW.created_by_name := public.member_display_name(NEW.agency_id, auth.uid());
    end if;
    NEW.deleted_at := null;
    NEW.deleted_by := null;
    NEW.edited_at := null;
    return NEW;
  end if;

  if NEW.agency_id is distinct from OLD.agency_id
     or NEW.customer_id is distinct from OLD.customer_id
     or NEW.created_by is distinct from OLD.created_by
     or NEW.created_by_name is distinct from OLD.created_by_name
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'note_immutable_fields';
  end if;

  if OLD.deleted_at is not null then
    raise exception 'note_already_deleted';
  end if;

  -- Seuls l'auteur ou un responsable modifient / suppriment (vérifié ici aussi, pas
  -- seulement par la policy, pour couvrir tous les chemins d'appel).
  if (NEW.body is distinct from OLD.body or NEW.deleted_at is not null)
     and not (OLD.created_by = auth.uid() or public.is_agency_manager(NEW.agency_id)) then
    raise exception 'note_edit_not_allowed';
  end if;

  if NEW.body is distinct from OLD.body then
    insert into public.customer_note_revisions (note_id, agency_id, body, edited_by, edited_by_name)
    values (OLD.id, OLD.agency_id, OLD.body, auth.uid(), public.member_display_name(OLD.agency_id, auth.uid()));
    NEW.edited_at := now();
  end if;

  if NEW.deleted_at is not null then
    NEW.deleted_by := auth.uid();
  else
    NEW.deleted_by := null;
  end if;

  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger trg_guard_customer_note_insert
  before insert on public.customer_notes
  for each row execute function public.guard_customer_note();

create trigger trg_guard_customer_note_update
  before update on public.customer_notes
  for each row execute function public.guard_customer_note();

-- L'ancienne note libre devient la première note de la fiche (auteur inconnu).
insert into public.customer_notes (agency_id, customer_id, body, created_at)
select agency_id, id, left(btrim(notes), 4000), created_at
from public.customers
where notes is not null and btrim(notes) <> '';

-- ==================================================================
-- OCR des permis : désactivé tant que le propriétaire ne l'a pas autorisé.
-- ==================================================================

alter table public.agencies
  add column customer_ocr_enabled boolean not null default false;

-- ==================================================================
-- Stockage des fichiers : un employé peut effacer un fichier qui n'est plus référencé (par ex.
-- l'ancien fichier après un remplacement), pour ne pas conserver de documents inutilement ; seul
-- un responsable efface un fichier encore rattaché à un document actif (comme avant).
-- ==================================================================

drop policy if exists "client_documents_delete" on storage.objects;
create policy "client_documents_delete" on storage.objects
  for delete using (
    bucket_id = 'client-documents'
    and (
      public.is_agency_manager((storage.foldername(name))[1]::uuid)
      or (
        public.is_agency_member((storage.foldername(name))[1]::uuid)
        and not exists (
          select 1 from public.customer_documents d
          where d.file_path = storage.objects.name and d.deleted_at is null
        )
      )
    )
  );
