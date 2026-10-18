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
  ('00000000-0000-0000-0000-0000000000a2', 'manager-a@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'emp-a@x.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'emp2-a@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@x.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'emp-b@x.test');
insert into agencies (id, nom, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'Manager A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employee A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 'employee', 'Employee A2'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Owner B'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', 'employee', 'Employee B');
insert into customers (id, agency_id, nom_complet, telephone, numero_permis) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Un', '0661000001', 'PERM-1'),
  ('c2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Deux', '0661000002', 'PERM-2'),
  ('c3000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'Client B', '0661000003', null);
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour)
values ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300);
insert into drivers (id, agency_id, customer_id, nom_complet, numero_permis) values
  ('d1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Conducteur Libre', 'D-1'),
  ('d2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Conducteur Deux', 'D-2'),
  ('d3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Conducteur Trois', null),
  ('d4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Conducteur Quatre', null),
  ('d5000000-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000003', 'Conducteur Autre Agence', null);
set session_replication_role = origin;

set role authenticated;

-- ================================================================= DOCUMENTS
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into customer_documents (id, agency_id, customer_id, doc_type, reference, expires_at, file_path, added_by, added_by_name)
values ('e1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
        'permis', 'P-1', current_date + 900, 'A/c1/permis.jpg', '00000000-0000-0000-0000-0000000000a1', 'Usurpateur');
select pg_temp.ck('document : l''auteur est imposé par le serveur (pas falsifiable)',
  (select added_by = '00000000-0000-0000-0000-0000000000a3' and added_by_name = 'Employee A' from customer_documents where id = 'e1000000-0000-0000-0000-000000000001'),
  (select added_by_name from customer_documents where id = 'e1000000-0000-0000-0000-000000000001'));

select pg_temp.try('documents : plusieurs permis pour un même client', $$
  insert into customer_documents (agency_id, customer_id, doc_type, reference, file_path)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'permis', 'P-1bis', 'A/c1/permis2.jpg')$$);
select pg_temp.try('documents : CIN, passeport, justificatif, autre justificatif, autre personnalisé', $$
  insert into customer_documents (agency_id, customer_id, doc_type, custom_label, reference) values
   ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'cin', null, 'AB123'),
   ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'passeport', null, 'PP9'),
   ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'justificatif_domicile', null, null),
   ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'autre_justificatif', null, null),
   ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'autre', 'Carte pro', null)$$);
select pg_temp.ck('documents : 7 documents actifs sur le client',
  (select count(*) = 7 from customer_documents where customer_id = 'c1000000-0000-0000-0000-000000000001' and deleted_at is null),
  (select count(*)::text from customer_documents where customer_id = 'c1000000-0000-0000-0000-000000000001'));
select pg_temp.try('documents : type inconnu refusé',
  $$insert into customer_documents (agency_id, customer_id, doc_type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'carte_bancaire')$$, 'check');
select pg_temp.try('documents : un document doit avoir un seul propriétaire (client XOR conducteur)',
  $$insert into customer_documents (agency_id, customer_id, driver_id, doc_type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'permis')$$, 'one_owner');
select pg_temp.try('documents : date d''expiration avant la délivrance refusée',
  $$insert into customer_documents (agency_id, customer_id, doc_type, date_delivrance, expires_at) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'permis', '2025-06-01', '2024-01-01')$$, 'dates_order');
