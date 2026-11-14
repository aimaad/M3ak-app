-- Tests SQL : le statut d'un véhicule réservé ou en location ne se change pas à la main (migration 0072).
\set ON_ERROR_STOP off
create temp table res (n serial, name text, ok boolean, detail text);
grant all on res to authenticated;
grant usage, select on sequence res_n_seq to authenticated;
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
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
grant execute on function pg_temp.as_user(text), pg_temp.try(text, text, text) to authenticated;

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire');
insert into customers (id, agency_id, nom_complet, telephone) values ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Un', '0661000001');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible'),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Renault', 'Clio', 300, 'disponible'),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-3', 'Kia', 'Rio', 300, 'en_location'),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '4-A-4', 'Fiat', 'Tipo', 300, 'maintenance');
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'confirmee', timestamptz '2031-01-10 09:00+01', timestamptz '2031-01-12 18:00+01'),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'en_cours', timestamptz '2026-01-10 09:00+01', timestamptz '2031-01-12 18:00+01'),
  ('a1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'en_cours', timestamptz '2026-01-10 09:00+01', timestamptz '2031-01-12 18:00+01'),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'terminee', timestamptz '2026-01-10 09:00+01', timestamptz '2026-01-12 18:00+01');
set session_replication_role = origin;

create function public.test_system_set_status(p_vehicle uuid, p_statut text) returns void language plpgsql security definer set search_path = public as $$
begin update vehicles set statut = p_statut::vehicle_status where id = p_vehicle; end $$;
grant execute on function public.test_system_set_status(uuid, text) to authenticated;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');

select pg_temp.try('réservée : passer indisponible est refusé', $$update vehicles set statut = 'indisponible' where id = 'f1000000-0000-0000-0000-000000000001'$$, 'vehicle_status_locked');
select pg_temp.try('réservée : passer en maintenance est refusé', $$update vehicles set statut = 'maintenance' where id = 'f1000000-0000-0000-0000-000000000001'$$, 'vehicle_status_locked');
select pg_temp.try('réservée : passer en préparation est refusé', $$update vehicles set statut = 'en_preparation' where id = 'f1000000-0000-0000-0000-000000000001'$$, 'vehicle_status_locked');
select pg_temp.try('réservée : le statut est resté « disponible »', $$select 1 / (select count(*) from vehicles where id = 'f1000000-0000-0000-0000-000000000001' and statut = 'disponible')$$);
select pg_temp.try('réservée : modifier un autre champ reste possible', $$update vehicles set couleur = 'Gris' where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.try('réservée : réécrire le MÊME statut reste possible', $$update vehicles set statut = 'disponible' where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.try('sans location ouverte (la seule est terminée) : changement accepté', $$update vehicles set statut = 'indisponible' where id = 'f2000000-0000-0000-0000-000000000002'$$);
select pg_temp.try('en location : quitter ce statut à la main est refusé', $$update vehicles set statut = 'disponible' where id = 'f3000000-0000-0000-0000-000000000003'$$, 'vehicle_status_locked');
select pg_temp.try('panne pendant une location : redevenir disponible reste possible', $$update vehicles set statut = 'disponible' where id = 'f4000000-0000-0000-0000-000000000004'$$);
select pg_temp.try('fonction du serveur : le changement n''est jamais bloqué (départ, retour…)', $$select public.test_system_set_status('f1000000-0000-0000-0000-000000000001', 'en_location')$$);

reset role;
select pg_temp.try('rôle de service : jamais bloqué', $$update vehicles set statut = 'indisponible' where id = 'f3000000-0000-0000-0000-000000000003'$$);

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
