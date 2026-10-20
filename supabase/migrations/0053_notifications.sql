-- M3ak — système de notifications.
--
-- Principes :
--   * une ligne par DESTINATAIRE (table notifications) : supprimer / masquer une notification ne concerne que son destinataire ;
--   * le contenu est stocké sous forme de TYPE + paramètres (nom du client, numéro, véhicule…) : l'application l'écrit dans la
--     langue de chaque utilisateur (fr / ar). Aucun texte en dur ici ;
--   * QUI REÇOIT QUOI (une seule règle, appliquée par le serveur, fonction notify_agency) :
--       - le propriétaire reçoit TOUT, dans toutes les filiales ;
--       - un membre sans filiale reçoit tout ce qui concerne l'agence ;
--       - un membre rattaché à une filiale reçoit ce qui concerne sa filiale ;
--       - l'auteur de l'action n'est pas notifié de sa propre action ;
--       - le choix de l'utilisateur (notifications coupées, catégories coupées) est respecté ;
--   * le nom de la filiale est ajouté au message seulement si l'agence en possède ;
--   * événements instantanés par déclencheurs (jamais bloquants), rappels (retour demain, retard…) par pg_cron toutes les heures ;
--   * l'envoi sur le téléphone (push) est fait par la fonction Edge `send-push`, appelée par un Database Webhook (voir docs/NOTIFICATIONS.md).

-- ==================================================================
-- Tables
-- ==================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete set null,
  kind text not null check (length(kind) between 1 and 60),
  category text not null check (category in ('rental', 'reminder', 'payment', 'contract', 'inspection', 'maintenance', 'team', 'customer')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'urgent')),
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object' and pg_column_size(params) <= 4000),
  link_type text check (link_type is null or link_type in ('rental', 'contract', 'vehicle', 'customer', 'maintenance', 'team')),
  link_id uuid,
  dedupe_key text,
  dismissed_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc) where dismissed_at is null;
create unique index if not exists notifications_dedupe_idx on public.notifications (recipient_id, dedupe_key) where dedupe_key is not null;

