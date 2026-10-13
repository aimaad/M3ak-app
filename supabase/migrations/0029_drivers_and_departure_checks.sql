-- M3ak — conducteurs associés aux réservations et vérification avant départ.
--
-- Évolution du modèle existant (drivers, rental_additional_drivers, rentals.driver_id,
-- start_rental_with_contract) — rien n'est supprimé ni recréé :
--
-- 1) drivers.linked_customer_id : un conducteur peut être une fiche client déjà
--    existante. On ne duplique pas la personne : la ligne « conducteur » ne sert que
--    de point d'ancrage et ses documents sont ceux du client (une seule ligne par
--    client, garantie par un index unique).
-- 2) Règles sur les conducteurs d'une réservation : pas de doublon, le principal n'est
--    pas aussi « supplémentaire », nombre maximum configurable, modification verrouillée
--    une fois la location commencée ; écriture atomique via set_rental_drivers().
-- 3) agency_departure_policies : exigences de l'agence avant départ. Rien n'est imposé
--    par défaut (block_departure = false) : les valeurs proposées sont des modèles
--    d'exigences MÉTIER à faire valider par l'agence, pas des règles juridiques.
-- 4) rental_departure_check() : liste de contrôle unique (affichée dans l'app ET utilisée
--    par le départ) du client et de chaque conducteur. La présence d'un fichier n'est
--    jamais une preuve de validité : c'est la confirmation humaine, horodatée et
--    attribuée, qui l'atteste (rental_departure_confirmations).
-- 5) start_rental_with_contract refuse le départ si la politique est active et que la
--    vérification n'est pas satisfaite — contrôle serveur, pas seulement un bouton grisé.
-- 6) contracts.autres_conducteurs : instantané des conducteurs supplémentaires.

-- ==================================================================
-- 1. Conducteurs liés à une fiche client
-- ==================================================================

alter table public.drivers
  add column linked_customer_id uuid references public.customers (id) on delete cascade;

alter table public.drivers
  add constraint drivers_linked_matches_owner
  check (linked_customer_id is null or linked_customer_id = customer_id);

create unique index drivers_linked_customer_unique_idx
  on public.drivers (agency_id, linked_customer_id)
  where linked_customer_id is not null;

-- Le client propriétaire d'un conducteur appartient à la même agence (jamais vérifié avant).
create or replace function public.validate_driver_customer_agency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.customers c where c.id = NEW.customer_id and c.agency_id = NEW.agency_id
  ) then
    raise exception 'driver_customer_agency_mismatch';
  end if;
  return NEW;
end;
$$;

create trigger trg_drivers_validate_customer_agency
  before insert or update of customer_id, agency_id on public.drivers
  for each row execute function public.validate_driver_customer_agency();

-- Réutilise (ou crée une seule fois) la ligne « conducteur » d'un client existant.
create or replace function public.ensure_customer_driver(p_customer_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_customer record;
  v_id uuid;
begin
  select id, agency_id, nom_complet, cin_ou_passeport, numero_permis, telephone
  into v_customer
  from public.customers where id = p_customer_id;

  if v_customer.id is null then
    raise exception 'customer_not_found';
  end if;

  select id into v_id from public.drivers
  where agency_id = v_customer.agency_id and linked_customer_id = p_customer_id;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.drivers
    (agency_id, customer_id, linked_customer_id, nom_complet, cin_ou_passeport, numero_permis, telephone)
  values
    (v_customer.agency_id, p_customer_id, p_customer_id, v_customer.nom_complet,
     v_customer.cin_ou_passeport, v_customer.numero_permis, v_customer.telephone)
  on conflict (agency_id, linked_customer_id) where linked_customer_id is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.drivers
    where agency_id = v_customer.agency_id and linked_customer_id = p_customer_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.ensure_customer_driver(uuid) from public, anon;
grant execute on function public.ensure_customer_driver(uuid) to authenticated;

-- ==================================================================
-- 3. Politique de départ de l'agence (créée avant les règles qui l'utilisent)
-- ==================================================================

