-- M3ak — Chat : deux outils de plus, pour répondre à « combien de clients ? », « quelles voitures j'ai ? ».
-- Lecture seule, droits de l'utilisateur (RLS : filiales et accès expiré respectés). Jamais de CIN, permis ni photo.

create or replace function public.chat_tool_customers(p_search text default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total_customers', (select count(*) from public.customers),
    'matching', (
      select count(*) from public.customers c
      where public.chat_clean(p_search) is null
         or c.nom_complet ilike '%' || public.chat_clean(p_search) || '%'
         or c.telephone ilike '%' || public.chat_clean(p_search) || '%'
    ),
    'customers', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select c.nom_complet as customer, c.telephone as phone, c.created_at,
               (select count(*) from public.rentals r where r.customer_id = c.id) as rentals_count
        from public.customers c
        where public.chat_clean(p_search) is null
           or c.nom_complet ilike '%' || public.chat_clean(p_search) || '%'
           or c.telephone ilike '%' || public.chat_clean(p_search) || '%'
        order by c.created_at desc
        limit 30
      ) t
    ), '[]'::jsonb)
  );
$$;

create or replace function public.chat_tool_fleet()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total_vehicles', (select count(*) from public.vehicles),
    'by_status', coalesce((
      select jsonb_object_agg(s.statut, s.n)
      from (select v.statut::text as statut, count(*) as n from public.vehicles v group by v.statut) s
    ), '{}'::jsonb),
    'vehicles', coalesce((
      select jsonb_agg(row_to_json(t) order by t.vehicle)
      from (
        select trim(v.marque || ' ' || v.modele) as vehicle, v.immatriculation as plate, v.statut::text as status,
               v.kilometrage as km, v.prix_jour as daily_price
        from public.vehicles v
        order by trim(v.marque || ' ' || v.modele)
        limit 50
      ) t
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.chat_tool_customers(text) from public, anon;
revoke all on function public.chat_tool_fleet() from public, anon;
grant execute on function public.chat_tool_customers(text) to authenticated;
grant execute on function public.chat_tool_fleet() to authenticated;
