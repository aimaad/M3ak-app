-- M3ak — « À régulariser » : la remise d'un véhicule dont l'assurance ou la visite technique est EXPIRÉE est tracée dans l'historique.
--
-- Principe : BIBIP informe et alerte, mais ne bloque aucune action. Cette trace sert à savoir qui a remis quel véhicule, quand, et pour quelle
-- raison il était à régulariser. L'absence de blocage technique ne constitue PAS une autorisation légale de remettre un véhicule non conforme.
--  * « À régulariser » = une période d'assurance ou de visite technique ENREGISTRÉE, dont la fin est dépassée (date du Maroc).
--    Une obligation « À compléter » (aucune période enregistrée) n'est pas une preuve d'expiration : avertissement seulement, pas de trace.
--  * Le départ (location qui passe à « en cours ») écrit une ligne `rental_started_noncompliant` dans le journal : véhicule, client, obligations
--    et dates de fin dépassées. Jamais bloquant : une erreur du journal n'empêche pas la remise.

create or replace function public.vehicle_noncompliance(p_vehicle uuid, p_today date default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'valid_until', x.valid_until) order by x.kind), '[]'::jsonb)
  from (
    select distinct on (c.kind) c.kind, c.valid_until
    from public.vehicle_compliance c
    where c.vehicle_id = p_vehicle and c.kind in ('assurance', 'visite_technique')
    order by c.kind, c.valid_until desc, c.created_at desc
  ) x
  where x.valid_until < coalesce(p_today, (now() at time zone 'Africa/Casablanca')::date);
$$;

revoke all on function public.vehicle_noncompliance(uuid, date) from public, anon, authenticated;

create or replace function public.audit_noncompliant_handover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issues jsonb;
  v_vehicle text;
  v_customer text;
begin
  if new.statut::text = 'en_cours' and old.statut::text is distinct from 'en_cours' then
    v_issues := public.vehicle_noncompliance(new.vehicle_id);
    if jsonb_array_length(v_issues) > 0 then
      select trim(coalesce(marque, '') || ' ' || coalesce(modele, '')) into v_vehicle from public.vehicles where id = new.vehicle_id;
      select nom_complet into v_customer from public.customers where id = new.customer_id;
      perform public.audit_event(new.agency_id, 'rental_started_noncompliant', new.numero,
        jsonb_build_object('vehicle', v_vehicle, 'customer', v_customer, 'issues', v_issues));
    end if;
  end if;
  return new;
exception when others then
  raise warning 'audit_noncompliant_handover: échec ignoré (%)', sqlerrm;
  return new;
end;
$$;

revoke all on function public.audit_noncompliant_handover() from public, anon, authenticated;

drop trigger if exists trg_audit_noncompliant_handover on public.rentals;
create trigger trg_audit_noncompliant_handover
  after update of statut on public.rentals
  for each row execute function public.audit_noncompliant_handover();
