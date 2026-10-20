-- Tests SQL du module Clients / Conducteurs / Départ (migrations 0028 et 0029).
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
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'emp-a@x.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager-a@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@x.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'emp-b@x.test');
insert into agencies (id, nom, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'Manager A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employee A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Owner B'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', 'employee', 'Employee B');
insert into customers (id, agency_id, nom_complet, telephone) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Un', '0661000001');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour)
values ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300);
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue)
values ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'en_cours', now() - interval '3 day', now());
insert into inspections (id, agency_id, rental_id, vehicle_id, type, statut)
values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'retour', 'terminee');
set session_replication_role = origin;
grant all on res to authenticated;

-- ----------------------------------------------------------------- scénarios
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');

select pg_temp.try('inspection : un employé enregistre une photo d''un nouvel angle (siège passager)',
  $$insert into inspection_photos (inspection_id, agency_id, angle, url) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'siege_avant_droit', 'x/y.jpg')$$);
select pg_temp.try('inspection : un angle inconnu est refusé',
  $$insert into inspection_photos (inspection_id, agency_id, angle, url) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'sous_la_voiture', 'x/z.jpg')$$, 'invalid input value for enum');

select pg_temp.try('dommage : un employé ajoute un dommage de l''intérieur (siège déchiré)',
  $$insert into damages (id, inspection_id, agency_id, zone, type, gravite, nouveau, cout_estime, statut, source) values ('d1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'siege_avant_gauche', 'dechirure', 'modere', true, 1200, 'propose', 'ia')$$);
select pg_temp.try('dommage : un statut inconnu est refusé',
  $$insert into damages (inspection_id, agency_id, zone, type, statut) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'capot', 'rayure', 'valide')$$, 'damages_statut_check');
select pg_temp.try('dommage : un coût validé négatif est refusé',
  $$insert into damages (inspection_id, agency_id, zone, type, cout_valide) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'capot', 'rayure', -5)$$, 'cout_valide');
