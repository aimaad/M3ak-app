-- M3ak — la remise d'un véhicule « À régulariser » (assurance ou visite technique expirée) prévient aussi le responsable.
--
--  * Notification PRIORITAIRE (urgente) au propriétaire et aux responsables, jamais à l'employé qui remet le véhicule ni à l'auteur de l'action.
--  * Protection contre les doublons : au plus UNE trace et UNE notification par location, même si le statut de la location repasse plusieurs
--    fois à « en cours » (la base refuse aussi deux notifications identiques pour un même destinataire : clé `noncompliant_handover:<location>`).
--  * Jamais bloquant : une erreur du journal ou des notifications n'empêche pas la remise.
--  * Le statut opérationnel du véhicule n'est PAS modifié. BIBIP informe ; ce n'est pas une autorisation légale de remettre un véhicule non conforme.

create or replace function public.audit_noncompliant_handover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_issues jsonb;
  v_vehicle record;
  v_customer text;
  v_kinds text;
begin
  if new.statut::text = 'en_cours' and old.statut::text is distinct from 'en_cours' then
    -- Déjà tracée pour cette location : ni nouvelle ligne d'historique, ni nouvelle notification.
    if exists (select 1 from public.agency_audit_log where agency_id = new.agency_id and action = 'rental_started_noncompliant' and details ->> 'rental_id' = new.id::text) then
      return new;
    end if;
    v_issues := public.vehicle_noncompliance(new.vehicle_id);
    if jsonb_array_length(v_issues) > 0 then
      select trim(coalesce(marque, '') || ' ' || coalesce(modele, '')) as name, immatriculation as plate, branch_id into v_vehicle from public.vehicles where id = new.vehicle_id;
      select nom_complet into v_customer from public.customers where id = new.customer_id;
      select string_agg(i ->> 'kind', ',' order by i ->> 'kind') into v_kinds from jsonb_array_elements(v_issues) i;
      perform public.audit_event(new.agency_id, 'rental_started_noncompliant', new.numero,
        jsonb_build_object('vehicle', v_vehicle.name, 'customer', v_customer, 'issues', v_issues, 'rental_id', new.id));
      perform public.notify_agency(new.agency_id, 'noncompliant_handover', 'rental', 'urgent',
        jsonb_build_object('vehicle', v_vehicle.name, 'plate', v_vehicle.plate, 'customer', v_customer, 'rental', new.numero, 'kinds', v_kinds),
        array[v_vehicle.branch_id], 'managers', 'vehicle', new.vehicle_id, 'noncompliant_handover:' || new.id);
    end if;
  end if;
  return new;
exception when others then
  raise warning 'audit_noncompliant_handover: échec ignoré (%)', sqlerrm;
  return new;
end;
$$;

revoke all on function public.audit_noncompliant_handover() from public, anon, authenticated;
