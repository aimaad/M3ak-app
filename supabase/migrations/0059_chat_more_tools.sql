-- M3ak — Chat : 5 outils de plus (finances, alertes flotte, statistiques, activité, contrats).
-- Tous en lecture seule, avec les droits de l'utilisateur (security invoker : RLS, filiales, accès expiré respectés).
--   * finances et chiffre d'affaires : propriétaire uniquement (comme le tableau de bord de l'app) ;
--   * journal d'activité : propriétaire uniquement (RLS du journal) ;
--   * jamais de CIN, de permis, de photo ni de chemin de signature : seulement « signé / non signé ».

create or replace function public.chat_is_owner()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (select 1 from public.agency_members m where m.user_id = auth.uid() and m.role = 'owner' and public.agency_has_access(m.agency_id));
$$;

-- ==================================================================
-- Finances : encaissé, en attente, impayés, cautions (propriétaire)
-- ==================================================================
create or replace function public.chat_tool_finance(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_from timestamptz := coalesce(p_from, date_trunc('month', now()));
  v_to timestamptz := coalesce(p_to, now());
  v_result jsonb;
begin
  if not public.chat_is_owner() then
    return jsonb_build_object('error', 'owner_only');
  end if;

  select jsonb_build_object(
    'period_from', v_from,
    'period_to', v_to,
    'collected', coalesce((
      select sum(p.montant) from public.payments p join public.rentals r on r.id = p.rental_id
      where p.statut::text = 'paye' and p.date_paiement >= v_from and p.date_paiement < v_to), 0),
    'pending_payments', coalesce((
      select sum(p.montant) from public.payments p join public.rentals r on r.id = p.rental_id
      where p.statut::text = 'en_attente'), 0),
    'refunded', coalesce((
      select sum(p.montant) from public.payments p join public.rentals r on r.id = p.rental_id
      where p.statut::text = 'rembourse' and p.date_paiement >= v_from and p.date_paiement < v_to), 0),
    'booked_revenue', coalesce((
      select sum(r.prix_total) from public.rentals r
      where r.statut::text <> 'annulee' and r.date_debut_prevue >= v_from and r.date_debut_prevue < v_to), 0),
    'unpaid_total', coalesce((select sum(u.balance) from (
      select r.prix_total - coalesce((select sum(p.montant) from public.payments p where p.rental_id = r.id and p.statut::text = 'paye'), 0) as balance
      from public.rentals r where r.statut::text in ('en_cours', 'terminee') and r.prix_total is not null) u where u.balance > 0), 0),
    'unpaid_rentals', coalesce((select jsonb_agg(row_to_json(t) order by t.balance desc) from (
      select r.id as rental_id, c.nom_complet as customer, trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate,
             r.statut::text as status, r.prix_total as total_price,
             r.prix_total - coalesce((select sum(p.montant) from public.payments p where p.rental_id = r.id and p.statut::text = 'paye'), 0) as balance
      from public.rentals r
      join public.customers c on c.id = r.customer_id
      join public.vehicles v on v.id = r.vehicle_id
      where r.statut::text in ('en_cours', 'terminee') and r.prix_total is not null
        and r.prix_total - coalesce((select sum(p.montant) from public.payments p where p.rental_id = r.id and p.statut::text = 'paye'), 0) > 0
      order by 7 desc
      limit 15) t), '[]'::jsonb),
    'deposits', jsonb_build_object(
      'currently_blocked', coalesce((select sum(d.montant_bloque - d.montant_retenu - d.montant_restitue) from public.deposits d
        join public.rentals r on r.id = d.rental_id where d.statut::text in ('bloquee', 'partiellement_retenue')), 0),
      'retained_in_period', coalesce((select sum(d.montant_retenu) from public.deposits d
        join public.rentals r on r.id = d.rental_id where d.montant_retenu > 0 and d.updated_at >= v_from and d.updated_at < v_to), 0),
      'retained_total', coalesce((select sum(d.montant_retenu) from public.deposits d join public.rentals r on r.id = d.rental_id), 0)
    )
  ) into v_result;
  return v_result;
end;
$$;

-- ==================================================================
-- Alertes de la flotte : assurance, visite technique, entretiens
-- ==================================================================
create or replace function public.chat_tool_fleet_alerts(p_days int default 30)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with params as (select least(greatest(coalesce(p_days, 30), 1), 365) as days),
  docs as (
    select trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate, d.value ->> 'type' as kind,
           (d.value ->> 'expiresAt')::date as due
    from public.vehicles v, jsonb_array_elements(v.documents) d
    where v.archived_at is null
      and d.value ->> 'type' in ('assurance', 'visite_technique')
      and coalesce(d.value ->> 'expiresAt', '') ~ '^\d{4}-\d{2}-\d{2}'
  ),
  maint as (
    select trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate, m.type::text as kind,
           m.echeance_date as due, m.echeance_km as due_km, v.kilometrage as current_km, m.statut::text as status
    from public.maintenance_items m join public.vehicles v on v.id = m.vehicle_id
    where v.archived_at is null and m.statut::text <> 'effectuee'
  )
  select jsonb_build_object(
    'today', current_date,
    'horizon_days', (select days from params),
    'expired_documents', coalesce((select jsonb_agg(row_to_json(x) order by x.due) from docs x where x.due < current_date), '[]'::jsonb),
    'documents_expiring_soon', coalesce((select jsonb_agg(row_to_json(x) order by x.due) from docs x, params
        where x.due >= current_date and x.due <= current_date + params.days), '[]'::jsonb),
    'maintenance_due', coalesce((select jsonb_agg(row_to_json(x) order by x.due nulls last) from maint x, params
        where x.status in ('due', 'en_retard')
           or (x.due is not null and x.due <= current_date + params.days)
           or (x.due_km is not null and x.current_km >= x.due_km)), '[]'::jsonb)
  );
$$;

-- ==================================================================
-- Statistiques : voiture la plus louée, sous-utilisées, tendance de la demande
-- ==================================================================
create or replace function public.chat_tool_fleet_stats(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_to timestamptz := coalesce(p_to, now());
  v_from timestamptz := coalesce(p_from, v_to - interval '30 days');
  v_days numeric := greatest(extract(epoch from (v_to - v_from)) / 86400, 1);
  v_prev_from timestamptz;
  v_owner boolean := public.chat_is_owner();
  v_result jsonb;
begin
  if v_from >= v_to then
    v_from := v_to - interval '30 days';
    v_days := 30;
  end if;
  v_prev_from := v_from - (v_to - v_from);

  with per_vehicle as (
    select v.id, trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate,
           count(r.id) as rentals,
           coalesce(sum(greatest(extract(epoch from (least(r.date_fin_prevue, v_to) - greatest(r.date_debut_prevue, v_from))) / 86400, 0)), 0) as rented_days,
           coalesce(sum(r.prix_total), 0) as revenue
    from public.vehicles v
    left join public.rentals r on r.vehicle_id = v.id and r.statut::text <> 'annulee'
         and r.date_debut_prevue < v_to and r.date_fin_prevue > v_from
    where v.archived_at is null
    group by v.id
  ),
  ranked as (
    select vehicle, plate, rentals, round(rented_days::numeric, 1) as rented_days,
           round(least(rented_days / v_days * 100, 100)::numeric) as utilization_pct,
           case when v_owner then revenue end as revenue
    from per_vehicle
  )
  select jsonb_build_object(
    'period_from', v_from, 'period_to', v_to,
    'vehicles_count', (select count(*) from ranked),
    'most_rented', coalesce((select jsonb_agg(row_to_json(x)) from (select * from ranked order by rentals desc, rented_days desc limit 5) x), '[]'::jsonb),
    'least_used', coalesce((select jsonb_agg(row_to_json(x)) from (select * from ranked order by rentals asc, rented_days asc limit 5) x), '[]'::jsonb),
    'never_rented_in_period', (select count(*) from ranked where rentals = 0),
    'average_utilization_pct', (select coalesce(round(avg(utilization_pct)), 0) from ranked),
    'demand', jsonb_build_object(
      'rentals_started_this_period', (select count(*) from public.rentals r where r.statut::text <> 'annulee' and r.date_debut_prevue >= v_from and r.date_debut_prevue < v_to),
      'rentals_started_previous_period', (select count(*) from public.rentals r where r.statut::text <> 'annulee' and r.date_debut_prevue >= v_prev_from and r.date_debut_prevue < v_from)
    )
  ) into v_result;
  return v_result;
end;
$$;

-- ==================================================================
-- Journal d'activité et équipe (propriétaire : RLS du journal)
-- ==================================================================
create or replace function public.chat_tool_activity(p_actor text default null, p_from timestamptz default null, p_to timestamptz default null, p_category text default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'team', coalesce((select jsonb_agg(jsonb_build_object('name', m.nom_complet, 'role', m.role::text) order by m.nom_complet) from public.agency_members m), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(row_to_json(t) order by t.at desc)
      from (
        select l.created_at as at, l.actor_name as who, l.action, l.category, l.target_label as target
        from public.agency_audit_log l
        where (public.chat_clean(p_actor) is null or l.actor_name ilike '%' || public.chat_clean(p_actor) || '%')
          and (public.chat_clean(p_category) is null or l.category = public.chat_clean(p_category))
          and l.created_at >= coalesce(p_from, now() - interval '30 days')
          and l.created_at < coalesce(p_to, now() + interval '1 day')
        order by l.created_at desc
        limit 40
      ) t
    ), '[]'::jsonb)
  );
$$;

-- ==================================================================
-- Contrats et signatures
-- ==================================================================
create or replace function public.chat_tool_contracts(p_status text default null, p_from timestamptz default null, p_to timestamptz default null, p_search text default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'by_status', coalesce((select jsonb_object_agg(s.statut, s.n) from (select c.statut::text as statut, count(*) as n from public.contracts c group by c.statut) s), '{}'::jsonb),
    'contracts', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select c.rental_id, c.numero as number, c.statut::text as status, c.customer_nom as customer,
               trim(c.vehicle_marque || ' ' || c.vehicle_modele) as vehicle, c.vehicle_immatriculation as plate,
               c.date_debut_prevue as start, c.date_fin_prevue as "end", c.prix_total as total_price,
               c.signed_at, (c.client_signature_path is not null) as client_signed, (c.agency_signature_path is not null) as agency_signed,
               c.created_at
        from public.contracts c
        where (public.chat_clean(p_status) is null or c.statut::text = public.chat_clean(p_status))
          and (p_from is null or c.date_debut_prevue >= p_from)
          and (p_to is null or c.date_debut_prevue < p_to)
          and (public.chat_clean(p_search) is null
               or c.customer_nom ilike '%' || public.chat_clean(p_search) || '%'
               or c.vehicle_immatriculation ilike '%' || public.chat_clean(p_search) || '%'
               or (c.vehicle_marque || ' ' || c.vehicle_modele) ilike '%' || public.chat_clean(p_search) || '%'
               or c.numero ilike '%' || public.chat_clean(p_search) || '%')
        order by c.created_at desc
        limit 30
      ) t
    ), '[]'::jsonb)
  );
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'chat_is_owner()',
    'chat_tool_finance(timestamptz, timestamptz)',
    'chat_tool_fleet_alerts(int)',
    'chat_tool_fleet_stats(timestamptz, timestamptz)',
    'chat_tool_activity(text, timestamptz, timestamptz, text)',
    'chat_tool_contracts(text, timestamptz, timestamptz, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end
$$;