select pg_temp.try('dommage : l''employé confirme et corrige le coût',
  $$update damages set statut = 'confirme', cout_valide = 900, valide_par = '00000000-0000-0000-0000-0000000000a3', valide_le = now() where id = 'd1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('dommage : la validation est bien enregistrée',
  (select statut = 'confirme' and cout_valide = 900 and cout_estime = 1200 from damages where id = 'd1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('dommage : un employé ne peut pas supprimer un dommage (responsable seulement)',
  $$delete from damages where id = 'd1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('dommage : la suppression par un employé n''a rien supprimé', (select count(*) = 1 from damages), '');

select pg_temp.try('analyse : un état d''analyse inconnu est refusé',
  $$update inspections set analysis_status = 'bientot' where id = 'e1000000-0000-0000-0000-000000000001'$$, 'analysis_status');
select pg_temp.try('analyse : le niveau de carburant doit rester entre 0 et 100',
  $$update inspections set niveau_carburant = 140 where id = 'e1000000-0000-0000-0000-000000000001'$$, 'niveau_carburant');
select pg_temp.try('analyse : relevés et état de l''analyse enregistrés',
  $$update inspections set kilometrage = 45210, niveau_carburant = 50, proprete = 'correcte', analysis_status = 'terminee', analyzed_at = now() where id = 'e1000000-0000-0000-0000-000000000001'$$);

-- Isolation entre agences.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.ck('isolation : l''employé d''une autre agence ne voit aucun dommage', (select count(*) = 0 from damages), '');
select pg_temp.try('isolation : il ne peut pas en ajouter sur l''inspection d''une autre agence',
  $$insert into damages (inspection_id, agency_id, zone, type) values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'capot', 'rayure')$$, 'row-level security');

-- Un responsable peut supprimer.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('dommage : un responsable peut supprimer', $$delete from damages where id = 'd1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('dommage : supprimé par le responsable', (select count(*) = 0 from damages), '');

-- Le départ exige l'inspection de départ terminée (migration 0047).
reset role;
set session_replication_role = replica;
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue)
values ('a2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'confirmee', now(), now() + interval '2 day');
insert into contracts (id, agency_id, rental_id, statut, customer_nom, vehicle_immatriculation, vehicle_marque, vehicle_modele, date_debut_prevue, date_fin_prevue, prix_total, caution_montant)
values ('c0000000-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'signe', 'Client Un', '1-A-1', 'Dacia', 'Logan', now(), now() + interval '2 day', 600, 2000);
set session_replication_role = origin;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('départ : refusé sans inspection de départ',
  $$select public.start_rental_with_contract('a2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000c2', 1000, 100, 'bon', '[]'::jsonb, null)$$, 'departure_inspection_required');
reset role;
set session_replication_role = replica;
insert into inspections (id, agency_id, rental_id, vehicle_id, type, statut)
values ('e2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'depart', 'en_cours');
set session_replication_role = origin;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('départ : refusé si l''inspection de départ n''est pas terminée',
  $$select public.start_rental_with_contract('a2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000c2', 1000, 100, 'bon', '[]'::jsonb, null)$$, 'departure_inspection_required');
update inspections set statut = 'terminee' where id = 'e2000000-0000-0000-0000-000000000002';
select pg_temp.try('départ : refusé si l''inspection est terminée mais sans assez de photos',
  $$select public.start_rental_with_contract('a2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000c2', 1000, 100, 'bon', '[]'::jsonb, null)$$, 'departure_inspection_required');
insert into inspection_photos (inspection_id, agency_id, angle, url)
select 'e2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', a::photo_angle, 'x/' || a || '.jpg'
from unnest(array['avant','arriere','lateral_gauche','lateral_droit','jante_avant_gauche','jante_avant_droit','jante_arriere_gauche','jante_arriere_droit']) a;
select pg_temp.try('départ : accepté avec l''inspection terminée et ses photos',
  $$select public.start_rental_with_contract('a2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-0000000000c2', 1000, 100, 'bon', '[]'::jsonb, null)$$);
select pg_temp.ck('départ : la location est bien passée en cours', (select statut = 'en_cours' from rentals where id = 'a2000000-0000-0000-0000-000000000002'), '');

-- Exigence du propriétaire : CIN ou passeport pour créer une location (migration 0049).
reset role;
set session_replication_role = replica;
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour)
values ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Renault', 'Clio', 350);
insert into customers (id, agency_id, nom_complet, telephone) values
  ('c2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Sans Papier', '0661000002'),
  ('c3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Avec Doc', '0661000003');
set session_replication_role = origin;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('exigence : par défaut, une location sans CIN est possible',
  $$insert into rentals (agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'en_attente_confirmation', now() + interval '10 day', now() + interval '12 day')$$);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('exigence : le propriétaire exige le CIN pour une location',
  $$insert into agency_departure_policies (agency_id, require_id_at_rental) values ('aaaaaaaa-0000-0000-0000-000000000001', true)$$);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('exigence : refusée si le client n''a ni CIN ni passeport',
  $$insert into rentals (agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'en_attente_confirmation', now() + interval '20 day', now() + interval '22 day')$$, 'customer_id_required');
select pg_temp.try('exigence : un employé ne peut pas la désactiver',
  $$update agency_departure_policies set require_id_at_rental = false where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select pg_temp.ck('exigence : elle est toujours active après la tentative', (select require_id_at_rental from agency_departure_policies where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '');
select pg_temp.try('exigence : acceptée quand le client a un numéro de CIN sur sa fiche',
  $$update customers set cin_ou_passeport = 'Z188822' where id = 'c2000000-0000-0000-0000-000000000002'$$);
select pg_temp.try('exigence : location acceptée avec le CIN de la fiche',
  $$insert into rentals (agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'en_attente_confirmation', now() + interval '20 day', now() + interval '22 day')$$);
select pg_temp.try('exigence : un document « CIN » du dossier suffit aussi',
  $$insert into customer_documents (agency_id, customer_id, doc_type, reference) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000003', 'cin', 'F670782')$$);
select pg_temp.try('exigence : location acceptée avec le document CIN',
  $$insert into rentals (agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000003', 'en_attente_confirmation', now() + interval '30 day', now() + interval '32 day')$$);
select pg_temp.ck('exigence : le permis par défaut reste exigé à la création d''un client', (select require_licence_at_customer from get_departure_policy('bbbbbbbb-0000-0000-0000-000000000002')), '');

-- Inspection ignorée, analyse déclinée, dommage inscrit au contrat (migration 0050).
reset role;
set session_replication_role = replica;
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue)
values ('a3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'confirmee', now() + interval '40 day', now() + interval '42 day');
insert into contracts (id, agency_id, rental_id, statut, customer_nom, vehicle_immatriculation, vehicle_marque, vehicle_modele, date_debut_prevue, date_fin_prevue, prix_total, caution_montant)
values ('c0000000-0000-0000-0000-0000000000c3', 'aaaaaaaa-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'signe', 'Client Un', '1-A-1', 'Dacia', 'Logan', now() + interval '40 day', now() + interval '42 day', 600, 2000);
set session_replication_role = origin;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('ignorer : l''employé ignore l''inspection de départ (aucune photo)',
  $$insert into inspections (id, agency_id, rental_id, vehicle_id, type, statut, skipped) values ('e3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000003', 'f1000000-0000-0000-0000-000000000001', 'depart', 'terminee', true)$$);
select pg_temp.ck('ignorer : qui et quand sont enregistrés par le serveur',
  (select skipped_by = '00000000-0000-0000-0000-0000000000a3' and skipped_at is not null from inspections where id = 'e3000000-0000-0000-0000-000000000003'), '');
select pg_temp.try('ignorer : le départ est accepté sans photos quand l''inspection est ignorée',
  $$select public.start_rental_with_contract('a3000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-0000000000c3', 1000, 100, 'bon', '[]'::jsonb, null)$$);
select pg_temp.ck('ignorer : la location est bien en cours', (select statut = 'en_cours' from rentals where id = 'a3000000-0000-0000-0000-000000000003'), '');
select pg_temp.try('ignorer : on peut reprendre l''inspection (elle n''est plus ignorée)',
  $$update inspections set skipped = false, statut = 'en_cours' where id = 'e3000000-0000-0000-0000-000000000003'$$);
select pg_temp.ck('ignorer : le serveur efface alors qui / quand', (select skipped_by is null and skipped_at is null from inspections where id = 'e3000000-0000-0000-0000-000000000003'), '');
select pg_temp.try('décliner : l''analyse déclinée est un état valide',
  $$update inspections set analysis_status = 'refusee' where id = 'e1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('contrat : un dommage est inscrit au contrat par défaut', (select count(*) = 0 from damages where dans_contrat = false), '');
select pg_temp.try('contrat : l''employé peut décider de ne pas inscrire un dommage',
  $$insert into damages (id, inspection_id, agency_id, zone, type, statut, source, dans_contrat) values ('d9000000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'capot', 'rayure', 'confirme', 'manuel', false)$$);

-- Cachet généré (migration 0048) : il suffit, avec le logo, pour signer ; une configuration trop lourde est refusée.
reset role;
update agencies set logo_url = 'aaaaaaaa-0000-0000-0000-000000000001/logo.png' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.try('cachet : une configuration de cachet valide est acceptée',
  $$update agencies set stamp_config = '{"v":1,"shape":"round","color":"blue","title":"ATLAS","lines":[],"bottom":""}'::jsonb where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select pg_temp.try('cachet : une configuration qui n''est pas un objet est refusée',
  $$update agencies set stamp_config = '[1,2]'::jsonb where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'agencies_stamp_config_check');

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
