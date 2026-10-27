-- M3ak — Chat M3ak : l'employé pose une question (français, arabe, darija) et M3ak répond À PARTIR DES DONNÉES DE L'AGENCE.
--
-- Principes :
--   * l'IA (Gemini, clé de l'entreprise) ne lit JAMAIS la base : elle demande des « outils » prédéfinis (fonctions ci-dessous)
--     qui s'exécutent avec les DROITS DE L'UTILISATEUR (security invoker : la protection RLS par entreprise et par filiale
--     s'applique donc exactement comme dans l'app) ;
--   * jamais d'écriture : le chat ne crée ni ne modifie rien ;
--   * ni CIN, ni numéro de permis, ni photo dans les résultats ; nom et téléphone du client seulement (l'utilisateur les voit déjà) ;
--   * accord du PROPRIÉTAIRE obligatoire (chat_enabled, éteint par défaut, impossible sans clé) ;
--   * historique par utilisateur (personne d'autre ne le voit, pas même le propriétaire), effacé après 90 jours.

-- ==================================================================
-- Accord du propriétaire
-- ==================================================================

alter table public.agency_ocr_settings add column if not exists chat_enabled boolean not null default false;

create or replace function public.ocr_settings_before_write()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.gemini_api_key is null then
    new.cloud_enabled := false;
    new.insights_enabled := false;
    new.chat_enabled := false;
  end if;
  return new;
end;
$$;

create or replace function public.get_ocr_settings(p_agency_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  settings public.agency_ocr_settings;
begin
  if not public.is_agency_member(p_agency_id) then
    raise exception 'not_allowed';
  end if;
  select * into settings from public.agency_ocr_settings where agency_id = p_agency_id;
  return jsonb_build_object(
    'cloud_available', coalesce(settings.gemini_api_key is not null, false),
    'cloud_enabled', coalesce(settings.cloud_enabled and settings.gemini_api_key is not null, false),
    'insights_enabled', coalesce(settings.insights_enabled and settings.gemini_api_key is not null, false),
    'chat_enabled', coalesce(settings.chat_enabled and settings.gemini_api_key is not null, false)
  );
end;
$$;

create or replace function public.set_ai_chat_enabled(p_agency_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.agency_role_of(p_agency_id) is distinct from 'owner' then
    raise exception 'not_allowed';
  end if;
  if p_enabled and not exists (
    select 1 from public.agency_ocr_settings where agency_id = p_agency_id and gemini_api_key is not null
  ) then
    raise exception 'ocr_key_missing';
  end if;
  update public.agency_ocr_settings set chat_enabled = p_enabled where agency_id = p_agency_id;
  return public.get_ocr_settings(p_agency_id);
end;
$$;

revoke all on function public.set_ai_chat_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_ai_chat_enabled(uuid, boolean) to authenticated;

-- Suivi d'utilisation : les questions du chat comptent (compteurs seulement, jamais le texte).
alter table public.ocr_usage_events drop constraint if exists ocr_usage_events_document_type_check;
alter table public.ocr_usage_events
  add constraint ocr_usage_events_document_type_check check (document_type in ('permis', 'carte_grise', 'insights', 'contrat_modele', 'chat'));

-- Console web : « analyses » = documents lus ; « rapports IA » = recommandations ; « questions chat » à part.
create or replace function public.admin_ocr_overview(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  pricing public.platform_ocr_pricing;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;
  select * into pricing from public.platform_ocr_pricing where id = 1;

  return jsonb_build_object(
    'pricing', jsonb_build_object(
      'input_usd_per_million', pricing.input_usd_per_million,
      'output_usd_per_million', pricing.output_usd_per_million,
      'usd_to_mad', pricing.usd_to_mad
    ),
    'agencies', coalesce((
      select jsonb_agg(row_json order by nom)
      from (
        select
          a.nom,
          jsonb_build_object(
            'agency_id', a.id,
            'nom', a.nom,
            'ville', a.ville,
            'created_at', a.created_at,
            'members', (select count(*) from public.agency_members m where m.agency_id = a.id),
            'key_set', s.gemini_api_key is not null,
            'key_last4', case when s.gemini_api_key is not null then right(s.gemini_api_key, 4) end,
            'key_tier', coalesce(s.key_tier, 'free'),
            'cloud_enabled', coalesce(s.cloud_enabled and s.gemini_api_key is not null, false),
            'insights_enabled', coalesce(s.insights_enabled and s.gemini_api_key is not null, false),
            'key_updated_at', s.key_updated_at,
            'scans', coalesce(u.scans, 0),
            'scans_ok', coalesce(u.scans_ok, 0),
            'scans_failed', coalesce(u.scans_failed, 0),
            'insights_calls', coalesce(u.insights_calls, 0),
            'chat_calls', coalesce(u.chat_calls, 0),
            'input_tokens', coalesce(u.input_tokens, 0),
            'output_tokens', coalesce(u.output_tokens, 0),
            'last_scan_at', u.last_scan_at,
            'cost_usd', case
              when coalesce(s.key_tier, 'free') = 'free' then 0
              when pricing.input_usd_per_million is null or pricing.output_usd_per_million is null then null
              else round((coalesce(u.input_tokens, 0) * pricing.input_usd_per_million
                        + coalesce(u.output_tokens, 0) * pricing.output_usd_per_million) / 1000000.0, 4)
            end
          ) as row_json
        from public.agencies a
        left join public.agency_ocr_settings s on s.agency_id = a.id
        left join lateral (
          select count(*) filter (where e.document_type not in ('insights', 'chat')) as scans,
                 count(*) filter (where e.document_type not in ('insights', 'chat') and e.ok) as scans_ok,
                 count(*) filter (where e.document_type not in ('insights', 'chat') and not e.ok) as scans_failed,
                 count(*) filter (where e.document_type = 'insights') as insights_calls,
                 count(*) filter (where e.document_type = 'chat') as chat_calls,
                 sum(e.input_tokens) as input_tokens,
                 sum(e.output_tokens) as output_tokens,
                 max(e.created_at) as last_scan_at
          from public.ocr_usage_events e
          where e.agency_id = a.id
            and (p_from is null or e.created_at >= p_from)
            and (p_to is null or e.created_at < p_to)
        ) u on true
      ) t
    ), '[]'::jsonb)
  );
end;
$$;


-- ==================================================================
-- Historique des conversations (par utilisateur)
-- ==================================================================

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chat_conversations_user_idx on public.chat_conversations (user_id, updated_at desc);

create table if not exists public.chat_convo_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 6000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array' and pg_column_size(sources) <= 4000),
  created_at timestamptz not null default now()
);
create index if not exists chat_convo_messages_conversation_idx on public.chat_convo_messages (conversation_id, created_at);

alter table public.chat_conversations enable row level security;
alter table public.chat_convo_messages enable row level security;

drop policy if exists "chat_conversations_own" on public.chat_conversations;
create policy "chat_conversations_own" on public.chat_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_agency_member(agency_id));
drop policy if exists "chat_convo_messages_own" on public.chat_convo_messages;
create policy "chat_convo_messages_own" on public.chat_convo_messages
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_agency_member(agency_id)
              and exists (select 1 from public.chat_conversations c where c.id = conversation_id and c.user_id = auth.uid()));

-- Ménage : les conversations de plus de 90 jours sont effacées (appelé avec les rappels de notifications).
create or replace function public.purge_old_chat()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.chat_conversations where updated_at < now() - interval '90 days';
$$;
revoke all on function public.purge_old_chat() from public, anon, authenticated;

-- ==================================================================
-- Outils du chat (lecture seule, droits de l'utilisateur : RLS entreprise + filiale)
-- ==================================================================

create or replace function public.chat_clean(p_text text)
returns text
language sql
immutable
as $$ select nullif(btrim(left(coalesce(p_text, ''), 60)), '') $$;

create or replace function public.chat_tool_rentals(p_from timestamptz, p_to timestamptz, p_vehicle text default null, p_customer text default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.start), '[]'::jsonb)
  from (
    select r.id as rental_id, r.numero, r.statut::text as status,
           trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate,
           c.nom_complet as customer, c.telephone as phone,
           r.date_debut_prevue as start, r.date_fin_prevue as "end",
           r.date_depart_reel as picked_up_at, r.date_retour_reel as returned_at,
           bd.nom as branch_departure, br.nom as branch_return
    from public.rentals r
    join public.vehicles v on v.id = r.vehicle_id
    join public.customers c on c.id = r.customer_id
    left join public.branches bd on bd.id = r.branch_depart_id
    left join public.branches br on br.id = r.branch_retour_id
    where r.statut::text <> 'annulee'
      and tstzrange(r.date_debut_prevue, r.date_fin_prevue, '[]') && tstzrange(coalesce(p_from, '-infinity'), coalesce(p_to, 'infinity'), '[]')
      and (public.chat_clean(p_vehicle) is null or v.immatriculation ilike '%' || public.chat_clean(p_vehicle) || '%' or (v.marque || ' ' || v.modele) ilike '%' || public.chat_clean(p_vehicle) || '%')
      and (public.chat_clean(p_customer) is null or c.nom_complet ilike '%' || public.chat_clean(p_customer) || '%')
    order by r.date_debut_prevue
    limit 25
  ) t;
$$;

create or replace function public.chat_tool_returns_due(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t."end"), '[]'::jsonb)
  from (
    select r.id as rental_id, r.numero, trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate,
           c.nom_complet as customer, c.telephone as phone, r.date_fin_prevue as "end", br.nom as branch_return
    from public.rentals r
    join public.vehicles v on v.id = r.vehicle_id
    join public.customers c on c.id = r.customer_id
    left join public.branches br on br.id = coalesce(r.branch_retour_id, v.branch_id)
    where r.statut::text = 'en_cours'
      and r.date_fin_prevue >= coalesce(p_from, '-infinity') and r.date_fin_prevue <= coalesce(p_to, 'infinity')
    order by r.date_fin_prevue
    limit 25
  ) t;
$$;

create or replace function public.chat_tool_departures_due(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.start), '[]'::jsonb)
  from (
    select r.id as rental_id, r.numero, trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate,
           c.nom_complet as customer, c.telephone as phone, r.date_debut_prevue as start, r.statut::text as status
    from public.rentals r
    join public.vehicles v on v.id = r.vehicle_id
    join public.customers c on c.id = r.customer_id
    where r.statut::text in ('reservee', 'en_attente_confirmation', 'confirmee')
      and r.date_debut_prevue >= coalesce(p_from, '-infinity') and r.date_debut_prevue <= coalesce(p_to, 'infinity')
    order by r.date_debut_prevue
    limit 25
  ) t;
