-- Tests SQL : une voiture ne peut pas être promise deux fois, même en attente de confirmation (migration 0056).
-- À exécuter sur une base locale APRÈS supabase/tests/run-local.sh (stub + migrations).
-- Chaque ligne affichée « OK » ou « FAIL ». Les identités sont simulées avec auth.uid()
-- (request.jwt.claim.sub) et le rôle « authenticated », donc la RLS est réellement appliquée.

\set ON_ERROR_STOP off
create temp table res (n serial, name text, ok boolean, detail text);
grant all on res to authenticated;
grant usage, select on sequence res_n_seq to authenticated;

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;

-- Vérifie une condition.
create function pg_temp.ck(label text, cond boolean, detail text default '') returns void
language plpgsql as $$ begin insert into res(name, ok, detail) values (label, coalesce(cond, false), detail); end $$;

-- Exécute une instruction ; attend une erreur contenant « expect » (ou aucune erreur si expect est null).
create function pg_temp.try(label text, stmt text, expect text default null) returns void
language plpgsql as $$
begin
  begin
    execute stmt;
    insert into res(name, ok, detail) values (label, expect is null, case when expect is null then '' else 'aucune erreur (attendu : ' || expect || ')' end);
  exception when others then
    insert into res(name, ok, detail)
    values (label, expect is not null and sqlerrm like '%' || expect || '%', sqlerrm);
  end;
end $$;
grant execute on function pg_temp.as_user(text), pg_temp.ck(text, boolean, text), pg_temp.try(text, text, text) to authenticated;

-- ----------------------------------------------------------------- fixtures
set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'owner@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner');
insert into customers (id, agency_id, nom_complet, telephone) values ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Un', '0661000001');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Renault', 'Clio', 300);
set session_replication_role = origin;
grant all on res to authenticated;

create function pg_temp.ins(id text, veh text, st text, d1 text, d2 text) returns text language sql as $$
  select format($f$insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue)
    values ('%s', 'aaaaaaaa-0000-0000-0000-000000000001', '%s', 'c1000000-0000-0000-0000-000000000001', '%s', timestamptz '%s', timestamptz '%s')$f$, id, veh, st, d1, d2) $$;

select pg_temp.try('une première location en attente est acceptée', pg_temp.ins('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'en_attente_confirmation', '2030-06-10 09:00+01', '2030-06-12 18:00+01'));
select pg_temp.try('une 2e location en attente qui chevauche est refusée', pg_temp.ins('a1000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'en_attente_confirmation', '2030-06-11 09:00+01', '2030-06-13 18:00+01'), 'rental_overlap');
select pg_temp.try('une location confirmée qui chevauche une location en attente est refusée', pg_temp.ins('a1000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 'confirmee', '2030-06-12 09:00+01', '2030-06-14 18:00+01'), 'rental_overlap');
select pg_temp.try('les heures comptent : départ à 09 h le jour du retour (18 h) = chevauchement', pg_temp.ins('a1000000-0000-0000-0000-000000000004', 'f1000000-0000-0000-0000-000000000001', 'en_attente_confirmation', '2030-06-12 09:00+01', '2030-06-14 18:00+01'), 'rental_overlap');
select pg_temp.try('un départ à l''heure exacte du retour est accepté (pas de chevauchement)', pg_temp.ins('a1000000-0000-0000-0000-000000000005', 'f1000000-0000-0000-0000-000000000001', 'en_attente_confirmation', '2030-06-12 18:00+01', '2030-06-14 18:00+01'));
select pg_temp.try('une autre voiture, mêmes dates : acceptée', pg_temp.ins('a1000000-0000-0000-0000-000000000006', 'f2000000-0000-0000-0000-000000000002', 'en_attente_confirmation', '2030-06-10 09:00+01', '2030-06-12 18:00+01'));
select pg_temp.try('une location annulée ne bloque pas', pg_temp.ins('a1000000-0000-0000-0000-000000000007', 'f1000000-0000-0000-0000-000000000001', 'annulee', '2030-06-10 09:00+01', '2030-06-12 18:00+01'));

-- annuler libère la voiture
update rentals set statut = 'annulee' where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.try('après annulation, le créneau est de nouveau libre', pg_temp.ins('a1000000-0000-0000-0000-000000000008', 'f1000000-0000-0000-0000-000000000001', 'en_attente_confirmation', '2030-06-11 09:00+01', '2030-06-12 12:00+01'));

-- déplacer une location sur un créneau pris est refusé
select pg_temp.try('déplacer une location sur un créneau pris est refusé', $$update rentals set date_debut_prevue = timestamptz '2030-06-10 09:00+01', date_fin_prevue = timestamptz '2030-06-12 06:00+01' where id = 'a1000000-0000-0000-0000-000000000005'$$, 'rental_overlap');
select pg_temp.try('changer de voiture vers une voiture déjà prise est refusé', $$update rentals set vehicle_id = 'f2000000-0000-0000-0000-000000000002' where id = 'a1000000-0000-0000-0000-000000000008'$$, 'rental_overlap');
select pg_temp.try('modifier les notes ne déclenche aucune vérification', $$update rentals set notes = 'RAS' where id = 'a1000000-0000-0000-0000-000000000008'$$);

-- chevauchements déjà présents (créés avant la règle) : ils ne bloquent pas le démarrage de la location confirmée
reset role;
set session_replication_role = replica;
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values
  ('a2000000-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'confirmee', timestamptz '2031-01-10 09:00+01', timestamptz '2031-01-12 18:00+01'),
  ('a2000000-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'en_attente_confirmation', timestamptz '2031-01-11 09:00+01', timestamptz '2031-01-13 18:00+01');
set session_replication_role = origin;
select pg_temp.try('démarrer la location confirmée malgré un ancien chevauchement en attente', $$update rentals set statut = 'en_cours' where id = 'a2000000-0000-0000-0000-000000000011'$$);
select pg_temp.try('confirmer la location en attente qui chevauche est refusé (à régler avant)', $$update rentals set statut = 'confirmee' where id = 'a2000000-0000-0000-0000-000000000012'$$, 'rental_overlap');

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