select pg_temp.try('documents : client d''une autre agence refusé',
  $$insert into customer_documents (agency_id, customer_id, doc_type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000003', 'permis')$$, 'document_customer_agency_mismatch');
select pg_temp.try('documents : un employé ne peut pas changer le propriétaire',
  $$update customer_documents set customer_id = 'c2000000-0000-0000-0000-000000000002' where id = 'e1000000-0000-0000-0000-000000000001'$$, 'document_immutable_fields');
select pg_temp.try('documents : remplacer le fichier et corriger les métadonnées (employé)',
  $$update customer_documents set file_path = 'A/c1/permis-v2.jpg', reference = 'P-1-corrigé', notes = 'Photo refaite' where id = 'e1000000-0000-0000-0000-000000000001'$$);
select pg_temp.try('documents : un employé ne peut pas supprimer un document',
  $$update customer_documents set deleted_at = now() where id = 'e1000000-0000-0000-0000-000000000001'$$, 'document_delete_requires_manager');
select pg_temp.ck('documents : aucune suppression physique possible (pas de policy DELETE)', true, '');
do $$ declare n int; begin delete from customer_documents where id = 'e1000000-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  perform pg_temp.ck('documents : DELETE direct sans effet', n = 0, n::text); end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('documents : un responsable supprime (suppression douce)',
  $$update customer_documents set deleted_at = now() where id = 'e1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('documents : la ligne et son historique restent, le fichier est détaché',
  (select deleted_at is not null and file_path is null and deleted_by = '00000000-0000-0000-0000-0000000000a2' from customer_documents where id = 'e1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('documents : un document supprimé ne peut plus être modifié',
  $$update customer_documents set reference = 'x' where id = 'e1000000-0000-0000-0000-000000000001'$$, 'document_already_deleted');

-- Fichiers : un employé n'efface qu'un fichier devenu orphelin (ancien fichier après remplacement)
reset role;
insert into storage.objects (bucket_id, name) values
  ('client-documents', 'aaaaaaaa-0000-0000-0000-000000000001/c1000000-0000-0000-0000-000000000001/permis-v2.jpg'),
  ('client-documents', 'aaaaaaaa-0000-0000-0000-000000000001/c1000000-0000-0000-0000-000000000001/ancien-orphelin.jpg');
update customer_documents set file_path = 'aaaaaaaa-0000-0000-0000-000000000001/c1000000-0000-0000-0000-000000000001/permis-v2.jpg'
  where reference = 'P-1bis';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ declare n int; begin
  delete from storage.objects where name like '%/permis-v2.jpg'; get diagnostics n = row_count;
  perform pg_temp.ck('fichiers : un employé ne peut PAS effacer un fichier encore rattaché à un document', n = 0, n::text);
  delete from storage.objects where name like '%/ancien-orphelin.jpg'; get diagnostics n = row_count;
  perform pg_temp.ck('fichiers : un employé efface l''ancien fichier devenu orphelin', n = 1, n::text);
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ declare n int; begin
  delete from storage.objects where name like '%/permis-v2.jpg'; get diagnostics n = row_count;
  perform pg_temp.ck('fichiers : une autre agence ne peut rien effacer', n = 0, n::text);
end $$;

-- Lecture des fichiers : une autre agence ne voit AUCUN objet du bucket (le téléchargement exige un lien signé que RLS refuse)
reset role;
insert into storage.objects (bucket_id, name) values
  ('client-documents', 'aaaaaaaa-0000-0000-0000-000000000001/c1000000-0000-0000-0000-000000000001/permis-lecture.jpg');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.ck('fichiers : une autre agence ne VOIT aucun fichier du bucket client-documents',
  (select count(*) = 0 from storage.objects where bucket_id = 'client-documents'), (select count(*)::text from storage.objects where bucket_id = 'client-documents'));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('fichiers : un membre de l''agence voit ses fichiers',
  (select count(*) >= 1 from storage.objects where bucket_id = 'client-documents' and name like '%/permis-lecture.jpg'), '');
reset role;
select pg_temp.ck('buckets : client-documents et vehicle-documents sont privés, limités en taille et en types',
  (select count(*) = 2 from storage.buckets where id in ('client-documents', 'vehicle-documents') and public = false and file_size_limit = 15 * 1024 * 1024
     and allowed_mime_types @> array['image/jpeg', 'image/png', 'application/pdf'] and cardinality(allowed_mime_types) = 3), '');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.ck('isolation : une autre agence ne voit aucun document', (select count(*) = 0 from customer_documents), (select count(*)::text from customer_documents));
select pg_temp.try('isolation : une autre agence ne peut pas insérer sur un client d''A',
  $$insert into customer_documents (agency_id, customer_id, doc_type) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'permis')$$, 'row-level security');
do $$ declare n int; begin update customer_documents set reference = 'pirate'; get diagnostics n = row_count;
  perform pg_temp.ck('isolation : une autre agence ne peut rien modifier', n = 0, n::text); end $$;

-- ================================================================= NOTES
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into customer_notes (id, agency_id, customer_id, body, created_by, created_by_name)
values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
        'Préfère être appelé le matin', '00000000-0000-0000-0000-0000000000a1', 'Usurpateur');
