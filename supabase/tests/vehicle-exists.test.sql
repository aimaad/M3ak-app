-- Tests SQL de vehicle_exists (migration 0066) : doublon de véhicule même dans une autre filiale, sans rien révéler d'autre.
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
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'emp-casa@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@x.test');
insert into agencies (id, nom, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into branches (id, agency_id, nom) values
  ('b1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Casablanca'),
  ('b2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rabat');
insert into agency_members (agency_id, user_id, role, nom_complet, branch_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner A', null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé Casa', 'b1000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Owner B', null);
insert into vehicles (id, agency_id, branch_id, immatriculation, vin, marque, modele, prix_jour, archived_at) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '8921 | ب | 14', null, 'Dacia', 'Logan', 300, null),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', '33507-أ-6', '1HGCM82633A004352', 'Kia', 'Picanto', 280, now()),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', null, 'WW 482190', null, 'Fiat', 'Punto', 250, null),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', '1234 | هـ | 5', null, 'Renault', 'Clio', 350, null),
  ('f5000000-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', null, '99999 | ب | 1', 'JTDKN3DU0A0123456', 'Toyota', 'Yaris', 400, null);
set session_replication_role = origin;

grant all on res to authenticated;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');

-- L'employé de Casablanca ne voit PAS les véhicules de Rabat (RLS) : c'est tout l'intérêt de la fonction.
select pg_temp.ck('RLS : l''employé de Casablanca ne voit pas les véhicules de Rabat', (select count(*) from vehicles where immatriculation like '%33507%' or immatriculation like '%1234%') = 0, '');

-- Plaque : écritures différentes, même véhicule, nom de la filiale
select pg_temp.ck('plaque d''une autre filiale (archivée) : trouvée, avec le nom de la filiale',
  (select found and branch_name = 'Rabat' from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '33507 | أ | 6', null)), '');
select pg_temp.ck('plaque de sa propre filiale : trouvée', (select found and branch_name = 'Casablanca' from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '8921-ب-14', null)), '');
select pg_temp.ck('plaque comparée normalisée (espaces, barres, tirets, casse)', (select found from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '  8921 ب 14 ', null)), '');
select pg_temp.ck('« هـ » (allongée) et « ه » : même plaque', (select found and branch_name = 'Rabat' from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '1234-ه-5', null)), '');
select pg_temp.ck('marques invisibles de sens d''écriture ignorées', (select found from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', E'‎8921‎-ب-14', null)), '');
select pg_temp.ck('plaque WW : trouvée, véhicule sans filiale → nom nul', (select found and branch_name is null from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', 'ww482190', null)), '');
select pg_temp.ck('plaque inconnue : pas trouvée, aucun nom', (select not found and branch_name is null from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '11111 | د | 9', null)), '');

-- VIN
select pg_temp.ck('VIN d''une autre filiale (archivé) : trouvé, écrit autrement', (select found and branch_name = 'Rabat' from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', null, ' 1hgcm-82633 a004352 ')), '');
select pg_temp.ck('la plaque l''emporte sur le VIN', (select branch_name = 'Casablanca' from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '8921 | ب | 14', '1HGCM82633A004352')), '');
select pg_temp.ck('VIN trop court : ignoré', (select not found from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', null, '1HG')), '');
select pg_temp.ck('rien à chercher : pas trouvé', (select not found from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', null, null)), '');
select pg_temp.ck('plaque vide : ne trouve pas n''importe quoi', (select not found from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '', '')), '');

-- Rien d'autre que « existe » + nom de filiale
select pg_temp.ck('la réponse ne contient que found et branch_name',
  (select array_agg(k order by k) = array['branch_name', 'found'] from (select jsonb_object_keys(to_jsonb(r)) as k from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '33507 | أ | 6', null) r) keys), '');

-- Isolation entre agences
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.try('un membre d''une autre agence ne peut pas interroger l''agence A', $$select * from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '8921 | ب | 14', null)$$, 'not_allowed');
select pg_temp.ck('l''agence B ne trouve pas les plaques de l''agence A dans la sienne', (select not found from vehicle_exists('bbbbbbbb-0000-0000-0000-000000000002', '8921 | ب | 14', null)), '');
select pg_temp.ck('l''agence B trouve ses propres véhicules', (select found from vehicle_exists('bbbbbbbb-0000-0000-0000-000000000002', '99999-ب-1', null)), '');
select pg_temp.ck('l''agence B trouve son VIN', (select found from vehicle_exists('bbbbbbbb-0000-0000-0000-000000000002', null, 'jtdkn3du0a0123456')), '');

-- Anonyme
select pg_temp.as_user('');
select pg_temp.try('sans utilisateur connecté : refusé', $$select * from vehicle_exists('aaaaaaaa-0000-0000-0000-000000000001', '8921 | ب | 14', null)$$, 'not_allowed');

-- Normalisation identique à celle de l'app (src/features/vehicles/add/plate.ts)
reset role;
select pg_temp.ck('clé de plaque : « 68013-ب-72 » = « 68013 | ب | 72 »', vehicle_plate_key('68013-ب-72') = vehicle_plate_key('68013 | ب | 72') and vehicle_plate_key('68013 | ب | 72') = '68013ب72', vehicle_plate_key('68013-ب-72'));
select pg_temp.ck('clé de plaque : « إ » = « أ »', vehicle_plate_key('1234-إ-5') = vehicle_plate_key('1234 | أ | 5'), '');
select pg_temp.ck('clé de plaque : WW', vehicle_plate_key('ww-482190') = 'WW482190', vehicle_plate_key('ww-482190'));
select pg_temp.ck('clé de VIN', vehicle_vin_key(' 1hg-cm82633 a004352 ') = '1HGCM82633A004352', vehicle_vin_key(' 1hg-cm82633 a004352 '));
select pg_temp.ck('clés nulles', vehicle_plate_key(null) = '' and vehicle_vin_key(null) = '', '');

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
