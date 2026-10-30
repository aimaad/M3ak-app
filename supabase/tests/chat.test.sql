-- Tests SQL du Chat M3ak (migration 0054) : outils en lecture seule, isolation entreprise / filiale, accord du propriétaire.
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

-- ----------------------------------------------------------------- fixtures (sans déclencheurs)
set session_replication_role = replica;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'casa@x.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'rabat@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'ownerb@x.test');
insert into agencies (id, nom, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into branches (id, agency_id, nom) values
  ('b1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Casa'),
  ('b2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rabat');
insert into agency_members (agency_id, user_id, role, nom_complet, branch_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner', null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Emp Casa', 'b1000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 'employee', 'Emp Rabat', 'b2000000-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Owner B', null);
insert into customers (id, agency_id, nom_complet, telephone, cin_ou_passeport, numero_permis) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Karim Alami', '0661000001', 'AB123456', 'PERMIS-SECRET'),
  ('c2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Client B', '0662000002', null, null);
insert into vehicles (id, agency_id, branch_id, immatriculation, marque, modele, prix_jour, statut) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'en_location'),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '3-A-3', 'Renault', 'Clio', 350, 'disponible'),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000002', '4-A-4', 'Peugeot', '208', 400, 'disponible'),
  ('f5000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '5-A-5', 'Fiat', 'Tipo', 300, 'maintenance'),
  ('f2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', null, '2-B-2', 'Kia', 'Rio', 300, 'disponible');
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue, branch_depart_id, branch_retour_id) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'en_cours',
   timestamptz '2030-06-10 09:00+01', timestamptz '2030-06-14 09:00+01', 'b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'),
  ('a2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'en_cours',
   timestamptz '2030-06-10 09:00+01', timestamptz '2030-06-14 09:00+01', null, null);
insert into inspections (id, agency_id, rental_id, vehicle_id, type, statut, analysis_status)
values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'retour', 'terminee', 'terminee');
insert into damages (inspection_id, agency_id, zone, type, gravite, nouveau, statut, source, description)
values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'capot', 'fissure', 'modere', true, 'confirme', 'ia', 'Fissure sur le capot');
insert into agency_ocr_settings (agency_id, gemini_api_key) values ('aaaaaaaa-0000-0000-0000-000000000001', 'AQ.fake-test-key-0123456789abcdef');
set session_replication_role = origin;
grant all on res to authenticated;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('qui avait la voiture sur la période : le propriétaire voit le client et son numéro',
  (select r ->> 'customer' = 'Karim Alami' and r ->> 'phone' = '0661000001' from jsonb_array_elements(public.chat_tool_rentals(timestamptz '2030-06-11 10:00+01', timestamptz '2030-06-12 10:00+01', '1-A-1', null)) r), '');
select pg_temp.ck('la recherche par modèle de voiture fonctionne', jsonb_array_length(public.chat_tool_rentals(timestamptz '2030-06-11 10:00+01', timestamptz '2030-06-12 10:00+01', 'logan', null)) = 1, '');
select pg_temp.ck('hors période : aucune location', jsonb_array_length(public.chat_tool_rentals(timestamptz '2030-07-01+01', timestamptz '2030-07-02+01', null, null)) = 0, '');
select pg_temp.ck('retours de la semaine : la location en cours est listée avec son numéro',
  (select r ->> 'phone' = '0661000001' from jsonb_array_elements(public.chat_tool_returns_due(timestamptz '2030-06-10+01', timestamptz '2030-06-16+01')) r), '');
select pg_temp.ck('voitures disponibles : celle qui est louée n''apparaît pas', not exists (select 1 from jsonb_array_elements(public.chat_tool_available_vehicles(timestamptz '2030-06-11 10:00+01', timestamptz '2030-06-12 10:00+01')) r where r ->> 'plate' = '1-A-1'), '');
select pg_temp.ck('voitures disponibles : la voiture libre apparaît', exists (select 1 from jsonb_array_elements(public.chat_tool_available_vehicles(timestamptz '2030-06-11 10:00+01', timestamptz '2030-06-12 10:00+01')) r where r ->> 'plate' = '3-A-3'), '');
select pg_temp.ck('voitures disponibles : la voiture en maintenance n''apparaît pas', not exists (select 1 from jsonb_array_elements(public.chat_tool_available_vehicles(timestamptz '2030-06-11 10:00+01', timestamptz '2030-06-12 10:00+01')) r where r ->> 'plate' = '5-A-5'), '');
select pg_temp.ck('voitures disponibles : la voiture louée redevient disponible après le retour', exists (select 1 from jsonb_array_elements(public.chat_tool_available_vehicles(timestamptz '2030-06-15+01', timestamptz '2030-06-16+01')) r where r ->> 'plate' = '1-A-1'), '');
select pg_temp.ck('dommage : on retrouve qui avait la voiture quand il est apparu',
  (select r ->> 'customer' = 'Karim Alami' and r ->> 'inspection_type' = 'retour' and (r ->> 'new_since_departure')::boolean from jsonb_array_elements(public.chat_tool_vehicle_damages('1-A-1')) r), '');
select pg_temp.ck('outil clients : compte les clients', (public.chat_tool_customers(null)->>'total_customers')::int >= 1, '');
select pg_temp.ck('outil clients : jamais de CIN ni permis', public.chat_tool_customers(null)::text not like '%AB123456%' and public.chat_tool_customers(null)::text not like '%PERMIS-SECRET%', '');
select pg_temp.ck('outil flotte : compte les voitures', (public.chat_tool_fleet()->>'total_vehicles')::int >= 1, '');