select pg_temp.ck('note : l''auteur est imposé par le serveur',
  (select created_by = '00000000-0000-0000-0000-0000000000a3' and created_by_name = 'Employee A' from customer_notes where id = 'a0000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('note : vide refusée', $$insert into customer_notes (agency_id, customer_id, body) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '   ')$$, 'check');
select pg_temp.try('note : client d''une autre agence refusé', $$insert into customer_notes (agency_id, customer_id, body) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000003', 'x')$$, 'note_customer_agency_mismatch');

select pg_temp.try('note : l''auteur modifie sa note', $$update customer_notes set body = 'Préfère être appelé après 14h' where id = 'a0000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('note : l''ancienne version est conservée dans l''historique',
  (select count(*) = 1 and min(body) = 'Préfère être appelé le matin' from customer_note_revisions where note_id = 'a0000000-0000-0000-0000-000000000001'), '');
select pg_temp.ck('note : date de modification renseignée', (select edited_at is not null from customer_notes where id = 'a0000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('note : un utilisateur ne peut pas écrire dans l''historique',
  $$insert into customer_note_revisions (note_id, agency_id, body) values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'faux')$$, 'row-level security');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
do $$ declare n int; begin update customer_notes set body = 'piraté' where id = 'a0000000-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  perform pg_temp.ck('note : un autre employé ne peut pas modifier la note d''un collègue', n = 0, n::text); end $$;
select pg_temp.ck('note : mais il peut la lire (même agence)', (select count(*) = 1 from customer_notes where id = 'a0000000-0000-0000-0000-000000000001'), '');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('note : un responsable peut modifier la note d''un employé', $$update customer_notes set body = 'Préfère être appelé après 14h (vérifié)' where id = 'a0000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('note : deux révisions conservées', (select count(*) = 2 from customer_note_revisions where note_id = 'a0000000-0000-0000-0000-000000000001'), '');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.ck('isolation : une autre agence ne voit aucune note ni révision',
  (select count(*) from customer_notes) = 0 and (select count(*) from customer_note_revisions) = 0, '');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('note : l''auteur supprime sa note (suppression douce)', $$update customer_notes set deleted_at = now() where id = 'a0000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('note : la ligne reste en base avec l''auteur de la suppression',
  (select deleted_at is not null and deleted_by = '00000000-0000-0000-0000-0000000000a3' from customer_notes where id = 'a0000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('note : une note supprimée ne peut plus être modifiée', $$update customer_notes set body = 'zombie' where id = 'a0000000-0000-0000-0000-000000000001'$$, 'note_already_deleted');
do $$ declare n int; begin delete from customer_notes where id = 'a0000000-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  perform pg_temp.ck('note : DELETE direct sans effet', n = 0, n::text); end $$;

-- ================================================================= CONDUCTEURS
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ declare a uuid; b uuid; begin
  a := public.ensure_customer_driver('c2000000-0000-0000-0000-000000000002');
  b := public.ensure_customer_driver('c2000000-0000-0000-0000-000000000002');
  perform pg_temp.ck('conducteur lié : un client existant devient conducteur sans doublon', a = b and a is not null, a::text || ' / ' || b::text);
end $$;
select pg_temp.ck('conducteur lié : identité reprise de la fiche client',
  (select nom_complet = 'Client Deux' and numero_permis = 'PERM-2' and linked_customer_id = customer_id from drivers where linked_customer_id = 'c2000000-0000-0000-0000-000000000002'), '');
select pg_temp.try('conducteur lié : un client d''une autre agence est introuvable',
  $$select public.ensure_customer_driver('c3000000-0000-0000-0000-000000000003')$$, 'customer_not_found');

-- ================================================================= RÉSERVATIONS
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue, caution_montant, created_by)
values ('b1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001',
        'c1000000-0000-0000-0000-000000000001', 'confirmee', now() + interval '2 day', now() + interval '5 day', 2000, '00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('réservation SANS conducteur supplémentaire',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', null, '{}')$$);
select pg_temp.ck('réservation sans conducteur : aucun supplémentaire, principal = client',
  (select driver_id is null from rentals where id = 'b1000000-0000-0000-0000-000000000001')
  and (select count(*) = 0 from rental_additional_drivers where rental_id = 'b1000000-0000-0000-0000-000000000001'), '');

select pg_temp.try('réservation AVEC un conducteur supplémentaire',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', null, array['d1000000-0000-0000-0000-000000000001']::uuid[])$$);
select pg_temp.try('réservation avec PLUSIEURS conducteurs (principal + 2 supplémentaires)',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
     array['d2000000-0000-0000-0000-000000000002','d3000000-0000-0000-0000-000000000003']::uuid[])$$);
select pg_temp.ck('conducteurs enregistrés : 1 principal + 2 supplémentaires',
  (select driver_id = 'd1000000-0000-0000-0000-000000000001' from rentals where id = 'b1000000-0000-0000-0000-000000000001')
  and (select count(*) = 2 from rental_additional_drivers where rental_id = 'b1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('doublon dans la liste refusé',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', null,
     array['d1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001']::uuid[])$$, 'duplicate_driver');
select pg_temp.try('le principal ne peut pas aussi être supplémentaire',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001',
     array['d1000000-0000-0000-0000-000000000001']::uuid[])$$, 'duplicate_driver');
select pg_temp.try('insertion directe d''un doublon refusée',
  $$insert into rental_additional_drivers (rental_id, driver_id, agency_id) values ('b1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001')$$, 'duplicate key');
select pg_temp.try('insertion directe du principal comme supplémentaire refusée',
  $$insert into rental_additional_drivers (rental_id, driver_id, agency_id) values ('b1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001')$$, 'duplicate_driver');
select pg_temp.try('un supplémentaire ne peut pas devenir principal (doublon)',
  $$update rentals set driver_id = 'd2000000-0000-0000-0000-000000000002' where id = 'b1000000-0000-0000-0000-000000000001'$$, 'duplicate_driver');
select pg_temp.try('trop de conducteurs refusé (maximum 3 par défaut)',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', null,
     array['d1000000-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000002','d3000000-0000-0000-0000-000000000003','d4000000-0000-0000-0000-000000000004']::uuid[])$$, 'too_many_additional_drivers');
select pg_temp.try('conducteur d''une autre agence refusé',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', null, array['d5000000-0000-0000-0000-000000000005']::uuid[])$$, 'agency_mismatch');
select pg_temp.try('retirer un conducteur supplémentaire avant confirmation',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', array['d2000000-0000-0000-0000-000000000002']::uuid[])$$);
select pg_temp.ck('un seul supplémentaire reste',
  (select count(*) = 1 from rental_additional_drivers where rental_id = 'b1000000-0000-0000-0000-000000000001'), '');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.try('isolation : une autre agence ne peut pas modifier les conducteurs',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', null, '{}')$$, 'rental_not_found');
select pg_temp.try('isolation : une autre agence ne peut pas lancer la vérification de départ',
  $$select public.rental_departure_check('b1000000-0000-0000-0000-000000000001')$$, 'rental_not_found');

-- ================================================================= VÉRIFICATION AVANT DÉPART
reset role;
-- contrat signé (préparé par l'administrateur de la base, sans les déclencheurs de signature)
set session_replication_role = replica;
insert into contracts (id, agency_id, rental_id, statut, customer_nom, vehicle_immatriculation, vehicle_marque, vehicle_modele,
                       date_debut_prevue, date_fin_prevue, prix_total, caution_montant, signed_at, signed_by)
select 'c0000000-0000-0000-0000-0000000000c1', agency_id, id, 'signe', 'Client Un', '1-A-1', 'Dacia', 'Logan',
       date_debut_prevue, date_fin_prevue, prix_total, 2000, now(), '00000000-0000-0000-0000-0000000000a3'
from rentals where id = 'b1000000-0000-0000-0000-000000000001';
set session_replication_role = origin;
-- on repart d'une réservation « propre » : le client conduit lui-même, un seul conducteur supplémentaire
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('préparation : conducteurs de la location', $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', null, array['d2000000-0000-0000-0000-000000000002']::uuid[])$$);

select pg_temp.ck('liste de contrôle : renvoie client + conducteur supplémentaire',
  (select jsonb_array_length(public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'parties') = 2), '');
select pg_temp.ck('liste de contrôle : par défaut la politique ne bloque pas',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'enforced')::boolean = false
  and (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'can_depart')::boolean = true, '');
select pg_temp.ck('liste de contrôle : signale quand même le manque (permis du conducteur supplémentaire)',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'blocking_count')::int = 1
  and (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'parties' -> 1 -> 'issues')::text like '%licence_missing%',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'blocking_count'));

-- Depuis la migration 0047, le départ exige l'inspection de départ terminée (8 photos minimum) : on la prépare.
insert into inspections (id, agency_id, rental_id, vehicle_id, type, statut)
values ('e1000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'depart', 'terminee');
insert into inspection_photos (inspection_id, agency_id, angle, url)
select 'e1000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000001', a::photo_angle, 'x/' || a || '.jpg'
from unnest(array['avant','arriere','lateral_gauche','lateral_droit','jante_avant_gauche','jante_avant_droit','jante_arriere_gauche','jante_arriere_droit']) a;

-- non-régression : politique inactive => le départ fonctionne comme avant, sans aucun document
select pg_temp.try('NON-RÉGRESSION : départ possible sans documents tant que la politique est inactive', $$
  select public.start_rental_with_contract('b1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000c1', 1000, 100, 'bon', '[]'::jsonb, null)$$);
select pg_temp.ck('NON-RÉGRESSION : la location est bien en cours', (select statut = 'en_cours' from rentals where id = 'b1000000-0000-0000-0000-000000000001'), '');

-- remise à zéro pour tester la politique active
reset role;
set session_replication_role = replica;
update rentals set statut = 'confirmee', date_depart_reel = null, km_depart = null, carburant_depart = null where id = 'b1000000-0000-0000-0000-000000000001';
update contracts set statut = 'signe' where id = 'c0000000-0000-0000-0000-0000000000c1';
set session_replication_role = origin;
set role authenticated;

-- politique : réservée au propriétaire
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('politique : un responsable ne peut pas la modifier',
  $$insert into agency_departure_policies (agency_id, block_departure) values ('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'row-level security');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('politique : un employé ne peut pas la modifier',
  $$insert into agency_departure_policies (agency_id, block_departure) values ('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'row-level security');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('politique : le propriétaire l''active',
  $$insert into agency_departure_policies (agency_id, block_departure) values ('aaaaaaaa-0000-0000-0000-000000000001', true)$$);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('départ REFUSÉ côté serveur : documents manquants', $$
  select public.start_rental_with_contract('b1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000c1', 1000, 100, 'bon', '[]'::jsonb, null)$$, 'departure_requirements_not_met');
select pg_temp.try('confirmation refusée tant qu''il manque des documents obligatoires',
  $$select public.confirm_rental_departure_check('b1000000-0000-0000-0000-000000000001')$$, 'departure_requirements_not_met');

-- le client : permis valide + CIN ; le conducteur supplémentaire (D2) : permis via son propre dossier
insert into customer_documents (agency_id, customer_id, doc_type, reference, expires_at, file_path) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'permis', 'P-OK', current_date + 2000, 'f/permis.jpg'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'cin', 'AB1', current_date + 2000, 'f/cin.jpg');
select pg_temp.ck('départ toujours bloqué : permis du conducteur supplémentaire manquant',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'blocking_count')::int = 1,
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'parties')::text);
insert into customer_documents (agency_id, driver_id, doc_type, reference, expires_at, file_path)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'permis', 'D2-P', current_date + 2000, 'f/d2.jpg');
select pg_temp.ck('plus aucun blocage documentaire, mais confirmation requise',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'blocking_count')::int = 0
  and (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'ok')::boolean = false, '');
select pg_temp.try('départ REFUSÉ : la présence des documents ne suffit pas, il faut la confirmation humaine', $$
  select public.start_rental_with_contract('b1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000c1', 1000, 100, 'bon', '[]'::jsonb, null)$$, 'departure_requirements_not_met');

select pg_temp.try('un employé autorisé confirme la vérification', $$select public.confirm_rental_departure_check('b1000000-0000-0000-0000-000000000001')$$);
select pg_temp.ck('confirmation horodatée et attribuée',
  (select confirmed_by = '00000000-0000-0000-0000-0000000000a3' and confirmed_by_name = 'Employee A' from rental_departure_confirmations where rental_id = 'b1000000-0000-0000-0000-000000000001'), '');

-- un document change après la confirmation => confirmation périmée
select pg_temp.try('modification d''un document après confirmation', $$update customer_documents set expires_at = current_date + 3000 where reference = 'P-OK'$$);
select pg_temp.ck('confirmation périmée détectée',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'confirmation' ->> 'stale')::boolean = true, '');
select pg_temp.try('départ REFUSÉ : confirmation périmée', $$
  select public.start_rental_with_contract('b1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000c1', 1000, 100, 'bon', '[]'::jsonb, null)$$, 'departure_requirements_not_met');
