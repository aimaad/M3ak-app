-- M3ak — obligations réglementaires d'un véhicule : assurance, visite technique, vignette (taxe spéciale annuelle).
--
-- Une ligne = UNE période couverte (ex. assurance du 15/11/2026 au 14/11/2027). Un renouvellement AJOUTE une ligne : l'historique est
-- conservé (n° de police ou de quittance, assureur ou centre, montant, photo du papier). La période EN COURS d'un véhicule est la ligne
-- de ce type dont la fin est la plus lointaine.
--
-- Droits : voir et ajouter (renouveler) = tout membre qui a accès au véhicule (même isolation par filiale que le reste) ;
-- corriger ou supprimer une ligne = propriétaire et responsable. Un employé ne peut donc pas effacer une trace.
-- Les montants ne sont affichés qu'au propriétaire par l'application (comme les prix).

create table if not exists public.vehicle_compliance (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  kind text not null check (kind in ('assurance', 'visite_technique', 'vignette')),
  valid_from date,
  valid_until date not null,
  reference text check (reference is null or char_length(reference) <= 80),
  provider text check (provider is null or char_length(provider) <= 120),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  document_path text,
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (valid_from is null or valid_from <= valid_until),
  -- Un même renouvellement envoyé deux fois (double appui, mauvaise connexion) ne crée pas de doublon.
  unique (vehicle_id, kind, valid_until)
);

create index if not exists vehicle_compliance_vehicle_idx on public.vehicle_compliance (vehicle_id, kind, valid_until desc);
create index if not exists vehicle_compliance_agency_until_idx on public.vehicle_compliance (agency_id, valid_until);

-- L'agence d'une ligne est TOUJOURS celle du véhicule (jamais celle envoyée par le client) ; l'auteur est l'utilisateur connecté.
create or replace function public.vehicle_compliance_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
begin
  if TG_OP = 'UPDATE' then
    -- On ne déplace pas une ligne vers un autre véhicule (ni donc une autre agence), et on ne réécrit pas l'auteur.
    NEW.vehicle_id := OLD.vehicle_id;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  end if;
  select agency_id into v_agency from public.vehicles where id = NEW.vehicle_id;
  if v_agency is null then
    raise exception 'vehicle_not_found';
  end if;
  NEW.agency_id := v_agency;
  if TG_OP = 'INSERT' then
    NEW.created_by := coalesce(NEW.created_by, auth.uid());
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_vehicle_compliance_before_write on public.vehicle_compliance;
create trigger trg_vehicle_compliance_before_write
  before insert or update on public.vehicle_compliance
  for each row execute function public.vehicle_compliance_before_write();

-- Cohérence avec le reste de l'application : « À surveiller » de Ma Flotte, le chat et les rappels d'entretien lisent encore
--   (a) les dates d'expiration des documents du véhicule (assurance, visite technique) et
--   (b) les échéances d'entretien de même type.
-- À chaque ajout, correction ou suppression d'une période, ces deux endroits sont remis d'accord avec la période EN COURS (la plus
-- lointaine), dans la même transaction : l'ancienne échéance ouverte est remplacée, la date du document suit, la photo suit si elle existe.
-- La vignette n'existe pas dans ces anciens écrans : rien à synchroniser.
create or replace function public.vehicle_compliance_resync(p_vehicle uuid, p_kind text, p_agency uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest public.vehicle_compliance;
  v_path text;
begin
  if p_kind not in ('assurance', 'visite_technique') then
    return;
  end if;

  select * into v_latest from public.vehicle_compliance
  where vehicle_id = p_vehicle and kind = p_kind
  order by valid_until desc, created_at desc
  limit 1;

  -- Plus aucune période (tout supprimé) : on ne touche à rien, l'existant reste tel quel.
  if v_latest.id is null then
    return;
  end if;

  delete from public.maintenance_items
  where vehicle_id = p_vehicle and type::text = p_kind and statut::text in ('a_venir', 'due', 'en_retard');
  insert into public.maintenance_items (agency_id, vehicle_id, type, echeance_date, statut)
  values (p_agency, p_vehicle, p_kind::public.maintenance_type, v_latest.valid_until, 'a_venir');

  select d ->> 'path' into v_path
  from public.vehicles v, jsonb_array_elements(case when jsonb_typeof(v.documents) = 'array' then v.documents else '[]'::jsonb end) d
  where v.id = p_vehicle and d ->> 'type' = p_kind
  limit 1;
  v_path := coalesce(v_latest.document_path, v_path);

  if v_path is not null then
    update public.vehicles v
    set documents = coalesce((
          select jsonb_agg(d) from jsonb_array_elements(case when jsonb_typeof(v.documents) = 'array' then v.documents else '[]'::jsonb end) d
          where d ->> 'type' <> p_kind), '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object('type', p_kind, 'path', v_path, 'uploadedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'expiresAt', v_latest.valid_until))
    where v.id = p_vehicle;
  end if;
