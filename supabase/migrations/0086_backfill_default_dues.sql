-- M3ak — les véhicules créés AVANT les échéances automatiques reçoivent aussi vidange, freins et pneus (« À compléter »).
--
-- Même règle que pour un nouveau véhicule (migration 0076) : selon les règles de l'agence (valeurs indicatives par défaut ; une règle
-- désactivée n'est pas créée). Sans danger :
--  * seulement pour un véhicule NON archivé et SEULEMENT pour un type dont il n'a AUCUN entretien (ni à faire, ni déjà fait) : rien n'est dupliqué ;
--  * aucune saisie obligatoire (ni date ni kilométrage) : l'échéance est « À compléter » ;
--  * pas de bruit dans le journal d'activité (la reprise n'est pas une action d'un employé) ;
--  * rejouable sans effet.

create or replace function public.backfill_default_dues()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  r record;
  v_count int := 0;
begin
  alter table public.maintenance_items disable trigger trg_audit_maintenance_items;
  begin
    for v in select id, agency_id from public.vehicles where archived_at is null loop
      for r in
        select * from public.effective_due_rules(v.agency_id)
        where enabled and kind in ('vidange', 'freins', 'pneus')
      loop
        if not exists (select 1 from public.maintenance_items m where m.vehicle_id = v.id and m.type::text = r.kind) then
          insert into public.maintenance_items (agency_id, vehicle_id, type, statut, repeat_km, repeat_months)
          values (v.agency_id, v.id, r.kind::public.maintenance_type, 'a_venir', r.repeat_km, r.repeat_months);
          v_count := v_count + 1;
        end if;
      end loop;
    end loop;
  exception when others then
    alter table public.maintenance_items enable trigger trg_audit_maintenance_items;
    raise;
  end;
  alter table public.maintenance_items enable trigger trg_audit_maintenance_items;
  return v_count;
end;
$$;

revoke all on function public.backfill_default_dues() from public, anon, authenticated;

do $$
begin
  perform public.backfill_default_dues();
end;
$$;
