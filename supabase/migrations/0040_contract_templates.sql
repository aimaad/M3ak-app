-- M3ak — modèle de contrat propre à chaque agence.
-- Le propriétaire envoie UNE FOIS un exemple de son contrat (PDF ou photos, vierge ou rempli) ; l'IA en extrait un
-- modèle vierge (blocs + champs automatiques) enregistré ici. Chaque contrat ne fait ensuite que REMPLIR ce modèle
-- sur le téléphone : aucun appel à l'IA à chaque réservation.
-- L'exemple lui-même n'est jamais conservé. Sans modèle, l'app utilise le modèle M3ak standard.

create table if not exists public.agency_contract_templates (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  template jsonb not null,
  source_name text,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint contract_template_is_object check (jsonb_typeof(template) = 'object'),
  constraint contract_template_size check (pg_column_size(template) <= 300000)
);

alter table public.agency_contract_templates enable row level security;

drop policy if exists "contract_templates_select" on public.agency_contract_templates;
create policy "contract_templates_select" on public.agency_contract_templates
  for select using (public.is_agency_member(agency_id));

drop policy if exists "contract_templates_insert" on public.agency_contract_templates;
create policy "contract_templates_insert" on public.agency_contract_templates
  for insert with check (public.agency_role_of(agency_id) = 'owner');

drop policy if exists "contract_templates_update" on public.agency_contract_templates;
create policy "contract_templates_update" on public.agency_contract_templates
  for update using (public.agency_role_of(agency_id) = 'owner');

drop policy if exists "contract_templates_delete" on public.agency_contract_templates;
create policy "contract_templates_delete" on public.agency_contract_templates
  for delete using (public.agency_role_of(agency_id) = 'owner');

grant select, insert, update, delete on public.agency_contract_templates to authenticated;

create or replace function public.contract_template_stamp()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  return NEW;
end;
$$;

drop trigger if exists trg_contract_template_stamp on public.agency_contract_templates;
create trigger trg_contract_template_stamp
  before insert or update on public.agency_contract_templates
  for each row execute function public.contract_template_stamp();

-- Traçabilité (sans le contenu du modèle).
create or replace function public.audit_contract_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.audit_event(OLD.agency_id, 'contract_template_removed', null, null);
    return OLD;
  end if;
  perform public.audit_event(NEW.agency_id, 'contract_template_saved', NEW.source_name, null);
  return NEW;
end;
$$;

drop trigger if exists trg_audit_contract_template on public.agency_contract_templates;
create trigger trg_audit_contract_template
  after insert or update or delete on public.agency_contract_templates
  for each row execute function public.audit_contract_template();

-- Modèle figé sur le contrat au moment de la signature : une modification ultérieure du modèle de l'agence ne
-- change jamais un contrat déjà signé. Null = modèle M3ak standard.
alter table public.contracts add column if not exists terms_snapshot jsonb;

create or replace function public.lock_contract_terms_snapshot()
returns trigger
language plpgsql
as $$
begin
  if OLD.client_signed_at is not null and NEW.terms_snapshot is distinct from OLD.terms_snapshot then
    raise exception 'contract_signature_locked';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_lock_contract_terms_snapshot on public.contracts;
create trigger trg_lock_contract_terms_snapshot
  before update on public.contracts
  for each row execute function public.lock_contract_terms_snapshot();

-- Suivi d'utilisation : les analyses de modèles comptent comme des lectures de documents (compteurs seulement).
alter table public.ocr_usage_events drop constraint if exists ocr_usage_events_document_type_check;
alter table public.ocr_usage_events
  add constraint ocr_usage_events_document_type_check check (document_type in ('permis', 'carte_grise', 'insights', 'contrat_modele'));
