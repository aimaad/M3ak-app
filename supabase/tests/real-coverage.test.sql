-- Tests SQL : la couverture RÉELLE d'aujourd'hui (migration 0080) : une période à venir ne couvre rien.
\set ON_ERROR_STOP off
create temp table res (n serial, name text, ok boolean, detail text);
grant all on res to authenticated;
grant usage, select on sequence res_n_seq to authenticated;
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create function pg_temp.ck(label text, cond boolean, detail text default '') returns void
language plpgsql as $$ begin insert into res(name, ok, detail) values (label, coalesce(cond, false), detail); end $$;
create function pg_temp.try(label text, stmt text, expect text default null) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
    insert into res(name, ok, detail) values (label, expect is null, case when expect is null then '' else 'aucune erreur (attendu : ' || expect || ')' end);
  exception when others then
    insert into res(name, ok, detail) values (label, expect is not null and sqlerrm like '%' || expect || '%', sqlerrm);
  end;
end $$;
grant execute on function pg_temp.as_user(text), pg_temp.ck(text, boolean, text), pg_temp.try(text, text, text) to authenticated;

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test'), ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test');

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Kia', 'Rio', 300),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-3', 'Fiat', 'Tipo', 300),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '4-A-4', 'Seat', 'Ibiza', 300);
-- Aujourd'hui : 15/11/2026.
-- 1 : SEULEMENT une assurance 2028-2029 (rien ne couvre aujourd'hui)
-- 2 : période en cours (finit le 15/12/2026) + suivante enchaînée (jusqu'au 15/12/2027) : couvert
-- 3 : période en cours + suivante MAIS avec un trou
-- 4 : ancienne période terminée + période à venir
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', date '2028-11-16', date '2029-11-15'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'assurance', date '2025-12-16', date '2026-12-15'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'assurance', date '2026-12-16', date '2027-12-15'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'assurance', date '2025-11-01', date '2026-11-10'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'assurance', date '2027-01-01', date '2027-12-31'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'visite_technique', date '2025-01-01', date '2025-06-30'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'visite_technique', date '2027-01-01', date '2027-06-30');
set session_replication_role = origin;

select pg_temp.ck('seule une période à venir : le véhicule est à régulariser', (select jsonb_array_length(vehicle_noncompliance('f1000000-0000-0000-0000-000000000001', date '2026-11-15')) = 1));
select pg_temp.ck('période en cours + suivante enchaînée : en règle', (select jsonb_array_length(vehicle_noncompliance('f2000000-0000-0000-0000-000000000002', date '2026-11-15')) = 0));
select pg_temp.ck('trou de couverture : à régulariser', (select vehicle_noncompliance('f3000000-0000-0000-0000-000000000003', date '2026-11-15') -> 0 ->> 'kind' = 'assurance'));
select pg_temp.ck('le trou est à régulariser avec la date de fin de la dernière période terminée', (select vehicle_noncompliance('f3000000-0000-0000-0000-000000000003', date '2026-11-15') -> 0 ->> 'valid_until' = '2026-11-10'));
select pg_temp.ck('visite terminée + visite à venir : à régulariser', (select vehicle_noncompliance('f4000000-0000-0000-0000-000000000004', date '2026-11-15') -> 0 ->> 'kind' = 'visite_technique'));
select pg_temp.ck('le même véhicule 2 est en règle même le 15/12/2026 (dernier jour couvert)', (select jsonb_array_length(vehicle_noncompliance('f2000000-0000-0000-0000-000000000002', date '2026-12-15')) = 0));
select pg_temp.ck('et le 16/12/2026 aussi : la suivante a pris le relais', (select jsonb_array_length(vehicle_noncompliance('f2000000-0000-0000-0000-000000000002', date '2026-12-16')) = 0));

-- Rappels quotidiens : la période suivante enchaînée supprime le rappel « bientôt » (fin le 15/12 = dans 30 jours) ; le trou garde son rappel.
select public.generate_compliance_notifications('2026-11-15 10:00:00+01');
select pg_temp.ck('rappel : aucune alerte pour le véhicule renouvelé à l''avance', (select count(*) = 0 from notifications where link_id = 'f2000000-0000-0000-0000-000000000002'));
select pg_temp.ck('rappel : le véhicule au trou de couverture est signalé expiré', (select count(*) >= 1 from notifications where link_id = 'f3000000-0000-0000-0000-000000000003' and kind = 'compliance_expired'));
select pg_temp.ck('rappel : une période à venir seule ne déclenche pas de rappel quotidien (limite connue)', (select count(*) = 0 from notifications where link_id = 'f1000000-0000-0000-0000-000000000001'));

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
