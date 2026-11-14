-- Tests SQL de « Fait » en un geste (migration 0073).
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
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test'), ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test'), ('00000000-0000-0000-0000-0000000000b1', 'oth@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Autre');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut, kilometrage) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible', 48200);
insert into maintenance_items (id, agency_id, vehicle_id, type, echeance_km, statut, repeat_km, repeat_months) values
  ('11000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'vidange', 50000, 'a_venir', 10000, 12),
  ('11000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'freins', 60000, 'a_venir', null, null),
  ('11000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'pneus', 70000, 'a_venir', null, null);
set session_replication_role = origin;

-- Un employé peut marquer « fait » ; le kilométrage de la fiche suit ; la suivante part de ce kilométrage et de la date saisie.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('un employé marque la vidange comme faite (km 49 000, 14 nov. 2026)', $$select public.complete_maintenance_quick('11000000-0000-0000-0000-000000000001', 49000, date '2026-11-14', ' Garage Atlas ', null)$$);
reset role;

select pg_temp.ck('l''entretien est « effectué », date et garage enregistrés', (select statut::text = 'effectuee' and date_intervention = date '2026-11-14' and garage = 'Garage Atlas' from maintenance_items where id = '11000000-0000-0000-0000-000000000001'));
select pg_temp.ck('le kilométrage de la fiche passe à 49 000', (select kilometrage = 49000 from vehicles where id = 'f1000000-0000-0000-0000-000000000001'));
select pg_temp.ck('la suivante est créée : 59 000 km et le 14 nov. 2027', (select echeance_km = 59000 and echeance_date = date '2027-11-14' from maintenance_items where type = 'vidange' and statut::text = 'a_venir'));
select pg_temp.ck('le statut du véhicule n''est pas touché', (select statut::text = 'disponible' from vehicles where id = 'f1000000-0000-0000-0000-000000000001'));

-- Le kilométrage ne baisse jamais.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('freins faits avec un km plus petit : accepté', $$select public.complete_maintenance_quick('11000000-0000-0000-0000-000000000002', 30000, date '2026-11-14', null, 120)$$);
reset role;
select pg_temp.ck('le kilométrage de la fiche ne baisse pas', (select kilometrage = 49000 from vehicles where id = 'f1000000-0000-0000-0000-000000000001'));
select pg_temp.ck('le coût est enregistré', (select cout = 120 from maintenance_items where id = '11000000-0000-0000-0000-000000000002'));
select pg_temp.ck('sans périodicité : pas de suivante', (select count(*) from maintenance_items where type = 'freins') = 1);

-- Refus.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('déjà fait : refusé', $$select public.complete_maintenance_quick('11000000-0000-0000-0000-000000000001')$$, 'maintenance_already_done');
select pg_temp.try('kilométrage absurde : refusé', $$select public.complete_maintenance_quick('11000000-0000-0000-0000-000000000003', 99999999)$$, 'invalid_km');
select pg_temp.try('date lointaine dans le futur : refusée', $$select public.complete_maintenance_quick('11000000-0000-0000-0000-000000000003', null, current_date + 30)$$, 'invalid_date');
select pg_temp.try('coût négatif : refusé', $$select public.complete_maintenance_quick('11000000-0000-0000-0000-000000000003', null, current_date, null, -5)$$, 'invalid_cost');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.try('une autre entreprise ne peut pas marquer cet entretien', $$select public.complete_maintenance_quick('11000000-0000-0000-0000-000000000003')$$, 'maintenance_not_found');
reset role;
select pg_temp.ck('l''entretien de A n''a pas bougé', (select statut::text = 'a_venir' from maintenance_items where id = '11000000-0000-0000-0000-000000000003'));

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
