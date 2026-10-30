-- M3ak — décisions du PROPRIÉTAIRE sur l'inspection :
--   allow_skip_inspection  (défaut : oui, comme avant) : les employés peuvent ignorer la prise de photos ;
--   allow_decline_ai       (défaut : oui, comme avant) : les employés peuvent refuser l'analyse par M3ak.
-- Appliqué par le serveur pour les employés ; le gérant et le propriétaire peuvent toujours ignorer / refuser.

alter table public.agency_departure_policies
  add column if not exists allow_skip_inspection boolean not null default true,
  add column if not exists allow_decline_ai boolean not null default true;

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
    v_policy.require_id_at_rental := false;
    v_policy.require_licence_at_customer := true;
    v_policy.allow_skip_inspection := true;
    v_policy.allow_decline_ai := true;
  end if;
  return v_policy;
end;
$$;

create or replace function public.enforce_inspection_skip_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skip boolean;
  v_decline boolean;
begin
  if public.is_agency_manager(NEW.agency_id) then
    return NEW;
  end if;

  select coalesce(allow_skip_inspection, true), coalesce(allow_decline_ai, true)
    into v_skip, v_decline
    from public.agency_departure_policies where agency_id = NEW.agency_id;
  v_skip := coalesce(v_skip, true);
  v_decline := coalesce(v_decline, true);

  if not v_skip and NEW.skipped and (TG_OP = 'INSERT' or not OLD.skipped) then
    raise exception 'inspection_skip_not_allowed';
  end if;
  if not v_decline and NEW.analysis_status = 'refusee' and (TG_OP = 'INSERT' or OLD.analysis_status is distinct from 'refusee') then
    raise exception 'inspection_decline_not_allowed';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enforce_inspection_skip_policy on public.inspections;
create trigger trg_enforce_inspection_skip_policy
  before insert or update on public.inspections
  for each row execute function public.enforce_inspection_skip_policy();