create table public.agency_departure_policies (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  -- Interrupteur général : tant qu'il est faux, la liste de contrôle s'affiche mais ne
  -- bloque jamais le départ.
  block_departure boolean not null default false,
  require_customer_id_document boolean not null default true,
  require_driver_licence boolean not null default true,
  require_licence_valid_until_end boolean not null default true,
  require_manual_confirmation boolean not null default true,
  confirmation_role text not null default 'employee' check (confirmation_role in ('employee', 'manager')),
  max_additional_drivers int not null default 3 check (max_additional_drivers between 0 and 10),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.agency_departure_policies enable row level security;

create policy "agency_departure_policies_select" on public.agency_departure_policies
  for select using (public.is_agency_member(agency_id));
create policy "agency_departure_policies_insert" on public.agency_departure_policies
  for insert with check (public.agency_role_of(agency_id) = 'owner');
create policy "agency_departure_policies_update" on public.agency_departure_policies
  for update using (public.agency_role_of(agency_id) = 'owner');

create or replace function public.stamp_departure_policy()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  return NEW;
end;
$$;

create trigger trg_agency_departure_policies_stamp
  before insert or update on public.agency_departure_policies
  for each row execute function public.stamp_departure_policy();

-- Politique effective : la ligne de l'agence, ou les valeurs par défaut (non bloquantes).
create or replace function public.get_departure_policy(p_agency_id uuid)
returns public.agency_departure_policies
language plpgsql
stable
set search_path = public
as $$
declare
  v_policy public.agency_departure_policies;
begin
  select * into v_policy from public.agency_departure_policies where agency_id = p_agency_id;
  if v_policy.agency_id is null then
    v_policy.agency_id := p_agency_id;
    v_policy.block_departure := false;
    v_policy.require_customer_id_document := true;
    v_policy.require_driver_licence := true;
    v_policy.require_licence_valid_until_end := true;
    v_policy.require_manual_confirmation := true;
    v_policy.confirmation_role := 'employee';
    v_policy.max_additional_drivers := 3;
  end if;
  return v_policy;
end;
$$;

revoke all on function public.get_departure_policy(uuid) from public, anon;
grant execute on function public.get_departure_policy(uuid) to authenticated;

-- ==================================================================
-- 2. Conducteurs d'une réservation : règles et écriture atomique
-- ==================================================================

create or replace function public.guard_rental_additional_driver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rental record;
  v_max int;
  v_count int;
begin
  select id, agency_id, statut, driver_id into v_rental
  from public.rentals where id = coalesce(NEW.rental_id, OLD.rental_id);

  -- Suppression en cascade d'une réservation : rien à contrôler.
  if v_rental.id is null then
    return coalesce(NEW, OLD);
  end if;

  if v_rental.statut in ('en_cours', 'terminee', 'annulee') then
    raise exception 'rental_drivers_locked';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  if NEW.agency_id is distinct from v_rental.agency_id then
    raise exception 'rental_driver_agency_mismatch';
  end if;
  if not exists (
    select 1 from public.drivers d where d.id = NEW.driver_id and d.agency_id = v_rental.agency_id
  ) then
    raise exception 'rental_driver_agency_mismatch';
  end if;
  if v_rental.driver_id is not null and v_rental.driver_id = NEW.driver_id then
    raise exception 'duplicate_driver';
  end if;

  select max_additional_drivers into v_max from public.get_departure_policy(v_rental.agency_id);
  select count(*) into v_count from public.rental_additional_drivers where rental_id = NEW.rental_id;
  if v_count >= v_max then
    raise exception 'too_many_additional_drivers';
  end if;

  return NEW;
end;
$$;

create trigger trg_guard_rental_additional_driver
  before insert or delete on public.rental_additional_drivers
  for each row execute function public.guard_rental_additional_driver();

-- Le conducteur principal ne peut pas être déjà conducteur supplémentaire.
create or replace function public.guard_rental_principal_driver()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.driver_id is not null and exists (
    select 1 from public.rental_additional_drivers a
    where a.rental_id = NEW.id and a.driver_id = NEW.driver_id
  ) then
    raise exception 'duplicate_driver';
  end if;
  return NEW;
end;
$$;

create trigger trg_guard_rental_principal_driver
  before update of driver_id on public.rentals
  for each row execute function public.guard_rental_principal_driver();

-- Définit d'un seul bloc le conducteur principal (null = le client conduit lui-même)
-- et la liste des conducteurs supplémentaires. SECURITY INVOKER : les droits (agence,
-- filiale) de l'appelant s'appliquent.
create or replace function public.set_rental_drivers(
  p_rental_id uuid,
  p_principal uuid,
  p_additional uuid[]
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_rental record;
  v_max int;
  v_input uuid[] := coalesce(p_additional, '{}');
  v_unique uuid[];
begin
  select id, agency_id, statut into v_rental from public.rentals where id = p_rental_id;
  if v_rental.id is null then
    raise exception 'rental_not_found';
  end if;
  if v_rental.statut in ('en_cours', 'terminee', 'annulee') then
    raise exception 'rental_drivers_locked';
  end if;

  v_unique := array(select distinct x from unnest(v_input) as x);
  if cardinality(v_unique) <> cardinality(v_input) then
    raise exception 'duplicate_driver';
  end if;
  if p_principal is not null and p_principal = any (v_unique) then
    raise exception 'duplicate_driver';
  end if;

  select max_additional_drivers into v_max from public.get_departure_policy(v_rental.agency_id);
  if cardinality(v_unique) > v_max then
    raise exception 'too_many_additional_drivers';
  end if;

  delete from public.rental_additional_drivers where rental_id = p_rental_id;
  update public.rentals set driver_id = p_principal where id = p_rental_id;
  insert into public.rental_additional_drivers (rental_id, driver_id, agency_id)
  select p_rental_id, x, v_rental.agency_id from unnest(v_unique) as x;
end;
$$;

revoke all on function public.set_rental_drivers(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.set_rental_drivers(uuid, uuid, uuid[]) to authenticated;

-- ==================================================================
-- 4. Vérification avant départ
-- ==================================================================

create table public.rental_departure_confirmations (
  rental_id uuid primary key references public.rentals (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  confirmed_by uuid not null references auth.users (id),
  confirmed_by_name text,
  confirmed_at timestamptz not null default now(),
  -- Empreinte de l'état vérifié : si un document ou un conducteur change ensuite,
  -- la confirmation est signalée « périmée » et doit être refaite.
  state_hash text not null,
  snapshot jsonb not null
);

alter table public.rental_departure_confirmations enable row level security;

create policy "rental_departure_confirmations_select" on public.rental_departure_confirmations
  for select using (public.can_access_rental(rental_id));
create policy "rental_departure_confirmations_insert" on public.rental_departure_confirmations
  for insert with check (public.can_access_rental(rental_id) and confirmed_by = auth.uid());
create policy "rental_departure_confirmations_update" on public.rental_departure_confirmations
  for update using (public.can_access_rental(rental_id) and confirmed_by = auth.uid());

create or replace function public.rental_departure_check(p_rental_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  r record;
  pol public.agency_departure_policies;
  rec record;
  doc record;
  docs jsonb;
  issues jsonb;
  parties jsonb := '[]'::jsonb;
  blocking int := 0;
  warnings int := 0;
  conf record;
  v_hash text;
  v_confirmed boolean := false;
  v_stale boolean := false;
  v_ok boolean;
  v_end date;
begin
  select id, agency_id, customer_id, driver_id, date_fin_prevue into r
  from public.rentals where id = p_rental_id;
  if r.id is null then
    raise exception 'rental_not_found';
  end if;

  pol := public.get_departure_policy(r.agency_id);
  v_end := (r.date_fin_prevue at time zone 'UTC')::date;

  for rec in
    select 1 as ord, 'client'::text as kind, c.id::text as key, c.nom_complet as name,
           (r.driver_id is null) as is_driver, c.id as doc_customer_id, null::uuid as doc_driver_id
    from public.customers c where c.id = r.customer_id
    union all
    select 2, 'conducteur_principal', d.id::text, d.nom_complet, true,
           d.linked_customer_id, case when d.linked_customer_id is null then d.id end
    from public.drivers d where d.id = r.driver_id
    union all
    select 3, 'conducteur_supplementaire', d.id::text, d.nom_complet, true,
           d.linked_customer_id, case when d.linked_customer_id is null then d.id end
    from public.rental_additional_drivers a
    join public.drivers d on d.id = a.driver_id
    where a.rental_id = r.id
    order by 1, 4
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', cd.id, 'type', cd.doc_type, 'expires_at', cd.expires_at,
             'has_file', cd.file_path is not null, 'updated_at', cd.updated_at
           ) order by cd.created_at, cd.id), '[]'::jsonb)
    into docs
    from public.customer_documents cd
    where cd.deleted_at is null
      and ((rec.doc_customer_id is not null and cd.customer_id = rec.doc_customer_id)
        or (rec.doc_driver_id is not null and cd.driver_id = rec.doc_driver_id));

    issues := '[]'::jsonb;

    -- Permis de conduire de chaque conducteur (le client lui-même s'il conduit).
    if rec.is_driver then
      select cd.id, cd.expires_at, cd.file_path into doc
      from public.customer_documents cd
      where cd.deleted_at is null and cd.doc_type = 'permis'
        and ((rec.doc_customer_id is not null and cd.customer_id = rec.doc_customer_id)
          or (rec.doc_driver_id is not null and cd.driver_id = rec.doc_driver_id))
      order by cd.expires_at desc nulls last, cd.created_at desc
      limit 1;

      if doc.id is null then
        issues := issues || jsonb_build_array(jsonb_build_object(
          'code', 'licence_missing',
          'severity', case when pol.require_driver_licence then 'blocking' else 'warning' end));
      else
        if doc.file_path is null then
          issues := issues || jsonb_build_array(jsonb_build_object('code', 'licence_no_file', 'severity', 'warning'));
        end if;
        if doc.expires_at is null then
          issues := issues || jsonb_build_array(jsonb_build_object('code', 'licence_expiry_unknown', 'severity', 'warning'));
        elsif doc.expires_at < current_date then
          issues := issues || jsonb_build_array(jsonb_build_object(
            'code', 'licence_expired',
            'severity', case when pol.require_driver_licence then 'blocking' else 'warning' end));
        elsif doc.expires_at < v_end then
          issues := issues || jsonb_build_array(jsonb_build_object(
            'code', 'licence_expires_before_end',
            'severity', case when pol.require_licence_valid_until_end then 'blocking' else 'warning' end));
        end if;
      end if;
    end if;

    -- Pièce d'identité (CIN ou passeport) du client contractuel.
    if rec.kind = 'client' then
      select cd.id, cd.expires_at into doc
      from public.customer_documents cd
      where cd.deleted_at is null and cd.doc_type in ('cin', 'passeport')
        and cd.customer_id = rec.doc_customer_id
      order by cd.expires_at desc nulls last, cd.created_at desc
      limit 1;

      if doc.id is null then
        issues := issues || jsonb_build_array(jsonb_build_object(
          'code', 'id_missing',
          'severity', case when pol.require_customer_id_document then 'blocking' else 'warning' end));
      elsif doc.expires_at is not null and doc.expires_at < current_date then
        issues := issues || jsonb_build_array(jsonb_build_object(
          'code', 'id_expired',
          'severity', case when pol.require_customer_id_document then 'blocking' else 'warning' end));
      elsif doc.expires_at is not null and doc.expires_at < v_end then
        issues := issues || jsonb_build_array(jsonb_build_object('code', 'id_expires_before_end', 'severity', 'warning'));
      end if;
    end if;

    blocking := blocking + (select count(*) from jsonb_array_elements(issues) i where i ->> 'severity' = 'blocking');
    warnings := warnings + (select count(*) from jsonb_array_elements(issues) i where i ->> 'severity' = 'warning');

    parties := parties || jsonb_build_array(jsonb_build_object(
      'key', rec.key, 'kind', rec.kind, 'name', rec.name, 'is_driver', rec.is_driver,
      'documents', docs, 'issues', issues));
  end loop;

  v_hash := md5(parties::text);

  select * into conf from public.rental_departure_confirmations where rental_id = p_rental_id;
  if conf.rental_id is not null then
    v_confirmed := true;
    v_stale := conf.state_hash is distinct from v_hash;
  end if;

  v_ok := blocking = 0
          and (not pol.require_manual_confirmation or (v_confirmed and not v_stale));

  return jsonb_build_object(
    'rental_id', p_rental_id,
    'policy', jsonb_build_object(
      'block_departure', pol.block_departure,
      'require_customer_id_document', pol.require_customer_id_document,
      'require_driver_licence', pol.require_driver_licence,
      'require_licence_valid_until_end', pol.require_licence_valid_until_end,
      'require_manual_confirmation', pol.require_manual_confirmation,
      'confirmation_role', pol.confirmation_role,
      'max_additional_drivers', pol.max_additional_drivers),
    'parties', parties,
    'blocking_count', blocking,
    'warning_count', warnings,
    'confirmation', jsonb_build_object(
      'confirmed', v_confirmed,
      'stale', v_stale,
      'confirmed_by_name', conf.confirmed_by_name,
      'confirmed_at', conf.confirmed_at),
    'state_hash', v_hash,
    'enforced', pol.block_departure,
    'ok', v_ok,
    'can_depart', (not pol.block_departure) or v_ok
  );
end;
$$;

revoke all on function public.rental_departure_check(uuid) from public, anon;
grant execute on function public.rental_departure_check(uuid) to authenticated;

create or replace function public.confirm_rental_departure_check(p_rental_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r record;
  pol public.agency_departure_policies;
  v_role public.agency_role;
  v_check jsonb;
begin
  select id, agency_id, statut into r from public.rentals where id = p_rental_id;
  if r.id is null then
    raise exception 'rental_not_found';
  end if;
  if r.statut not in ('confirmee', 'reservee') then
    raise exception 'rental_not_ready_for_departure';
  end if;

  pol := public.get_departure_policy(r.agency_id);
  v_role := public.agency_role_of(r.agency_id);
  if v_role is null then
    raise exception 'not_allowed';
  end if;
  if pol.confirmation_role = 'manager' and v_role not in ('owner', 'manager') then
    raise exception 'confirmation_requires_manager';
  end if;

  v_check := public.rental_departure_check(p_rental_id);
  if (v_check ->> 'blocking_count')::int > 0 then
    raise exception 'departure_requirements_not_met';
  end if;

  insert into public.rental_departure_confirmations
    (rental_id, agency_id, confirmed_by, confirmed_by_name, confirmed_at, state_hash, snapshot)
  values
    (p_rental_id, r.agency_id, auth.uid(), public.member_display_name(r.agency_id, auth.uid()),
     now(), v_check ->> 'state_hash', v_check)
  on conflict (rental_id) do update
    set confirmed_by = excluded.confirmed_by,
        confirmed_by_name = excluded.confirmed_by_name,
        confirmed_at = excluded.confirmed_at,
        state_hash = excluded.state_hash,
        snapshot = excluded.snapshot;

  return public.rental_departure_check(p_rental_id);
end;
$$;

revoke all on function public.confirm_rental_departure_check(uuid) from public, anon;
grant execute on function public.confirm_rental_departure_check(uuid) to authenticated;

-- ==================================================================
-- 5. Le départ vérifie la liste de contrôle (corps de 0015 + contrôle)
-- ==================================================================

create or replace function public.start_rental_with_contract(
  p_rental_id uuid,
  p_contract_id uuid,
  p_km_depart int,
  p_carburant_depart int,
  p_etat_depart public.vehicle_condition,
  p_accessoires_depart jsonb,
  p_observations_depart text
)
returns void
language plpgsql
as $$
declare
  v_rental record;
  v_contract record;
  v_check jsonb;
begin
  select id, vehicle_id, statut into v_rental from public.rentals where id = p_rental_id;
  if v_rental is null then
    raise exception 'rental_not_found';
  end if;
  if v_rental.statut not in ('confirmee', 'reservee') then
    raise exception 'rental_departure_already_recorded_or_invalid_state: %', v_rental.statut;
  end if;

  select id, statut into v_contract from public.contracts where id = p_contract_id and rental_id = p_rental_id;
  if v_contract is null then
    raise exception 'contract_not_found_for_rental';
  end if;
  if v_contract.statut <> 'signe' then
    raise exception 'contract_not_signed: %', v_contract.statut;
  end if;

  -- Exigences de l'agence (politique de départ) : bloquant seulement si l'agence l'a activé.
  v_check := public.rental_departure_check(p_rental_id);
  if (v_check ->> 'enforced')::boolean and not (v_check ->> 'ok')::boolean then
    raise exception 'departure_requirements_not_met';
  end if;

  update public.rentals
  set statut = 'en_cours', date_depart_reel = now(), km_depart = p_km_depart, carburant_depart = p_carburant_depart
  where id = p_rental_id;

  update public.vehicles
  set statut = 'en_location', kilometrage = p_km_depart
  where id = v_rental.vehicle_id;

  update public.contracts
  set statut = 'en_cours', etat_depart = p_etat_depart, accessoires_depart = p_accessoires_depart, observations_depart = p_observations_depart
  where id = p_contract_id;
end;
$$;

-- ==================================================================
-- 6. Contrat : instantané des conducteurs supplémentaires
-- ==================================================================

alter table public.contracts
  add column autres_conducteurs text[] not null default '{}';
