-- Tests SQL : aucun renouvellement automatique (migration 0085) — une période n'existe que si une personne l'a enregistrée.
\set ON_ERROR_STOP off
create temp table res (n serial, name text, ok boolean, detail text);
create function pg_temp.ck(label text, cond boolean, detail text default '') returns void
language plpgsql as $$ begin insert into res(name, ok, detail) values (label, coalesce(cond, false), detail); end $$;

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour) values ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300);
set session_replication_role = origin;

-- Obligation PÉRIODIQUE (12 mois) finie hier, avec papier : rien ne la renouvelle toute seule.
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until, period_months, document_path) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', (now() at time zone 'Africa/Casablanca')::date - 365, (now() at time zone 'Africa/Casablanca')::date - 1, 12, 'p.jpg');
select public.generate_compliance_notifications(now());
select public.generate_uncovered_notifications(now());
select public.refresh_compliance_bridge(now());
select pg_temp.ck('les tâches horaires ne créent aucune période (reste une seule période)', (select count(*) = 1 from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001'));
select pg_temp.ck('aucune fonction de renouvellement automatique n''existe', (select count(*) = 0 from pg_proc where proname = 'auto_renew_compliance'));
select pg_temp.ck('aucune colonne « période automatique »', (select count(*) = 0 from information_schema.columns where table_name = 'vehicle_compliance' and column_name = 'auto_created'));
select pg_temp.ck('l''obligation reste expirée tant que personne ne confirme (échéance d''entretien = fin de la période finie)', (select bool_and(echeance_date = (now() at time zone 'Africa/Casablanca')::date - 1) from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type::text = 'assurance'));
-- Une personne confirme (« Fait ») : la période suivante existe alors.
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until, period_months) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', (now() at time zone 'Africa/Casablanca')::date, (now() at time zone 'Africa/Casablanca')::date + 364, 12);
select pg_temp.ck('confirmé par une personne : la nouvelle période couvre le véhicule', (select bool_and(echeance_date = (now() at time zone 'Africa/Casablanca')::date + 364) from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type::text = 'assurance'));

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
