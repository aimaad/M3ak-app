-- M3ak — corrige la création d'agence : lors de `insert ... returning`, Postgres
-- exige que la ligne créée satisfasse aussi la policy SELECT (pour le "returning").
-- Au moment de créer l'agence, l'utilisateur n'est pas encore membre (ça arrive à
-- l'étape suivante), donc l'ancienne policy bloquait toujours la création.

alter table public.agencies add column created_by uuid references auth.users (id);

drop policy if exists "agencies_select" on public.agencies;

create policy "agencies_select" on public.agencies
  for select using (public.is_agency_member(id) or created_by = auth.uid());

-- Remet la policy d'insertion dans sa forme d'origine (testée temporairement avec
-- `1 = 1` pendant le diagnostic : fonctionnellement identique à `true`).
drop policy if exists "agencies_insert" on public.agencies;

create policy "agencies_insert" on public.agencies
  for insert to authenticated with check (true);
