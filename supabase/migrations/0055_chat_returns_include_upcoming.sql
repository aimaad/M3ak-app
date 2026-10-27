-- M3ak — Chat : « quelles voitures reviennent demain ? » doit aussi compter les locations pas encore démarrées
-- (réservées / confirmées) dont la fin est prévue dans la période. Le statut est renvoyé pour que M3ak précise
-- « départ pas encore enregistré ». Lecture seule, droits de l'utilisateur (RLS), comme avant.

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
           c.nom_complet as customer, c.telephone as phone, r.date_fin_prevue as "end", br.nom as branch_return,
           r.statut::text as status, (r.statut::text = 'en_cours') as picked_up
    from public.rentals r
    join public.vehicles v on v.id = r.vehicle_id
    join public.customers c on c.id = r.customer_id
    left join public.branches br on br.id = coalesce(r.branch_retour_id, v.branch_id)
    where r.statut::text in ('en_cours', 'reservee', 'confirmee', 'en_attente_confirmation')
      and r.date_fin_prevue >= coalesce(p_from, '-infinity') and r.date_fin_prevue <= coalesce(p_to, 'infinity')
    order by r.date_fin_prevue
    limit 25
  ) t;
$$;

revoke all on function public.chat_tool_returns_due(timestamptz, timestamptz) from public, anon;
grant execute on function public.chat_tool_returns_due(timestamptz, timestamptz) to authenticated;
