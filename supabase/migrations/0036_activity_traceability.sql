-- M3ak — traçabilité : le PROPRIÉTAIRE voit qui a fait quoi dans l'entreprise.
--
-- Principes :
--   * le journal (agency_audit_log) est alimenté UNIQUEMENT par des déclencheurs du serveur : ni l'app ni un employé
--     ne peuvent écrire, modifier ou effacer une ligne (droits retirés) ; l'auteur est imposé par la session (auth.uid()) ;
--   * visible uniquement du propriétaire (policy existante) ;
--   * on journalise des FAITS (qui, quand, quelle action, sur quoi), jamais le contenu sensible : ni texte des notes,
--     ni numéros de pièce d'identité, ni photos ;
--   * un échec d'écriture du journal ne bloque jamais l'opération métier (avertissement serveur seulement).
-- Aucune donnée existante n'est modifiée (les anciennes lignes reçoivent seulement une catégorie).

alter table public.agency_audit_log
  add column if not exists actor_role public.agency_role,
  add column if not exists category text;

create index if not exists agency_audit_log_category_idx on public.agency_audit_log (agency_id, category, created_at desc);
create index if not exists agency_audit_log_actor_idx on public.agency_audit_log (agency_id, actor_id, created_at desc);

-- Journal en lecture seule pour tout le monde côté API (les écritures passent par les déclencheurs).
revoke insert, update, delete on public.agency_audit_log from anon, authenticated;

create or replace function public.audit_category_of(p_action text)
returns text
language sql
immutable
as $$
  select case
    when starts_with(p_action, 'rental_') then 'rental'
    when starts_with(p_action, 'payment_') then 'payment'
    when starts_with(p_action, 'customer_') then 'customer'
    when starts_with(p_action, 'vehicle_') then 'vehicle'
    when starts_with(p_action, 'contract_') then 'contract'
    when starts_with(p_action, 'deposit_') then 'deposit'
    when starts_with(p_action, 'maintenance_') then 'maintenance'
    when starts_with(p_action, 'inspection_') or starts_with(p_action, 'departure_check_') then 'inspection'
    when starts_with(p_action, 'branch_') or starts_with(p_action, 'invite_') or starts_with(p_action, 'member_') then 'team'
    when starts_with(p_action, 'ocr_') or starts_with(p_action, 'ai_') then 'settings'
    else 'other'
  end;
$$;

-- Complète automatiquement catégorie et rôle de l'auteur, quel que soit le déclencheur ou la fonction qui écrit.
create or replace function public.audit_log_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.category := coalesce(new.category, public.audit_category_of(new.action));
  if new.actor_role is null and new.actor_id is not null then
    select role into new.actor_role from public.agency_members where agency_id = new.agency_id and user_id = new.actor_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_log_fill on public.agency_audit_log;
create trigger trg_audit_log_fill before insert on public.agency_audit_log
  for each row execute function public.audit_log_fill();

update public.agency_audit_log set category = public.audit_category_of(action) where category is null;

-- Écriture d'un événement : auteur imposé par la session, jamais bloquante.
create or replace function public.audit_event(p_agency_id uuid, p_action text, p_target text, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor text;
begin
  begin
    select nom_complet into actor from public.agency_members where agency_id = p_agency_id and user_id = auth.uid();
    if actor is null and auth.uid() is null then actor := 'Système'; end if;
    insert into public.agency_audit_log (agency_id, actor_id, actor_name, action, target_label, details)
    values (p_agency_id, auth.uid(), actor, p_action, p_target, p_details);
  exception when others then
    raise warning 'audit_event: échec ignoré (%)', sqlerrm;
  end;
end;
$$;
-- Réservée aux déclencheurs : personne ne peut l'appeler depuis l'API.
revoke all on function public.audit_event(uuid, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- locations
create or replace function public.audit_rentals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle_label text;
  customer_name text;
  action text;
begin
  select marque || ' ' || modele into vehicle_label from public.vehicles where id = NEW.vehicle_id;
  select nom_complet into customer_name from public.customers where id = NEW.customer_id;

  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'rental_created', NEW.numero, jsonb_build_object(
      'vehicle', vehicle_label, 'customer', customer_name, 'start', NEW.date_debut_prevue, 'end', NEW.date_fin_prevue, 'total', NEW.prix_total));
  elsif OLD.statut is distinct from NEW.statut then
    action := case NEW.statut
      when 'confirmee' then 'rental_confirmed'
      when 'en_cours' then 'rental_started'
      when 'terminee' then 'rental_completed'
      when 'annulee' then 'rental_cancelled'
      else 'rental_status_changed' end;
    perform public.audit_event(NEW.agency_id, action, NEW.numero, jsonb_build_object(
      'vehicle', vehicle_label, 'customer', customer_name, 'from', OLD.statut, 'to', NEW.statut));
  elsif OLD.date_fin_prevue is distinct from NEW.date_fin_prevue or OLD.date_debut_prevue is distinct from NEW.date_debut_prevue then
    perform public.audit_event(NEW.agency_id, 'rental_dates_changed', NEW.numero, jsonb_build_object(
      'vehicle', vehicle_label, 'from_end', OLD.date_fin_prevue, 'to_end', NEW.date_fin_prevue, 'total', NEW.prix_total));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_rentals on public.rentals;
create trigger trg_audit_rentals after insert or update on public.rentals for each row execute function public.audit_rentals();

-- ---------------------------------------------------------------- paiements
create or replace function public.audit_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rental_number text;
begin
  select numero into rental_number from public.rentals where id = NEW.rental_id;
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'payment_recorded', rental_number,
      jsonb_build_object('amount', NEW.montant, 'method', NEW.methode, 'status', NEW.statut));
  elsif OLD.statut is distinct from NEW.statut then
    perform public.audit_event(NEW.agency_id, 'payment_status_changed', rental_number,
      jsonb_build_object('amount', NEW.montant, 'from', OLD.statut, 'to', NEW.statut));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_payments on public.payments;
