-- M3ak — échéances périodiques : on règle la périodicité UNE fois, la suivante se crée toute seule.
--  * Entretien (vidange, freins, pneus…) : « tous les N km » et/ou « tous les N mois » ; quand l'entretien passe à « effectué »,
--    l'échéance suivante est créée (kilométrage actuel du véhicule + N km ; date d'intervention + N mois).
--  * Assurance / visite technique / vignette : la durée de la période (en mois) est mémorisée sur la période enregistrée ;
--    le renouvellement suivant la reprend (l'application pré-remplit les dates).

alter table public.maintenance_items
  add column if not exists repeat_km int check (repeat_km is null or repeat_km between 1 and 1000000),
  add column if not exists repeat_months int check (repeat_months is null or repeat_months between 1 and 120);

alter table public.vehicle_compliance
  add column if not exists period_months int check (period_months is null or period_months between 1 and 120);

create or replace function public.maintenance_create_next()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_km int;
  v_base date;
begin
  -- Seulement au passage à « effectué » (jamais deux fois), et seulement si une périodicité est réglée.
  if new.statut::text <> 'effectuee' or old.statut::text = 'effectuee' then
    return new;
  end if;
  if new.repeat_km is null and new.repeat_months is null then
    return new;
  end if;
  select kilometrage into v_km from public.vehicles where id = new.vehicle_id;
  v_base := coalesce(new.date_intervention, current_date);
  -- Si une échéance de même type est déjà en attente pour ce véhicule (créée à la main), on n'en ajoute pas une deuxième.
  if exists (
    select 1 from public.maintenance_items m
    where m.vehicle_id = new.vehicle_id and m.type = new.type and m.id <> new.id
      and m.statut::text in ('a_venir', 'due', 'en_retard', 'en_cours')
  ) then
    return new;
  end if;
  insert into public.maintenance_items (agency_id, vehicle_id, type, echeance_date, echeance_km, statut, repeat_km, repeat_months)
  values (
    new.agency_id,
    new.vehicle_id,
    new.type,
    case when new.repeat_months is not null then (v_base + make_interval(months => new.repeat_months))::date end,
    case when new.repeat_km is not null then coalesce(v_km, new.echeance_km, 0) + new.repeat_km end,
    'a_venir',
    new.repeat_km,
    new.repeat_months
  );
  return new;
end;
$$;

revoke all on function public.maintenance_create_next() from public, anon, authenticated;

drop trigger if exists trg_maintenance_create_next on public.maintenance_items;
create trigger trg_maintenance_create_next
  after update on public.maintenance_items
  for each row execute function public.maintenance_create_next();