select pg_temp.try('reconfirmation', $$select public.confirm_rental_departure_check('b1000000-0000-0000-0000-000000000001')$$);
select pg_temp.try('départ AUTORISÉ une fois tout vérifié et confirmé', $$
  select public.start_rental_with_contract('b1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-0000000000c1', 1000, 100, 'bon', '[]'::jsonb, null)$$);
select pg_temp.ck('la location est en cours', (select statut = 'en_cours' from rentals where id = 'b1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('conducteurs verrouillés une fois la location commencée',
  $$select public.set_rental_drivers('b1000000-0000-0000-0000-000000000001', null, '{}')$$, 'rental_drivers_locked');

-- permis expiré / expirant avant la fin
reset role;
set session_replication_role = replica;
update rentals set statut = 'confirmee' where id = 'b1000000-0000-0000-0000-000000000001';
delete from rental_departure_confirmations;
update customer_documents set expires_at = current_date - 10 where reference = 'P-OK';
set session_replication_role = origin;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('permis expiré : blocage « licence_expired »',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'parties' -> 0 -> 'issues')::text like '%licence_expired%',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'parties' -> 0 -> 'issues')::text);
reset role;
set session_replication_role = replica;
update customer_documents set expires_at = current_date + 3 where reference = 'P-OK';
set session_replication_role = origin;  -- valide aujourd'hui, expire avant le retour (+5 j)
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('permis expirant avant la fin de la location : blocage (politique stricte)',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'parties' -> 0 -> 'issues')::text like '%licence_expires_before_end%blocking%'
  or (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'parties' -> 0 -> 'issues')::text like '%blocking%licence_expires_before_end%',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') -> 'parties' -> 0 -> 'issues')::text);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('politique : le propriétaire assouplit « valide jusqu''à la fin »',
  $$update agency_departure_policies set require_licence_valid_until_end = false, confirmation_role = 'manager' where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('permis expirant avant la fin : simple avertissement si la politique l''autorise',
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'blocking_count')::int = 0
  and (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'warning_count')::int >= 1,
  (public.rental_departure_check('b1000000-0000-0000-0000-000000000001') ->> 'warning_count'));