end;
$$;

revoke all on function public.vehicle_compliance_resync(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.vehicle_compliance_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.vehicle_compliance_resync(coalesce(NEW.vehicle_id, OLD.vehicle_id), coalesce(NEW.kind, OLD.kind), coalesce(NEW.agency_id, OLD.agency_id));
  return null;
end;
$$;

drop trigger if exists trg_vehicle_compliance_sync on public.vehicle_compliance;
create trigger trg_vehicle_compliance_sync
  after insert or update or delete on public.vehicle_compliance
  for each row execute function public.vehicle_compliance_sync();

alter table public.vehicle_compliance enable row level security;

drop policy if exists "vehicle_compliance_select" on public.vehicle_compliance;
create policy "vehicle_compliance_select" on public.vehicle_compliance
  for select using (public.can_access_vehicle(vehicle_id));

drop policy if exists "vehicle_compliance_insert" on public.vehicle_compliance;
create policy "vehicle_compliance_insert" on public.vehicle_compliance
  for insert with check (public.can_access_vehicle(vehicle_id));

drop policy if exists "vehicle_compliance_update" on public.vehicle_compliance;
create policy "vehicle_compliance_update" on public.vehicle_compliance
  for update using (public.can_access_vehicle(vehicle_id) and public.is_agency_manager(agency_id))
  with check (public.can_access_vehicle(vehicle_id) and public.is_agency_manager(agency_id));

drop policy if exists "vehicle_compliance_delete" on public.vehicle_compliance;
create policy "vehicle_compliance_delete" on public.vehicle_compliance
  for delete using (public.can_access_vehicle(vehicle_id) and public.is_agency_manager(agency_id));

grant select, insert, update, delete on public.vehicle_compliance to authenticated;

-- Réglages de l'agence : périodicité de la visite technique (6 mois par défaut pour la location ; à régler selon ce que dit le centre
-- de visite agréé de l'agence, la règle pouvant évoluer).
create table if not exists public.agency_compliance_settings (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  visit_interval_months smallint not null default 6 check (visit_interval_months between 1 and 36),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.agency_compliance_settings enable row level security;

drop policy if exists "agency_compliance_settings_select" on public.agency_compliance_settings;
create policy "agency_compliance_settings_select" on public.agency_compliance_settings
  for select using (public.is_agency_member(agency_id));

drop policy if exists "agency_compliance_settings_insert" on public.agency_compliance_settings;
create policy "agency_compliance_settings_insert" on public.agency_compliance_settings
  for insert with check (public.is_agency_manager(agency_id));

drop policy if exists "agency_compliance_settings_update" on public.agency_compliance_settings;
create policy "agency_compliance_settings_update" on public.agency_compliance_settings
  for update using (public.is_agency_manager(agency_id)) with check (public.is_agency_manager(agency_id));

grant select, insert, update on public.agency_compliance_settings to authenticated;

-- Reprise de l'existant (rejouable). La synchronisation est suspendue pendant la reprise (sinon elle réécrirait les documents et les
-- échéances AVANT qu'on les lise) puis rejouée une fois pour chaque véhicule et chaque type.
alter table public.vehicle_compliance disable trigger trg_vehicle_compliance_sync;

insert into public.vehicle_compliance (agency_id, vehicle_id, kind, valid_until)
select mi.agency_id, mi.vehicle_id, mi.type::text, mi.echeance_date
from public.maintenance_items mi
where mi.type::text in ('assurance', 'visite_technique')
  and mi.statut::text not in ('effectuee')
  and mi.echeance_date is not null
on conflict (vehicle_id, kind, valid_until) do nothing;

insert into public.vehicle_compliance (agency_id, vehicle_id, kind, valid_until, document_path)
select v.agency_id, v.id, d ->> 'type', left(d ->> 'expiresAt', 10)::date, d ->> 'path'
from public.vehicles v
cross join lateral jsonb_array_elements(case when jsonb_typeof(v.documents) = 'array' then v.documents else '[]'::jsonb end) d
where d ->> 'type' in ('assurance', 'visite_technique')
  and (d ->> 'expiresAt') ~ '^\d{4}-\d{2}-\d{2}'
on conflict (vehicle_id, kind, valid_until) do update
  set document_path = coalesce(public.vehicle_compliance.document_path, excluded.document_path);

alter table public.vehicle_compliance enable trigger trg_vehicle_compliance_sync;

do $$
declare
  r record;
begin
  for r in select distinct vehicle_id, kind, agency_id from public.vehicle_compliance where kind in ('assurance', 'visite_technique') loop
    perform public.vehicle_compliance_resync(r.vehicle_id, r.kind, r.agency_id);
  end loop;
end;
$$;
