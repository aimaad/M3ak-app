-- Tests SQL des modèles de contrat (migration 0040) : réservé au propriétaire, isolé par agence, figé à la signature.
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
  ('00000000-0000-0000-0000-0000000000a2', 'manager@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@x.test');
insert into agencies (id, nom, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'Manager A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employee A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Owner B');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour)
values ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300);
set session_replication_role = origin;

grant all on res to authenticated;
set role authenticated;

reset role;
set session_replication_role = replica;
insert into customers (id, agency_id, nom_complet) values ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Un');
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue)
  values ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'confirmee', now() + interval '1 day', now() + interval '3 day');
insert into contracts (id, agency_id, rental_id, statut, customer_nom, vehicle_immatriculation, vehicle_marque, vehicle_modele, date_debut_prevue, date_fin_prevue, prix_total, caution_montant)
  values ('c0000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'pret_a_signer', 'Client Un', '1-A-1', 'Dacia', 'Logan', now() + interval '1 day', now() + interval '3 day', 900, 2000);
update agencies set stamp_path = 'aaaaaaaa-0000-0000-0000-000000000001/stamp.png', logo_url = 'aaaaaaaa-0000-0000-0000-000000000001/logo.png' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set session_replication_role = origin;
grant all on res to authenticated;
set role authenticated;

-- Écriture réservée au propriétaire
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('modèle : un employé ne peut pas en créer',
  $$insert into agency_contract_templates (agency_id, template) values ('aaaaaaaa-0000-0000-0000-000000000001', '{"v":1,"blocks":[]}')$$, 'row-level security');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('modèle : un responsable ne peut pas en créer',
  $$insert into agency_contract_templates (agency_id, template) values ('aaaaaaaa-0000-0000-0000-000000000001', '{"v":1,"blocks":[]}')$$, 'row-level security');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.try('modèle : le propriétaire d''une autre agence ne peut pas écrire chez A',
  $$insert into agency_contract_templates (agency_id, template) values ('aaaaaaaa-0000-0000-0000-000000000001', '{"v":1,"blocks":[]}')$$, 'row-level security');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('modèle : le propriétaire enregistre son modèle',
  $$insert into agency_contract_templates (agency_id, template, source_name) values ('aaaaaaaa-0000-0000-0000-000000000001', '{"v":1,"direction":"ltr","blocks":[{"type":"paragraph","text":"Contrat {{numero}}"}]}', 'mon-contrat.pdf')$$);
select pg_temp.try('modèle : refus d''un contenu qui n''est pas un objet',
  $$update agency_contract_templates set template = '[1,2]' where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'contract_template_is_object');

-- Lecture : toute l'agence, personne d'autre
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('modèle : un employé peut le lire (pour générer les contrats)', (select count(*) = 1 from agency_contract_templates), '');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ck('modèle : une autre agence ne le voit pas', (select count(*) = 0 from agency_contract_templates), '');

-- Figé à la signature
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('contrat : signature avec le modèle figé',
  $$update contracts set client_signature_path = 'aaaaaaaa-0000-0000-0000-000000000001/contracts/c0000000-0000-0000-0000-0000000000c1/client-1.json',
      client_signed_at = now(), statut = 'signe', signed_at = now(), signed_by = '00000000-0000-0000-0000-0000000000a3',
      terms_snapshot = '{"v":1,"blocks":[{"type":"paragraph","text":"Version 1"}]}'
    where id = 'c0000000-0000-0000-0000-0000000000c1'$$);
select pg_temp.try('contrat : le modèle figé ne peut plus être remplacé',
  $$update contracts set terms_snapshot = '{"v":1,"blocks":[{"type":"paragraph","text":"Version 2"}]}' where id = 'c0000000-0000-0000-0000-0000000000c1'$$, 'contract_signature_locked');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
update agency_contract_templates set template = '{"v":1,"blocks":[{"type":"paragraph","text":"Nouveau modèle"}]}' where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ck('contrat signé : inchangé quand l''agence modifie son modèle ensuite',
  (select terms_snapshot::text like '%Version 1%' from contracts where id = 'c0000000-0000-0000-0000-0000000000c1'), '');

-- Traçabilité : sans contenu du modèle
select pg_temp.ck('journal : l''enregistrement du modèle est tracé sans son contenu',
  (select count(*) >= 1 and bool_and(coalesce(details::text, '') not like '%Nouveau modèle%') from agency_audit_log where action = 'contract_template_saved'), '');
select pg_temp.try('modèle : le propriétaire peut revenir au modèle standard (suppression)',
  $$delete from agency_contract_templates where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