create table if not exists public.notification_preferences (
  user_id uuid not null references auth.users (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  enabled boolean not null default true,
  push_enabled boolean not null default true,
  muted_categories text[] not null default '{}',
  locale text not null default 'fr' check (locale in ('fr', 'ar')),
  updated_at timestamptz not null default now(),
  primary key (user_id, agency_id)
);

create table if not exists public.push_tokens (
  token text primary key check (length(token) between 10 and 300),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- ==================================================================
-- Droits : chacun ne voit et ne touche que ses propres lignes
-- ==================================================================

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_tokens enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (recipient_id = auth.uid());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Aucune écriture directe : seules les fonctions du serveur créent des notifications ; l'utilisateur ne peut que les masquer.
revoke insert, delete on public.notifications from anon, authenticated;
revoke update on public.notifications from anon, authenticated;
grant update (dismissed_at) on public.notifications to authenticated;

drop policy if exists "notification_prefs_own" on public.notification_preferences;
create policy "notification_prefs_own" on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_agency_member(agency_id));

drop policy if exists "push_tokens_own" on public.push_tokens;
create policy "push_tokens_own" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ==================================================================
-- Distribution : qui reçoit quoi
-- ==================================================================

create or replace function public.notify_agency(
  p_agency_id uuid,
  p_kind text,
  p_category text,
  p_severity text,
  p_params jsonb,
  p_branch_ids uuid[] default null,
  p_audience text default 'all',
  p_link_type text default null,
  p_link_id uuid default null,
  p_dedupe text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branches uuid[] := coalesce(array_remove(p_branch_ids, null), '{}');
  v_branch_id uuid := case when cardinality(array_remove(p_branch_ids, null)) > 0 then (array_remove(p_branch_ids, null))[1] else null end;
  v_branch_nom text;
  v_params jsonb := coalesce(p_params, '{}'::jsonb);
begin
  begin
    -- Le nom de la filiale n'est mentionné que si l'agence en a.
    if v_branch_id is not null then
      select nom into v_branch_nom from public.branches where id = v_branch_id and agency_id = p_agency_id;
      if v_branch_nom is not null then
        v_params := v_params || jsonb_build_object('branch', v_branch_nom);
      end if;
    end if;

    insert into public.notifications (agency_id, recipient_id, branch_id, kind, category, severity, params, link_type, link_id, dedupe_key)
    select p_agency_id, m.user_id, v_branch_id, p_kind, p_category, p_severity, v_params, p_link_type, p_link_id, p_dedupe
    from public.agency_members m
    left join public.notification_preferences pr on pr.user_id = m.user_id and pr.agency_id = m.agency_id
    where m.agency_id = p_agency_id
      and m.user_id is distinct from auth.uid()
      and (p_audience = 'all' or m.role in ('owner', 'manager'))
      and (m.role = 'owner' or m.branch_id is null or m.branch_id = any (v_branches))
      and coalesce(pr.enabled, true)
      and not (p_category = any (coalesce(pr.muted_categories, '{}')))
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  exception when others then
    raise warning 'notify_agency: échec ignoré (%)', sqlerrm;
  end;
end;
$$;

revoke all on function public.notify_agency(uuid, text, text, text, jsonb, uuid[], text, text, uuid, text) from public, anon, authenticated;

-- Informations communes d'une location (client, numéro de téléphone, véhicule, dates, filiales).
create or replace function public.notification_rental_context(p_rental_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rental', r.numero,
    'customer', c.nom_complet,
    'phone', c.telephone,
    'vehicle', trim(coalesce(v.marque, '') || ' ' || coalesce(v.modele, '')),
    'plate', v.immatriculation,
    'start', r.date_debut_prevue,
    'end', r.date_fin_prevue
  )
  from public.rentals r
  join public.vehicles v on v.id = r.vehicle_id
  join public.customers c on c.id = r.customer_id
  where r.id = p_rental_id;
$$;
revoke all on function public.notification_rental_context(uuid) from public, anon, authenticated;

-- ==================================================================
-- Événements instantanés (déclencheurs, jamais bloquants)
-- ==================================================================

create or replace function public.notify_on_rental_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ctx jsonb;
  v_vehicle_branch uuid;
  v_kind text;
  v_severity text := 'info';
begin
  begin
    if TG_OP = 'INSERT' then
      if NEW.statut = 'annulee' then return NEW; end if;
      v_kind := 'rental_created';
    elsif NEW.statut is distinct from OLD.statut then
      v_kind := case NEW.statut::text
        when 'confirmee' then 'rental_confirmed'
        when 'en_cours' then 'rental_started'
        when 'terminee' then 'rental_returned'
        when 'annulee' then 'rental_cancelled'
        else null end;
      if NEW.statut::text = 'annulee' then v_severity := 'warning'; end if;
    elsif NEW.date_fin_prevue is distinct from OLD.date_fin_prevue and NEW.statut::text in ('en_cours', 'confirmee', 'reservee', 'en_attente_confirmation') then
      v_kind := 'rental_extended';
    end if;
    if v_kind is null then return NEW; end if;

    select branch_id into v_vehicle_branch from public.vehicles where id = NEW.vehicle_id;
    v_ctx := public.notification_rental_context(NEW.id);
    perform public.notify_agency(
      NEW.agency_id, v_kind, 'rental', v_severity, v_ctx,
      case when v_kind = 'rental_returned' then array[NEW.branch_retour_id, v_vehicle_branch, NEW.branch_depart_id]
           else array[NEW.branch_depart_id, v_vehicle_branch, NEW.branch_retour_id] end,
      'all', 'rental', NEW.id, null);
  exception when others then
    raise warning 'notify_on_rental_change: échec ignoré (%)', sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_rental on public.rentals;
create trigger trg_notify_rental after insert or update on public.rentals
  for each row execute function public.notify_on_rental_change();

create or replace function public.notify_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rental public.rentals;
  v_branch uuid;
begin
  begin
    if NEW.statut::text <> 'paye' or (TG_OP = 'UPDATE' and OLD.statut::text = 'paye') then return NEW; end if;
    select * into v_rental from public.rentals where id = NEW.rental_id;
    select branch_id into v_branch from public.vehicles where id = v_rental.vehicle_id;
    perform public.notify_agency(
      NEW.agency_id, 'payment_received', 'payment', 'info',
      public.notification_rental_context(NEW.rental_id) || jsonb_build_object('amount', NEW.montant, 'method', NEW.methode::text),
      array[v_rental.branch_depart_id, v_branch, v_rental.branch_retour_id], 'all', 'rental', NEW.rental_id, null);
  exception when others then
    raise warning 'notify_on_payment: échec ignoré (%)', sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_payment on public.payments;
create trigger trg_notify_payment after insert or update on public.payments
  for each row execute function public.notify_on_payment();

create or replace function public.notify_on_contract_signed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rental public.rentals;
  v_branch uuid;
begin
  begin
    if NEW.statut::text <> 'signe' or OLD.statut::text = 'signe' then return NEW; end if;
    select * into v_rental from public.rentals where id = NEW.rental_id;
    select branch_id into v_branch from public.vehicles where id = v_rental.vehicle_id;
    perform public.notify_agency(
      NEW.agency_id, 'contract_signed', 'contract', 'info',
      public.notification_rental_context(NEW.rental_id) || jsonb_build_object('contract', NEW.numero),
      array[v_rental.branch_depart_id, v_branch], 'all', 'contract', NEW.id, null);
  exception when others then
    raise warning 'notify_on_contract_signed: échec ignoré (%)', sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_contract_signed on public.contracts;
create trigger trg_notify_contract_signed after update on public.contracts
  for each row execute function public.notify_on_contract_signed();

create or replace function public.notify_on_inspection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch uuid;
  v_vehicle text;
  v_count int;
begin
  begin
    select branch_id, trim(marque || ' ' || modele) into v_branch, v_vehicle from public.vehicles where id = NEW.vehicle_id;

    if NEW.skipped and not OLD.skipped then
      perform public.notify_agency(NEW.agency_id, 'inspection_skipped', 'inspection', 'warning',
        jsonb_build_object('vehicle', v_vehicle, 'type', NEW.type::text), array[v_branch], 'managers', 'rental', NEW.rental_id, null);
    end if;

    if NEW.analysis_status in ('terminee', 'partielle') and OLD.analysis_status is distinct from NEW.analysis_status then
      select count(*) into v_count from public.damages d where d.inspection_id = NEW.id and (NEW.type::text = 'depart' or d.nouveau);
      perform public.notify_agency(NEW.agency_id, 'inspection_analyzed', 'inspection',
        case when v_count > 0 and NEW.type::text = 'retour' then 'warning' else 'info' end,
        jsonb_build_object('vehicle', v_vehicle, 'type', NEW.type::text, 'count', v_count),
        array[v_branch], 'all', 'rental', NEW.rental_id, null);
    end if;
  exception when others then
    raise warning 'notify_on_inspection: échec ignoré (%)', sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_inspection on public.inspections;
create trigger trg_notify_inspection after update on public.inspections
  for each row execute function public.notify_on_inspection();

create or replace function public.notify_on_deposit_retained()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rental public.rentals;
  v_branch uuid;
begin
  begin
    if NEW.montant_retenu <= OLD.montant_retenu then return NEW; end if;
    select * into v_rental from public.rentals where id = NEW.rental_id;
    select branch_id into v_branch from public.vehicles where id = v_rental.vehicle_id;
    perform public.notify_agency(NEW.agency_id, 'deposit_retained', 'payment', 'warning',
      public.notification_rental_context(NEW.rental_id) || jsonb_build_object('amount', NEW.montant_retenu),
      array[v_rental.branch_retour_id, v_branch], 'all', 'rental', NEW.rental_id, null);
  exception when others then
    raise warning 'notify_on_deposit_retained: échec ignoré (%)', sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_deposit on public.deposits;
create trigger trg_notify_deposit after update on public.deposits
  for each row execute function public.notify_on_deposit_retained();

create or replace function public.notify_on_vehicle_maintenance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if NEW.statut::text = 'maintenance' and OLD.statut::text is distinct from 'maintenance' then
      perform public.notify_agency(NEW.agency_id, 'vehicle_maintenance', 'maintenance', 'info',
        jsonb_build_object('vehicle', trim(NEW.marque || ' ' || NEW.modele), 'plate', NEW.immatriculation),
        array[NEW.branch_id], 'all', 'vehicle', NEW.id, null);
    end if;
  exception when others then
    raise warning 'notify_on_vehicle_maintenance: échec ignoré (%)', sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_vehicle on public.vehicles;
create trigger trg_notify_vehicle after update on public.vehicles
  for each row execute function public.notify_on_vehicle_maintenance();

create or replace function public.notify_on_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if NEW.role::text = 'owner' then return NEW; end if;
    perform public.notify_agency(NEW.agency_id, 'member_joined', 'team', 'info',
      jsonb_build_object('name', coalesce(NEW.nom_complet, ''), 'role', NEW.role::text),
      array[NEW.branch_id], 'managers', 'team', NEW.id, null);
  exception when others then
    raise warning 'notify_on_member_joined: échec ignoré (%)', sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_member on public.agency_members;
create trigger trg_notify_member after insert on public.agency_members
  for each row execute function public.notify_on_member_joined();

create or replace function public.notify_on_customer_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.notify_agency(NEW.agency_id, 'customer_created', 'customer', 'info',
      jsonb_build_object('customer', NEW.nom_complet, 'phone', NEW.telephone), null, 'all', 'customer', NEW.id, null);
  exception when others then
    raise warning 'notify_on_customer_created: échec ignoré (%)', sqlerrm;
  end;
  return NEW;
end;
$$;
drop trigger if exists trg_notify_customer on public.customers;
create trigger trg_notify_customer after insert on public.customers
  for each row execute function public.notify_on_customer_created();

-- ==================================================================
-- Rappels planifiés (appelés toutes les heures par pg_cron)
-- ==================================================================

create or replace function public.generate_scheduled_notifications(p_now timestamptz default now())
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c_tz constant text := 'Africa/Casablanca';
  v_local timestamp := p_now at time zone c_tz;
  v_today date := v_local::date;
  r record;
begin
  -- Pas de rappel en pleine nuit (le téléphone sonnerait pour rien).
  if extract(hour from v_local) < 7 or extract(hour from v_local) >= 21 then
    return;
  end if;

  -- Retour prévu demain / aujourd'hui / en retard.
  for r in
    select rt.id, rt.agency_id, rt.date_fin_prevue, rt.branch_retour_id, rt.branch_depart_id, v.branch_id as vehicle_branch,
           (rt.date_fin_prevue at time zone c_tz)::date as end_day
    from public.rentals rt join public.vehicles v on v.id = rt.vehicle_id
    where rt.statut::text = 'en_cours' and (rt.date_fin_prevue at time zone c_tz)::date between v_today and v_today + 1
  loop
    perform public.notify_agency(r.agency_id,
      case when r.end_day = v_today then 'return_today' else 'return_tomorrow' end, 'reminder', 'warning',
      public.notification_rental_context(r.id),
      array[r.branch_retour_id, r.vehicle_branch, r.branch_depart_id], 'all', 'rental', r.id,
      (case when r.end_day = v_today then 'return_today:' else 'return_tomorrow:' end) || r.id || ':' || r.end_day);
  end loop;

  for r in
    select rt.id, rt.agency_id, rt.branch_retour_id, rt.branch_depart_id, v.branch_id as vehicle_branch
    from public.rentals rt join public.vehicles v on v.id = rt.vehicle_id
    where rt.statut::text = 'en_cours' and rt.date_fin_prevue < p_now - interval '1 hour'
  loop
    perform public.notify_agency(r.agency_id, 'return_late', 'reminder', 'urgent',
      public.notification_rental_context(r.id),
      array[r.branch_retour_id, r.vehicle_branch, r.branch_depart_id], 'all', 'rental', r.id,
      'return_late:' || r.id || ':' || v_today);
  end loop;

  -- Départ prévu aujourd'hui / demain / dépassé.
  for r in
    select rt.id, rt.agency_id, rt.branch_depart_id, v.branch_id as vehicle_branch,
           (rt.date_debut_prevue at time zone c_tz)::date as start_day
    from public.rentals rt join public.vehicles v on v.id = rt.vehicle_id
    where rt.statut::text in ('confirmee', 'reservee') and (rt.date_debut_prevue at time zone c_tz)::date between v_today and v_today + 1
  loop
    perform public.notify_agency(r.agency_id,
      case when r.start_day = v_today then 'departure_today' else 'departure_tomorrow' end, 'reminder', 'info',
      public.notification_rental_context(r.id),
      array[r.branch_depart_id, r.vehicle_branch], 'all', 'rental', r.id,
      (case when r.start_day = v_today then 'departure_today:' else 'departure_tomorrow:' end) || r.id || ':' || r.start_day);
  end loop;

  for r in
    select rt.id, rt.agency_id, rt.branch_depart_id, v.branch_id as vehicle_branch
    from public.rentals rt join public.vehicles v on v.id = rt.vehicle_id
    where rt.statut::text in ('confirmee', 'reservee') and rt.date_debut_prevue < p_now - interval '1 hour'
  loop
    perform public.notify_agency(r.agency_id, 'departure_late', 'reminder', 'warning',
      public.notification_rental_context(r.id),
      array[r.branch_depart_id, r.vehicle_branch], 'all', 'rental', r.id,
      'departure_late:' || r.id || ':' || v_today);
  end loop;

  -- Entretien : à faire dans les 7 jours / en retard.
  for r in
    select mi.id, mi.agency_id, mi.type::text as mtype, mi.echeance_date, v.branch_id, v.id as vehicle_id,
           trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate
    from public.maintenance_items mi join public.vehicles v on v.id = mi.vehicle_id
    where mi.statut::text <> 'effectuee' and mi.echeance_date is not null and mi.echeance_date <= v_today + 7
  loop
    perform public.notify_agency(r.agency_id,
      case when r.echeance_date < v_today then 'maintenance_overdue' else 'maintenance_due' end, 'maintenance',
      case when r.echeance_date < v_today then 'urgent' else 'warning' end,
      jsonb_build_object('maintenance', r.mtype, 'vehicle', r.vehicle, 'plate', r.plate, 'date', r.echeance_date),
      array[r.branch_id], 'all', 'maintenance', r.id,
      case when r.echeance_date < v_today
           then 'maintenance_overdue:' || r.id || ':' || to_char(v_today, 'IYYY-IW')
           else 'maintenance_due:' || r.id || ':' || r.echeance_date end);
  end loop;

  -- Permis du client qui expire dans les 14 jours alors qu'il a une location en cours ou à venir.
  for r in
    select d.id, d.agency_id, d.expires_at, c.nom_complet as customer, c.telephone as phone, rt.id as rental_id, rt.branch_depart_id, v.branch_id as vehicle_branch
    from public.customer_documents d
    join public.customers c on c.id = d.customer_id
    join public.rentals rt on rt.customer_id = c.id and rt.statut::text in ('en_cours', 'confirmee', 'reservee')
    join public.vehicles v on v.id = rt.vehicle_id
    where d.deleted_at is null and d.doc_type = 'permis' and d.expires_at is not null and d.expires_at between v_today and v_today + 14
  loop
    perform public.notify_agency(r.agency_id, 'licence_expiring', 'customer', 'warning',
      jsonb_build_object('customer', r.customer, 'phone', r.phone, 'date', r.expires_at),
      array[r.branch_depart_id, r.vehicle_branch], 'all', 'rental', r.rental_id,
      'licence_expiring:' || r.id || ':' || r.expires_at);
  end loop;

  -- Ménage : les notifications masquées depuis 30 jours, ou vieilles de 90 jours, sont effacées.
  delete from public.notifications where dismissed_at < p_now - interval '30 days' or created_at < p_now - interval '90 days';
end;
$$;
revoke all on function public.generate_scheduled_notifications(timestamptz) from public, anon, authenticated;

-- Planification toutes les heures si pg_cron est disponible (Supabase : Database → Extensions → pg_cron).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule('m3ak_notifications') from cron.job where jobname = 'm3ak_notifications';
      perform cron.schedule('m3ak_notifications', '0 * * * *', 'select public.generate_scheduled_notifications()');
    exception when others then
      raise notice 'pg_cron non activé (%) : activez l''extension puis rejouez cette migration', sqlerrm;
    end;
  else
    raise notice 'pg_cron indisponible : les rappels planifiés ne seront pas générés';
  end if;
end
$$;