$$;

create or replace function public.chat_tool_available_vehicles(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.vehicle), '[]'::jsonb)
  from (
    select v.id as vehicle_id, trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate,
           v.prix_jour as price_per_day, b.nom as branch
    from public.vehicles v
    left join public.branches b on b.id = v.branch_id
    where v.archived_at is null
      and v.statut::text not in ('maintenance', 'indisponible', 'en_preparation')
      and not exists (
        select 1 from public.rentals r
        where r.vehicle_id = v.id and r.statut::text in ('reservee', 'confirmee', 'en_cours')
          and tstzrange(r.date_debut_prevue, r.date_fin_prevue, '[)') && tstzrange(coalesce(p_from, now()), coalesce(p_to, coalesce(p_from, now()) + interval '1 hour'), '[)')
      )
    order by 2
    limit 40
  ) t;
$$;

create or replace function public.chat_tool_vehicle_damages(p_vehicle text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.found_at desc), '[]'::jsonb)
  from (
    select d.id as damage_id, trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate,
           d.zone::text as zone, d.type::text as damage_type, d.gravite::text as severity, d.description,
           d.statut as review_status, d.nouveau as new_since_departure, d.cout_valide as validated_cost, d.cout_estime as estimated_cost,
           i.type::text as inspection_type, i.date_inspection as found_at, i.id as inspection_id,
           r.id as rental_id, r.numero as rental_number, c.nom_complet as customer, c.telephone as phone,
           r.date_debut_prevue as rental_start, r.date_fin_prevue as rental_end
    from public.damages d
    join public.inspections i on i.id = d.inspection_id
    join public.vehicles v on v.id = i.vehicle_id
    join public.rentals r on r.id = i.rental_id
    join public.customers c on c.id = r.customer_id
    where public.chat_clean(p_vehicle) is not null
      and (v.immatriculation ilike '%' || public.chat_clean(p_vehicle) || '%' or (v.marque || ' ' || v.modele) ilike '%' || public.chat_clean(p_vehicle) || '%')
      and coalesce(d.statut, 'propose') <> 'rejete'
    order by i.date_inspection desc
    limit 30
  ) t;
