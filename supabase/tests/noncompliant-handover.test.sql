-- Tests SQL : la remise d'un véhicule « À régulariser » est tracée, jamais bloquée (migration 0078).
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
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé');
insert into customers (id, agency_id, nom_complet, telephone) values ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Karim Alami', '0661000001');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Kia', 'Rio', 300),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-3', 'Fiat', 'Tipo', 300),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '4-A-4', 'Seat', 'Ibiza', 300);
-- 1 : assurance ET visite expirées ; 2 : tout à jour ; 3 : aucune période enregistrée ; 4 : ancienne assurance expirée MAIS renouvelée.
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', date '2020-01-01'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'visite_technique', date '2020-06-01'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'assurance', date '2099-01-01'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'visite_technique', date '2099-01-01'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'assurance', date '2020-01-01'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'assurance', date '2099-01-01'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'vignette', date '2020-12-31');
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'confirmee', now(), now() + interval '2 days'),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'confirmee', now(), now() + interval '2 days'),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'confirmee', now(), now() + interval '2 days'),
  ('a1000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001', 'confirmee', now(), now() + interval '2 days');
set session_replication_role = origin;

-- Un employé remet les véhicules : AUCUN blocage, quel que soit l'état des documents.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('remise d''un véhicule à régulariser : jamais bloquée', $$update rentals set statut = 'en_cours' where id = 'a1000000-0000-0000-0000-000000000001'$$);
select pg_temp.try('remise d''un véhicule en règle', $$update rentals set statut = 'en_cours' where id = 'a1000000-0000-0000-0000-000000000002'$$);
select pg_temp.try('remise d''un véhicule sans période enregistrée : jamais bloquée', $$update rentals set statut = 'en_cours' where id = 'a1000000-0000-0000-0000-000000000003'$$);
select pg_temp.try('remise d''un véhicule dont l''assurance a été renouvelée', $$update rentals set statut = 'en_cours' where id = 'a1000000-0000-0000-0000-000000000004'$$);
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.ck('les quatre locations sont bien parties', (select count(*) from rentals where statut::text = 'en_cours') = 4);
select pg_temp.ck('une seule remise tracée : celle du véhicule à régulariser', (select count(*) from agency_audit_log where action = 'rental_started_noncompliant') = 1);
select pg_temp.ck('la trace nomme le véhicule et le client', (select details ->> 'vehicle' = 'Dacia Logan' and details ->> 'customer' = 'Karim Alami' from agency_audit_log where action = 'rental_started_noncompliant'));
select pg_temp.ck('la trace liste l''assurance ET la visite (pas la vignette)', (select jsonb_array_length(details -> 'issues') = 2 and not (details -> 'issues')::text like '%vignette%' from agency_audit_log where action = 'rental_started_noncompliant'));
select pg_temp.ck('la trace est rangée dans la catégorie « location »', (select category = 'rental' from agency_audit_log where action = 'rental_started_noncompliant'));
select pg_temp.ck('l''auteur de la remise est connu', (select actor_name = 'Employé' from agency_audit_log where action = 'rental_started_noncompliant'));
select pg_temp.ck('sans période enregistrée : pas de trace (on ne peut pas affirmer qu''elle est expirée)', (select count(*) from agency_audit_log where target_label is not null and details ->> 'vehicle' = 'Fiat Tipo' and action = 'rental_started_noncompliant') = 0);
select pg_temp.ck('assurance renouvelée : plus à régulariser', public.vehicle_noncompliance('f4000000-0000-0000-0000-000000000004') = '[]'::jsonb);
select pg_temp.ck('la remise est aussi dans le journal normal des locations', (select count(*) from agency_audit_log where action = 'rental_started') = 4);

-- Rejouer une mise à jour sans changer le statut ne trace rien de plus.
update rentals set notes = 'x' where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.ck('pas de doublon', (select count(*) from agency_audit_log where action = 'rental_started_noncompliant') = 1);

-- ---------------------------------------------------------------- notification prioritaire au responsable (migration 0079)
select pg_temp.ck('le propriétaire est prévenu de la remise à régulariser', (select count(*) from notifications where kind = 'noncompliant_handover' and recipient_id = '00000000-0000-0000-0000-0000000000a1') = 1);
select pg_temp.ck('notification URGENTE', (select severity = 'urgent' from notifications where kind = 'noncompliant_handover' limit 1));
select pg_temp.ck('jamais à l''employé qui remet le véhicule', (select count(*) from notifications where kind = 'noncompliant_handover' and recipient_id = '00000000-0000-0000-0000-0000000000a3') = 0);
select pg_temp.ck('elle dit le véhicule, le client, ce qui est expiré', (select params ->> 'vehicle' = 'Dacia Logan' and params ->> 'customer' = 'Karim Alami' and params ->> 'kinds' = 'assurance,visite_technique' from notifications where kind = 'noncompliant_handover' limit 1));
select pg_temp.ck('elle ouvre la fiche du véhicule', (select link_type = 'vehicle' and link_id = 'f1000000-0000-0000-0000-000000000001' from notifications where kind = 'noncompliant_handover' limit 1));
select pg_temp.ck('une seule notification pour les 4 remises (véhicules en règle ou « à compléter » : rien)', (select count(*) from notifications where kind = 'noncompliant_handover') = 1);

-- Protection contre les doublons : la location repasse plusieurs fois à « en cours » (annulation du départ, nouveau départ…).
update rentals set statut = 'confirmee' where id = 'a1000000-0000-0000-0000-000000000001';
update rentals set statut = 'en_cours' where id = 'a1000000-0000-0000-0000-000000000001';
update rentals set statut = 'confirmee' where id = 'a1000000-0000-0000-0000-000000000001';
update rentals set statut = 'en_cours' where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.ck('doublons : toujours UNE seule notification pour cette location', (select count(*) from notifications where kind = 'noncompliant_handover') = 1);
select pg_temp.ck('doublons : toujours UNE seule ligne d''historique « à régulariser »', (select count(*) from agency_audit_log where action = 'rental_started_noncompliant') = 1);
-- Même si la notification était masquée par son destinataire, elle ne revient pas.
update notifications set dismissed_at = now() where kind = 'noncompliant_handover';
update rentals set statut = 'confirmee' where id = 'a1000000-0000-0000-0000-000000000001';
update rentals set statut = 'en_cours' where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.ck('une notification masquée ne revient pas', (select count(*) from notifications where kind = 'noncompliant_handover') = 1);
-- Une AUTRE location du même véhicule à régulariser : nouvelle trace, nouvelle notification (c'est une nouvelle remise).
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values
  ('a1000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'confirmee', now() + interval '10 days', now() + interval '12 days');
update rentals set statut = 'en_cours' where id = 'a1000000-0000-0000-0000-000000000005';
select pg_temp.ck('une autre remise du véhicule à régulariser est tracée et notifiée', (select count(*) from notifications where kind = 'noncompliant_handover') = 2 and (select count(*) from agency_audit_log where action = 'rental_started_noncompliant') = 2);
select pg_temp.ck('le statut opérationnel du véhicule n''est pas touché par la notification', (select statut::text = 'disponible' from vehicles where id = 'f1000000-0000-0000-0000-000000000001'));

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
