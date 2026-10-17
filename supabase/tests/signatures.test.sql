-- Tests SQL des signatures manuscrites (migration 0037) : profil, contrat, isolation entre agences, preuve infalsifiable.
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
set session_replication_role = origin;
grant all on res to authenticated;
set role authenticated;

-- Profil : signature personnelle
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('profil : l''employé référence sa propre signature',
  $$update agency_members set signature_path = 'aaaaaaaa-0000-0000-0000-000000000001/staff/00000000-0000-0000-0000-0000000000a3.json' where user_id = '00000000-0000-0000-0000-0000000000a3'$$);
select pg_temp.try('profil : impossible de référencer le fichier de quelqu''un d''autre',
  $$update agency_members set signature_path = 'aaaaaaaa-0000-0000-0000-000000000001/staff/00000000-0000-0000-0000-0000000000a1.json' where user_id = '00000000-0000-0000-0000-0000000000a3'$$, 'invalid_signature_path');
select pg_temp.try('stockage : l''employé dépose sa signature',
  $$insert into storage.objects (bucket_id, name) values ('signatures', 'aaaaaaaa-0000-0000-0000-000000000001/staff/00000000-0000-0000-0000-0000000000a3.json')$$);
select pg_temp.try('stockage : impossible de déposer dans le dossier signature d''un collègue',
  $$insert into storage.objects (bucket_id, name) values ('signatures', 'aaaaaaaa-0000-0000-0000-000000000001/staff/00000000-0000-0000-0000-0000000000a1.json')$$, 'row-level security');
select pg_temp.try('stockage : impossible de déposer dans une autre agence',
  $$insert into storage.objects (bucket_id, name) values ('signatures', 'bbbbbbbb-0000-0000-0000-000000000002/staff/00000000-0000-0000-0000-0000000000a3.json')$$, 'row-level security');

-- Contrat : la signature du client est obligatoire
select pg_temp.try('contrat : refus de signer sans signature du client',
  $$update contracts set statut = 'signe', signed_at = now(), signed_by = '00000000-0000-0000-0000-0000000000a3' where id = 'c0000000-0000-0000-0000-0000000000c1'$$, 'contract_client_signature_required');
select pg_temp.try('contrat : refus d''un fichier appartenant à un autre contrat',
  $$update contracts set client_signature_path = 'aaaaaaaa-0000-0000-0000-000000000001/contracts/autre/client-1.json' where id = 'c0000000-0000-0000-0000-0000000000c1'$$, 'invalid_signature_path');
select pg_temp.try('contrat : signature du client + de l''agence acceptées',
  $$update contracts set client_signature_path = 'aaaaaaaa-0000-0000-0000-000000000001/contracts/c0000000-0000-0000-0000-0000000000c1/client-1.json',
      agency_signature_path = 'aaaaaaaa-0000-0000-0000-000000000001/contracts/c0000000-0000-0000-0000-0000000000c1/agence-1.json',
      client_signed_at = now(), statut = 'signe', signed_at = now(), signed_by = '00000000-0000-0000-0000-0000000000a3'
    where id = 'c0000000-0000-0000-0000-0000000000c1'$$);
select pg_temp.try('contrat : la signature du client ne peut plus être remplacée',
  $$update contracts set client_signature_path = 'aaaaaaaa-0000-0000-0000-000000000001/contracts/c0000000-0000-0000-0000-0000000000c1/client-2.json' where id = 'c0000000-0000-0000-0000-0000000000c1'$$, 'contract_signature_locked');
select pg_temp.try('contrat : la date de signature ne peut plus être modifiée',
  $$update contracts set client_signed_at = now() + interval '1 day' where id = 'c0000000-0000-0000-0000-0000000000c1'$$, 'contract_signature_locked');
select pg_temp.try('contrat : un contrat signé reste modifiable ailleurs (pdf)',
  $$update contracts set pdf_path = 'x.pdf' where id = 'c0000000-0000-0000-0000-0000000000c1'$$);

-- Signatures de contrat : ajout seul
select pg_temp.try('stockage : dépôt de la copie figée de la signature du client',
  $$insert into storage.objects (bucket_id, name) values ('signatures', 'aaaaaaaa-0000-0000-0000-000000000001/contracts/c0000000-0000-0000-0000-0000000000c1/client-1.json')$$);
select pg_temp.try('stockage : la copie figée ne peut pas être supprimée',
  $$delete from storage.objects where name like '%/contracts/%'$$);
select pg_temp.ck('stockage : la copie figée est toujours là', (select count(*) = 1 from storage.objects where name like '%/contracts/%'), '');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ck('isolation : une autre agence ne voit aucune signature', (select count(*) = 0 from storage.objects where bucket_id = 'signatures'), (select count(*)::text from storage.objects));

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