$$;

create or replace function public.chat_tool_vehicle_maintenance(p_vehicle text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.due_date), '[]'::jsonb)
  from (
    select trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate, m.type::text as kind,
           m.statut::text as status, m.echeance_date as due_date, m.echeance_km as due_km, v.kilometrage as current_km
    from public.maintenance_items m
    join public.vehicles v on v.id = m.vehicle_id
    where public.chat_clean(p_vehicle) is not null
      and (v.immatriculation ilike '%' || public.chat_clean(p_vehicle) || '%' or (v.marque || ' ' || v.modele) ilike '%' || public.chat_clean(p_vehicle) || '%')
    order by m.echeance_date nulls last
    limit 30
  ) t;
$$;

create or replace function public.chat_tool_customer_history(p_customer text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.start desc), '[]'::jsonb)
  from (
    select c.nom_complet as customer, c.telephone as phone, r.id as rental_id, r.numero, r.statut::text as status,
           trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate,
           r.date_debut_prevue as start, r.date_fin_prevue as "end", r.prix_total as total_price,
           coalesce((select sum(p.montant) from public.payments p where p.rental_id = r.id and p.statut::text = 'paye'), 0) as paid
    from public.customers c
    join public.rentals r on r.customer_id = c.id
    join public.vehicles v on v.id = r.vehicle_id
    where public.chat_clean(p_customer) is not null
      and (c.nom_complet ilike '%' || public.chat_clean(p_customer) || '%' or c.telephone ilike '%' || public.chat_clean(p_customer) || '%')
    order by r.date_debut_prevue desc
    limit 20
  ) t;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'chat_tool_rentals(timestamptz, timestamptz, text, text)',
    'chat_tool_returns_due(timestamptz, timestamptz)',
    'chat_tool_departures_due(timestamptz, timestamptz)',
    'chat_tool_available_vehicles(timestamptz, timestamptz)',
    'chat_tool_vehicle_damages(text)',
    'chat_tool_vehicle_maintenance(text)',
    'chat_tool_customer_history(text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;

-- Ménage quotidien de l'historique (3 h du matin) si pg_cron est disponible.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
      perform cron.unschedule('m3ak_chat_purge') from cron.job where jobname = 'm3ak_chat_purge';
      perform cron.schedule('m3ak_chat_purge', '0 3 * * *', 'select public.purge_old_chat()');
    exception when others then
      raise notice 'pg_cron non activé (%) : la purge de l''historique du chat n''est pas programmée', sqlerrm;
    end;
  end if;
end
$$;