select pg_temp.ck('historique client : fonctionne par nom', jsonb_array_length(public.chat_tool_customer_history('karim')) = 1, '');
select pg_temp.ck('aucun CIN ni numéro de permis dans les résultats',
  public.chat_tool_customer_history('karim')::text not like '%AB123456%' and public.chat_tool_customer_history('karim')::text not like '%PERMIS-SECRET%'
  and public.chat_tool_rentals(null, null, null, 'karim')::text not like '%AB123456%', '');
select pg_temp.ck('l''outil ignore une recherche vide pour les dommages', jsonb_array_length(public.chat_tool_vehicle_damages('   ')) = 0, '');

-- une location pas encore démarrée (confirmée) dont la fin tombe dans la période est listée, avec son statut
reset role;
set session_replication_role = replica;
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue, branch_depart_id, branch_retour_id)
values ('a6000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'confirmee',
        timestamptz '2030-06-17 09:00+01', timestamptz '2030-06-18 09:00+01', 'b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001');
set session_replication_role = origin;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('retours : une location confirmée mais pas démarrée est listée, avec son statut',
  (select r ->> 'status' = 'confirmee' and (r ->> 'picked_up')::boolean = false from jsonb_array_elements(public.chat_tool_returns_due(timestamptz '2030-06-18 00:00+01', timestamptz '2030-06-18 23:59+01')) r), '');
select pg_temp.ck('retours : une location en cours est marquée comme déjà partie',
  (select (r ->> 'picked_up')::boolean from jsonb_array_elements(public.chat_tool_returns_due(timestamptz '2030-06-14 00:00+01', timestamptz '2030-06-14 23:59+01')) r), '');

-- isolation entreprise
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ck('une autre entreprise ne voit rien des locations de A', jsonb_array_length(public.chat_tool_rentals(null, null, null, 'karim')) = 0 and jsonb_array_length(public.chat_tool_vehicle_damages('1-A-1')) = 0 and jsonb_array_length(public.chat_tool_customer_history('karim')) = 0, '');
select pg_temp.ck('une autre entreprise ne voit pas les voitures de A', not exists (select 1 from jsonb_array_elements(public.chat_tool_available_vehicles(timestamptz '2030-06-15+01', timestamptz '2030-06-16+01')) r where r ->> 'plate' like '%-A-%'), '');

-- isolation filiale
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
select pg_temp.ck('un employé d''une autre filiale ne voit pas la location de Casa', jsonb_array_length(public.chat_tool_rentals(timestamptz '2030-06-11+01', timestamptz '2030-06-12+01', null, null)) = 0 and jsonb_array_length(public.chat_tool_returns_due(timestamptz '2030-06-10+01', timestamptz '2030-06-16+01')) = 0, '');
select pg_temp.ck('ni les dommages de Casa', jsonb_array_length(public.chat_tool_vehicle_damages('1-A-1')) = 0, '');
select pg_temp.ck('il ne voit que les voitures de sa filiale', (select bool_and(r ->> 'plate' = '4-A-4') from jsonb_array_elements(public.chat_tool_available_vehicles(timestamptz '2030-06-15+01', timestamptz '2030-06-16+01')) r), '');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('l''employé de Casa voit sa location', jsonb_array_length(public.chat_tool_rentals(timestamptz '2030-06-11+01', timestamptz '2030-06-12+01', null, null)) = 1, '');

-- outils en lecture seule
select pg_temp.try('un outil ne peut rien modifier', $$update vehicles set statut = 'disponible' where id = 'f1000000-0000-0000-0000-000000000001'$$);

-- historique : par utilisateur
select pg_temp.try('un employé crée sa conversation', $$insert into chat_conversations (id, agency_id, user_id, title) values ('d1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'Test')$$);
select pg_temp.try('il y écrit un message', $$insert into chat_convo_messages (conversation_id, agency_id, user_id, role, content) values ('d1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'user', 'Qui a la Logan ?')$$);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('même le propriétaire ne lit pas la conversation d''un employé', (select count(*) = 0 from chat_convo_messages) and (select count(*) = 0 from chat_conversations), '');
select pg_temp.try('on ne peut pas écrire dans la conversation d''un autre', $$insert into chat_convo_messages (conversation_id, agency_id, user_id, role, content) values ('d1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'user', 'intrusion')$$, 'row-level security');

-- accord du propriétaire
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('un employé ne peut pas activer le chat', $$select public.set_ai_chat_enabled('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'not_allowed') ;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('le propriétaire active le chat', $$select public.set_ai_chat_enabled('aaaaaaaa-0000-0000-0000-000000000001', true)$$);
select pg_temp.ck('le réglage est visible', (public.get_ocr_settings('aaaaaaaa-0000-0000-0000-000000000001') ->> 'chat_enabled') = 'true', '');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.try('activation impossible sans clé configurée', $$select public.set_ai_chat_enabled('bbbbbbbb-0000-0000-0000-000000000002', true)$$, 'ocr_key_missing');
select pg_temp.try('une autre entreprise ne peut pas activer le chat de A', $$select public.set_ai_chat_enabled('aaaaaaaa-0000-0000-0000-000000000001', false)$$, 'not_allowed');

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