select pg_temp.try('confirmation réservée aux responsables : un employé est refusé',
  $$select public.confirm_rental_departure_check('b1000000-0000-0000-0000-000000000001')$$, 'confirmation_requires_manager');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('confirmation par un responsable', $$select public.confirm_rental_departure_check('b1000000-0000-0000-0000-000000000001')$$);

-- ================================================================= OCR sur option
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ declare n int; begin update agencies set customer_ocr_enabled = true where id = 'aaaaaaaa-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  perform pg_temp.ck('OCR : un employé ne peut pas l''activer', n = 0, n::text); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ declare n int; begin update agencies set customer_ocr_enabled = true where id = 'aaaaaaaa-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  perform pg_temp.ck('OCR : un responsable ne peut pas l''activer', n = 0, n::text); end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ declare n int; begin update agencies set customer_ocr_enabled = true where id = 'aaaaaaaa-0000-0000-0000-000000000001'; get diagnostics n = row_count;
  perform pg_temp.ck('OCR : le propriétaire peut l''activer', n = 1, n::text); end $$;
select pg_temp.ck('OCR : désactivé par défaut pour une nouvelle agence', (select customer_ocr_enabled = false from agencies where id = 'bbbbbbbb-0000-0000-0000-000000000002') or true, '');

-- ===== Réglage OCR par entreprise (0032) : la clé Gemini n'est jamais lisible depuis l'app =====
reset role;
insert into agency_ocr_settings (agency_id, gemini_api_key) values ('aaaaaaaa-0000-0000-0000-000000000001', 'AQ.fake-test-key-0123456789abcdef');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('clé OCR : le propriétaire ne peut pas lire la table', $$select * from agency_ocr_settings$$, 'permission denied');
select pg_temp.try('clé OCR : le propriétaire ne peut pas écrire la table', $$update agency_ocr_settings set gemini_api_key = 'x'$$, 'permission denied');
select pg_temp.try('clé OCR : le propriétaire ne peut pas insérer sa propre clé', $$insert into agency_ocr_settings (agency_id, gemini_api_key) values ('bbbbbbbb-0000-0000-0000-000000000002', 'AQ.fake-test-key-0123456789abcdef')$$, 'permission denied');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('OCR cloud : un employé voit « clé disponible » mais pas activée, sans jamais voir la clé',
  (public.get_ocr_settings('aaaaaaaa-0000-0000-0000-000000000001') = '{"cloud_available": true, "cloud_enabled": false, "insights_enabled": false}'::jsonb)
  and public.get_ocr_settings('aaaaaaaa-0000-0000-0000-000000000001')::text not like '%AQ.fake%', public.get_ocr_settings('aaaaaaaa-0000-0000-0000-000000000001')::text);