create trigger trg_audit_payments after insert or update on public.payments for each row execute function public.audit_payments();

-- ---------------------------------------------------------------- clients (noms de champs seulement, jamais les valeurs)
create or replace function public.audit_customers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed text[];
begin
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'customer_created', NEW.nom_complet, null);
  elsif OLD.archived_at is distinct from NEW.archived_at then
    perform public.audit_event(NEW.agency_id, case when NEW.archived_at is null then 'customer_reactivated' else 'customer_archived' end, NEW.nom_complet, null);
  else
    select array_agg(key order by key) into changed
    from jsonb_each(to_jsonb(NEW)) n
    where key not in ('updated_at', 'documents', 'notes') and n.value is distinct from to_jsonb(OLD) -> key;
    if changed is not null then
      perform public.audit_event(NEW.agency_id, 'customer_updated', NEW.nom_complet, jsonb_build_object('fields', to_jsonb(changed)));
    end if;
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_customers on public.customers;
create trigger trg_audit_customers after insert or update on public.customers for each row execute function public.audit_customers();

-- ---------------------------------------------------------------- véhicules
create or replace function public.audit_vehicles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  label text := NEW.marque || ' ' || NEW.modele;
begin
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'vehicle_created', label, jsonb_build_object('plate', NEW.immatriculation));
  elsif OLD.archived_at is distinct from NEW.archived_at then
    perform public.audit_event(NEW.agency_id, case when NEW.archived_at is null then 'vehicle_reactivated' else 'vehicle_archived' end, label, jsonb_build_object('plate', NEW.immatriculation));
  elsif OLD.prix_jour is distinct from NEW.prix_jour then
    perform public.audit_event(NEW.agency_id, 'vehicle_price_changed', label, jsonb_build_object('from', OLD.prix_jour, 'to', NEW.prix_jour));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_vehicles on public.vehicles;
create trigger trg_audit_vehicles after insert or update on public.vehicles for each row execute function public.audit_vehicles();

-- ---------------------------------------------------------------- documents et notes des clients (jamais leur contenu)
create or replace function public.audit_customer_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  holder text;
begin
  select coalesce((select nom_complet from public.customers where id = NEW.customer_id),
                  (select nom_complet from public.drivers where id = NEW.driver_id)) into holder;
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'customer_document_added', holder, jsonb_build_object('type', NEW.doc_type));
  elsif OLD.deleted_at is null and NEW.deleted_at is not null then
    perform public.audit_event(NEW.agency_id, 'customer_document_deleted', holder, jsonb_build_object('type', NEW.doc_type));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_customer_documents on public.customer_documents;
create trigger trg_audit_customer_documents after insert or update on public.customer_documents for each row execute function public.audit_customer_documents();

create or replace function public.audit_customer_notes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  holder text;
begin
  select nom_complet into holder from public.customers where id = NEW.customer_id;
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'customer_note_added', holder, null);
  elsif OLD.deleted_at is null and NEW.deleted_at is not null then
    perform public.audit_event(NEW.agency_id, 'customer_note_deleted', holder, null);
  elsif OLD.body is distinct from NEW.body then
    perform public.audit_event(NEW.agency_id, 'customer_note_edited', holder, null);
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_customer_notes on public.customer_notes;
create trigger trg_audit_customer_notes after insert or update on public.customer_notes for each row execute function public.audit_customer_notes();

-- ---------------------------------------------------------------- contrats, cautions, entretien, inspections, vérification de départ
create or replace function public.audit_contracts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'contract_created', NEW.numero, null);
  elsif OLD.statut is distinct from NEW.statut then
    perform public.audit_event(NEW.agency_id,
      case NEW.statut when 'signe' then 'contract_signed' when 'cloture' then 'contract_closed' when 'annule' then 'contract_cancelled' else 'contract_status_changed' end,
      NEW.numero, jsonb_build_object('from', OLD.statut, 'to', NEW.statut));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_contracts on public.contracts;
create trigger trg_audit_contracts after insert or update on public.contracts for each row execute function public.audit_contracts();

