-- M3ak — règles d'échéances de l'agence et création automatique à l'ajout d'un véhicule.
--
--  * Chaque agence active, désactive ou personnalise ses règles (vidange, freins, pneus, assurance, visite technique, vignette).
--    Sans réglage enregistré, les valeurs PROPOSÉES s'appliquent : vidange tous les 10 000 km, freins 30 000 km, pneus 40 000 km, obligations activées.
--    Ces intervalles sont INDICATIFS : les préconisations du constructeur et l'état réel du véhicule priment.
--  * À l'ajout d'un véhicule, les entretiens activés sont créés SANS date ni kilométrage (« À compléter ») : on n'invente jamais une date
--    d'expiration. L'employé complète quand il veut ; aucune saisie obligatoire à l'ajout. Les obligations légales (assurance, visite,
--    vignette) sont « À compléter » tant qu'aucune période n'est enregistrée (rien à créer).
--  * Le déclencheur est côté serveur : l'écran d'ajout du véhicule n'a pas à changer, et il vaut aussi pour la création rapide.

create table if not exists public.agency_due_rules (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  kind text not null check (kind in ('vidange', 'freins', 'pneus', 'assurance', 'visite_technique', 'vignette')),
  enabled boolean not null default true,
  repeat_km int check (repeat_km is null or repeat_km between 1 and 1000000),
  repeat_months int check (repeat_months is null or repeat_months between 1 and 120),
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  primary key (agency_id, kind)
);

alter table public.agency_due_rules enable row level security;

drop policy if exists "agency_due_rules_select" on public.agency_due_rules;
create policy "agency_due_rules_select" on public.agency_due_rules for select using (public.is_agency_member(agency_id));
drop policy if exists "agency_due_rules_insert" on public.agency_due_rules;
create policy "agency_due_rules_insert" on public.agency_due_rules for insert with check (public.is_agency_manager(agency_id));
drop policy if exists "agency_due_rules_update" on public.agency_due_rules;
create policy "agency_due_rules_update" on public.agency_due_rules for update using (public.is_agency_manager(agency_id)) with check (public.is_agency_manager(agency_id));
drop policy if exists "agency_due_rules_delete" on public.agency_due_rules;
create policy "agency_due_rules_delete" on public.agency_due_rules for delete using (public.is_agency_manager(agency_id));
grant select, insert, update, delete on public.agency_due_rules to authenticated;

-- Valeurs proposées (indicatives) puis réglages de l'agence : une ligne par règle.
create or replace function public.effective_due_rules(p_agency uuid)
returns table (kind text, enabled boolean, repeat_km int, repeat_months int)
language sql
stable
security definer
set search_path = public
as $$
  select d.kind,
         coalesce(r.enabled, true),
         case when r.agency_id is null then d.repeat_km else r.repeat_km end,
         case when r.agency_id is null then d.repeat_months else r.repeat_months end
  from (values
    ('vidange', 10000, null::int),
    ('freins', 30000, null::int),
    ('pneus', 40000, null::int),
    ('assurance', null::int, null::int),
    ('visite_technique', null::int, null::int),
    ('vignette', null::int, null::int)
  ) as d (kind, repeat_km, repeat_months)
  left join public.agency_due_rules r on r.agency_id = p_agency and r.kind = d.kind;
$$;

revoke all on function public.effective_due_rules(uuid) from public, anon;
grant execute on function public.effective_due_rules(uuid) to authenticated;

create or replace function public.vehicle_create_default_dues()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from public.effective_due_rules(new.agency_id)
    where enabled and kind in ('vidange', 'freins', 'pneus')
  loop
    insert into public.maintenance_items (agency_id, vehicle_id, type, statut, repeat_km, repeat_months)
    values (new.agency_id, new.id, r.kind::public.maintenance_type, 'a_venir', r.repeat_km, r.repeat_months);
  end loop;
  return new;
exception when others then
  -- Jamais bloquant : un véhicule s'ajoute même si la création des échéances échoue.
  raise warning 'vehicle_create_default_dues: échec ignoré (%)', sqlerrm;
  return new;
end;
$$;

revoke all on function public.vehicle_create_default_dues() from public, anon, authenticated;

drop trigger if exists trg_vehicle_create_default_dues on public.vehicles;
create trigger trg_vehicle_create_default_dues
  after insert on public.vehicles
  for each row execute function public.vehicle_create_default_dues();