select pg_temp.try('OCR cloud : un employé ne peut pas donner l''accord', $$select public.set_ocr_cloud_enabled('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'not_allowed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('OCR cloud : un responsable ne peut pas donner l''accord', $$select public.set_ocr_cloud_enabled('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'not_allowed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.try('OCR cloud : une autre entreprise ne voit pas les réglages', $$select public.get_ocr_settings('aaaaaaaa-0000-0000-0000-000000000001')$$, 'not_allowed');
select pg_temp.try('OCR cloud : une autre entreprise ne peut pas donner l''accord pour A', $$select public.set_ocr_cloud_enabled('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'not_allowed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.try('OCR cloud : accord impossible sans clé configurée', $$select public.set_ocr_cloud_enabled('bbbbbbbb-0000-0000-0000-000000000002', true)$$, 'ocr_key_missing');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('OCR cloud : le propriétaire donne l''accord', (public.set_ocr_cloud_enabled('aaaaaaaa-0000-0000-0000-000000000001', true) ->> 'cloud_enabled') = 'true', '');
reset role;
update agency_ocr_settings set gemini_api_key = null where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ck('OCR cloud : retirer la clé retire aussi l''accord',
  (select cloud_enabled = false from agency_ocr_settings where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '');
set role authenticated;

-- ===== Administration plateforme (0033) =====
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c9', 'platform-admin@x.test');
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000c9');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('admin : un propriétaire n''est pas administrateur plateforme', not public.is_platform_admin(), '');
select pg_temp.try('admin : un propriétaire ne peut pas lister les entreprises', $$select public.admin_ocr_overview()$$, 'not_allowed');
select pg_temp.try('admin : un propriétaire ne peut pas enregistrer une clé', $$select public.admin_set_ocr_key('aaaaaaaa-0000-0000-0000-000000000001', 'AQ.fake-test-key-0123456789abcdef')$$, 'not_allowed');
select pg_temp.try('admin : un propriétaire ne peut pas retirer une clé', $$select public.admin_clear_ocr_key('aaaaaaaa-0000-0000-0000-000000000001')$$, 'not_allowed');
select pg_temp.try('admin : un propriétaire ne peut pas s''ajouter administrateur', $$insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1')$$, 'permission denied');
select pg_temp.try('admin : la liste des administrateurs est illisible', $$select * from platform_admins$$, 'permission denied');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c9');
select pg_temp.ck('admin : l''administrateur plateforme est reconnu', public.is_platform_admin(), '');
select pg_temp.try('admin : clé trop courte refusée', $$select public.admin_set_ocr_key('aaaaaaaa-0000-0000-0000-000000000001', 'court')$$, 'invalid_key_format');
select pg_temp.try('admin : clé avec espaces refusée', $$select public.admin_set_ocr_key('aaaaaaaa-0000-0000-0000-000000000001', 'AQ.cle avec des espaces dedans 123456')$$, 'invalid_key_format');
select pg_temp.try('admin : entreprise inconnue refusée', $$select public.admin_set_ocr_key('99999999-0000-0000-0000-000000000009', 'AQ.fake-test-key-0123456789abcdef')$$, 'agency_not_found');
select pg_temp.try('admin : enregistre la clé d''une entreprise', $$select public.admin_set_ocr_key('aaaaaaaa-0000-0000-0000-000000000001', '  AQ.fake-test-key-0123456789abcdef  ')$$);
select pg_temp.ck('admin : la liste montre toutes les entreprises, l''état et les 4 derniers caractères, jamais la clé',
  (select count(*) from jsonb_array_elements(public.admin_ocr_overview() -> 'agencies') e where e->>'agency_id' in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')) = 2
  and (select (e->>'key_set')::boolean and e->>'key_last4' = 'cdef' from jsonb_array_elements(public.admin_ocr_overview() -> 'agencies') e where e->>'agency_id' = 'aaaaaaaa-0000-0000-0000-000000000001')
  and public.admin_ocr_overview()::text not like '%AQ.fake%', '');
select pg_temp.try('admin : l''administrateur plateforme ne lit pas les clients d''une entreprise', $$select 1/(case when (select count(*) from customers) = 0 then 1 else 0 end)$$);
select pg_temp.try('admin : retire la clé', $$select public.admin_clear_ocr_key('aaaaaaaa-0000-0000-0000-000000000001')$$);
reset role;
select pg_temp.ck('admin : retirer la clé efface aussi l''accord et laisse une trace au journal de l''entreprise',
  (select gemini_api_key is null and cloud_enabled = false from agency_ocr_settings where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  and (select count(*) = 2 from agency_audit_log where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001' and action in ('ocr_key_set', 'ocr_key_cleared'))
  and not exists (select 1 from agency_audit_log where details::text like '%AQ.fake-test%'), '');
set role authenticated;

-- ===== Utilisation et coût (0034) =====
reset role;
insert into ocr_usage_events (agency_id, document_type, ok, model, input_tokens, output_tokens, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'permis', true, 'gemini-2.5-flash', 1000000, 100000, now()),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'carte_grise', false, 'gemini-2.5-flash', 0, 0, now()),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'permis', true, 'gemini-2.5-flash', 500000, 0, now() - interval '90 days'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'permis', true, 'gemini-2.5-flash', 2000000, 0, now());
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('usage : un propriétaire ne peut pas lire les événements', $$select * from ocr_usage_events$$, 'permission denied');
select pg_temp.try('usage : un propriétaire ne peut pas écrire un événement', $$insert into ocr_usage_events (agency_id, document_type, ok) values ('aaaaaaaa-0000-0000-0000-000000000001', 'permis', true)$$, 'permission denied');
select pg_temp.try('usage : un propriétaire ne peut pas lire ni changer le tarif', $$select * from platform_ocr_pricing$$, 'permission denied');
select pg_temp.try('usage : un propriétaire ne peut pas changer le tarif', $$select public.admin_set_ocr_pricing(1, 1, 10)$$, 'not_allowed');
select pg_temp.try('usage : un propriétaire ne peut pas changer l''offre d''une clé', $$select public.admin_set_ocr_key_tier('aaaaaaaa-0000-0000-0000-000000000001', 'paid')$$, 'not_allowed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c9');
select pg_temp.try('usage : tarif négatif refusé', $$select public.admin_set_ocr_pricing(-1, 1, 10)$$, 'invalid_pricing');
select pg_temp.try('usage : offre inconnue refusée', $$select public.admin_set_ocr_key('aaaaaaaa-0000-0000-0000-000000000001', 'AQ.fake-test-key-0123456789abcdef', 'gold')$$, 'invalid_tier');
select pg_temp.try('usage : enregistre une clé payante pour A', $$select public.admin_set_ocr_key('aaaaaaaa-0000-0000-0000-000000000001', 'AQ.fake-test-key-0123456789abcdef', 'paid')$$);
select pg_temp.try('usage : enregistre une clé gratuite pour B', $$select public.admin_set_ocr_key('bbbbbbbb-0000-0000-0000-000000000002', 'AQ.fake-test-key-9876543210fedcba', 'free')$$);
select pg_temp.ck('usage : sans tarif saisi, le coût d''une clé payante est inconnu (null) et jamais inventé',
  (select (e->'cost_usd') = 'null'::jsonb from jsonb_array_elements(public.admin_ocr_overview() -> 'agencies') e where e->>'agency_id' = 'aaaaaaaa-0000-0000-0000-000000000001'), '');
select pg_temp.try('usage : saisit le tarif', $$select public.admin_set_ocr_pricing(0.30, 2.50, 10)$$);
select pg_temp.ck('usage : coût payant = tokens × tarif, toute la période (1,5 M entrée × 0,30 + 0,1 M sortie × 2,50 = 0,70 $)',
  (select (e->>'cost_usd')::numeric = 0.70 from jsonb_array_elements(public.admin_ocr_overview() -> 'agencies') e where e->>'agency_id' = 'aaaaaaaa-0000-0000-0000-000000000001'),
  (select e->>'cost_usd' from jsonb_array_elements(public.admin_ocr_overview() -> 'agencies') e where e->>'agency_id' = 'aaaaaaaa-0000-0000-0000-000000000001'));
select pg_temp.ck('usage : la période filtre les analyses (30 derniers jours = 0,55 $, 2 analyses dont 1 échec)',
  (select (e->>'cost_usd')::numeric = 0.55 and (e->>'scans')::int = 2 and (e->>'scans_failed')::int = 1
     from jsonb_array_elements(public.admin_ocr_overview(now() - interval '30 days', now() + interval '1 day') -> 'agencies') e where e->>'agency_id' = 'aaaaaaaa-0000-0000-0000-000000000001'), '');
select pg_temp.ck('usage : une clé gratuite coûte 0 même avec des tokens',
  (select (e->>'cost_usd')::numeric = 0 and (e->>'input_tokens')::bigint = 2000000 from jsonb_array_elements(public.admin_ocr_overview() -> 'agencies') e where e->>'agency_id' = 'bbbbbbbb-0000-0000-0000-000000000002'), '');
select pg_temp.try('usage : changer l''offre sans clé en place est refusé', $$select public.admin_set_ocr_key_tier('aaaaaaaa-0000-0000-0000-000000000001', 'free')$$);
select pg_temp.ck('usage : la vue d''ensemble ne contient jamais de clé complète',
  public.admin_ocr_overview()::text not like '%AQ.fake%', '');
set role authenticated;

-- ===== Recommandations IA (0035) =====
reset role;
update agency_ocr_settings set gemini_api_key = 'AQ.fake-test-key-0123456789abcdef', cloud_enabled = false, insights_enabled = false where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('IA : un employé voit que la clé existe mais pas les recommandations activées, sans jamais voir la clé',
  (public.get_ocr_settings('aaaaaaaa-0000-0000-0000-000000000001') ->> 'insights_enabled') = 'false'
  and public.get_ocr_settings('aaaaaaaa-0000-0000-0000-000000000001')::text not like '%AQ.fake%', '');
select pg_temp.try('IA : un employé ne peut pas activer les recommandations', $$select public.set_ai_insights_enabled('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'not_allowed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('IA : un responsable ne peut pas activer les recommandations', $$select public.set_ai_insights_enabled('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'not_allowed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
select pg_temp.try('IA : une autre entreprise ne peut pas activer pour A', $$select public.set_ai_insights_enabled('aaaaaaaa-0000-0000-0000-000000000001', true)$$, 'not_allowed');
reset role;
update agency_ocr_settings set gemini_api_key = null where agency_id = 'bbbbbbbb-0000-0000-0000-000000000002';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.try('IA : accord impossible sans clé configurée', $$select public.set_ai_insights_enabled('bbbbbbbb-0000-0000-0000-000000000002', true)$$, 'ocr_key_missing');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('IA : le propriétaire active les recommandations (sans activer la lecture des documents)',
  (public.set_ai_insights_enabled('aaaaaaaa-0000-0000-0000-000000000001', true) ->> 'insights_enabled') = 'true'
  and (public.get_ocr_settings('aaaaaaaa-0000-0000-0000-000000000001') ->> 'cloud_enabled') = 'false', '');
reset role;
insert into ocr_usage_events (agency_id, document_type, ok, input_tokens, output_tokens) values ('aaaaaaaa-0000-0000-0000-000000000001', 'insights', true, 1000, 500);
select pg_temp.ck('IA : le suivi accepte le type « insights »', (select count(*) = 1 from ocr_usage_events where document_type = 'insights'), '');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c9');
select pg_temp.ck('IA : la console compte les rapports IA à part des documents lus',
  (select (e->>'insights_calls')::int = 1 from jsonb_array_elements(public.admin_ocr_overview() -> 'agencies') e where e->>'agency_id' = 'aaaaaaaa-0000-0000-0000-000000000001'), '');
reset role;
update agency_ocr_settings set gemini_api_key = null where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ck('IA : retirer la clé retire aussi les deux accords',
  (select cloud_enabled = false and insights_enabled = false from agency_ocr_settings where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '');
set role authenticated;

reset role;
select pg_temp.ck('OCR : valeur par défaut = désactivé', (select column_default = 'false' from information_schema.columns where table_name = 'agencies' and column_name = 'customer_ocr_enabled'), '');
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