create or replace function public.audit_deposits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rental_number text;
begin
  select numero into rental_number from public.rentals where id = NEW.rental_id;
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'deposit_blocked', rental_number, jsonb_build_object('amount', NEW.montant_bloque));
  elsif OLD.statut is distinct from NEW.statut then
    perform public.audit_event(NEW.agency_id, 'deposit_resolved', rental_number,
      jsonb_build_object('status', NEW.statut, 'retained', NEW.montant_retenu, 'restituted', NEW.montant_restitue));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_deposits on public.deposits;
create trigger trg_audit_deposits after insert or update on public.deposits for each row execute function public.audit_deposits();

create or replace function public.audit_maintenance_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle_label text;
begin
  select marque || ' ' || modele into vehicle_label from public.vehicles where id = NEW.vehicle_id;
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'maintenance_created', vehicle_label, jsonb_build_object('type', NEW.type));
  elsif OLD.statut is distinct from NEW.statut and NEW.statut = 'en_cours' then
    perform public.audit_event(NEW.agency_id, 'maintenance_started', vehicle_label, jsonb_build_object('type', NEW.type));
  elsif OLD.statut is distinct from NEW.statut and NEW.statut = 'effectuee' then
    perform public.audit_event(NEW.agency_id, 'maintenance_completed', vehicle_label, jsonb_build_object('type', NEW.type, 'cost', NEW.cout));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_maintenance_items on public.maintenance_items;
create trigger trg_audit_maintenance_items after insert or update on public.maintenance_items for each row execute function public.audit_maintenance_items();

create or replace function public.audit_inspections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vehicle_label text;
begin
  select marque || ' ' || modele into vehicle_label from public.vehicles where id = NEW.vehicle_id;
  if TG_OP = 'INSERT' then
    perform public.audit_event(NEW.agency_id, 'inspection_created', vehicle_label, jsonb_build_object('type', NEW.type));
  elsif OLD.statut is distinct from NEW.statut and NEW.statut in ('terminee', 'validee') then
    perform public.audit_event(NEW.agency_id, 'inspection_completed', vehicle_label, jsonb_build_object('type', NEW.type));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_inspections on public.inspections;
create trigger trg_audit_inspections after insert or update on public.inspections for each row execute function public.audit_inspections();

create or replace function public.audit_departure_confirmations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rental_number text;
begin
  select numero into rental_number from public.rentals where id = NEW.rental_id;
  perform public.audit_event(NEW.agency_id, 'departure_check_confirmed', rental_number, null);
  return NEW;
end;
$$;
drop trigger if exists trg_audit_departure_confirmations on public.rental_departure_confirmations;
create trigger trg_audit_departure_confirmations after insert or update on public.rental_departure_confirmations
  for each row execute function public.audit_departure_confirmations();

-- ---------------------------------------------------------------- accords du propriétaire (IA)
create or replace function public.audit_ocr_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.cloud_enabled is distinct from NEW.cloud_enabled then
    perform public.audit_event(NEW.agency_id, 'ocr_cloud_toggled', null, jsonb_build_object('enabled', NEW.cloud_enabled));
  end if;
  if OLD.insights_enabled is distinct from NEW.insights_enabled then
    perform public.audit_event(NEW.agency_id, 'ai_insights_toggled', null, jsonb_build_object('enabled', NEW.insights_enabled));
  end if;
  return NEW;
end;
$$;
drop trigger if exists trg_audit_ocr_settings on public.agency_ocr_settings;
create trigger trg_audit_ocr_settings after update on public.agency_ocr_settings for each row execute function public.audit_ocr_settings();

-- ---------------------------------------------------------------- résumé par employé (propriétaire seulement)
create or replace function public.audit_activity_summary(p_agency_id uuid, p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.agency_role_of(p_agency_id) is distinct from 'owner' then
    raise exception 'not_allowed';
  end if;
  return coalesce((
    select jsonb_agg(row_json order by total desc, name)
    from (
      select
        coalesce(l.actor_name, 'Inconnu') as name,
        count(*) as total,
        jsonb_build_object(
          'actor_id', l.actor_id,
          'actor_name', coalesce(l.actor_name, 'Inconnu'),
          'actor_role', max(l.actor_role::text),
          'total', count(*),
          'last_at', max(l.created_at),
          'categories', (
            select jsonb_object_agg(category, n)
            from (
              select coalesce(x.category, 'other') as category, count(*) as n
              from public.agency_audit_log x
              where x.agency_id = p_agency_id
                and x.actor_id is not distinct from l.actor_id
                and (p_from is null or x.created_at >= p_from)
                and (p_to is null or x.created_at < p_to)
              group by 1
            ) c
          )
        ) as row_json
      from public.agency_audit_log l
      where l.agency_id = p_agency_id
        and (p_from is null or l.created_at >= p_from)
        and (p_to is null or l.created_at < p_to)
      group by l.actor_id, l.actor_name
    ) s
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.audit_activity_summary(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.audit_activity_summary(uuid, timestamptz, timestamptz) to authenticated;
