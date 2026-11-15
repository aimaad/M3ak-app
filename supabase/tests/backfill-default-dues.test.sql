-- Tests SQL : reprise des échéances par défaut des véhicules existants (migration 0086).
\set ON_ERROR_STOP off
create temp table res (n serial, name text, ok boolean, detail text);
create function pg_temp.ck(label text, cond boolean, detail text default '') returns void
language plpgsql as $$ begin insert into res(name, ok, detail) values (label, coalesce(cond, false), detail); end $$;

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000a1');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, archived_at) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, null),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Kia', 'Rio', 300, null),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-3', 'Fiat', 'Tipo', 300, now()),
  ('f4000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', '4-B-4', 'Seat', 'Ibiza', 300, null);
set session_replication_role = origin;
-- Véhicules « existants » : aucune échéance. Le 2 a déjà une vidange FAITE (on ne la double pas). L'agence B a désactivé les pneus.
delete from maintenance_items;
insert into maintenance_items (agency_id, vehicle_id, type, statut, date_intervention) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'vidange', 'effectuee', now());
insert into agency_due_rules (agency_id, kind, enabled, repeat_km, repeat_months) values ('bbbbbbbb-0000-0000-0000-000000000002', 'pneus', false, null, null);
delete from agency_audit_log;

select public.backfill_default_dues();

select pg_temp.ck('véhicule existant : vidange, freins et pneus créés « À compléter » avec les valeurs indicatives', (select count(*) = 3 and bool_and(statut::text = 'a_venir' and echeance_date is null and echeance_km is null) and sum(repeat_km) = 80000 from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001'));
select pg_temp.ck('une vidange déjà faite n''est pas doublée ; freins et pneus ajoutés', (select count(*) filter (where type::text = 'vidange') = 1 and count(*) filter (where type::text = 'freins') = 1 and count(*) filter (where type::text = 'pneus') = 1 from maintenance_items where vehicle_id = 'f2000000-0000-0000-0000-000000000002'));
select pg_temp.ck('véhicule archivé : rien', (select count(*) = 0 from maintenance_items where vehicle_id = 'f3000000-0000-0000-0000-000000000003'));
select pg_temp.ck('règle désactivée par l''agence (pneus) : respectée', (select count(*) = 2 and count(*) filter (where type::text = 'pneus') = 0 from maintenance_items where vehicle_id = 'f4000000-0000-0000-0000-000000000004'));
select pg_temp.ck('aucune ligne dans le journal d''activité (pas une action d''employé)', (select count(*) = 0 from agency_audit_log where action = 'maintenance_created'));
select pg_temp.ck('rejouable sans effet : aucun doublon', (select public.backfill_default_dues() = 0) and (select count(*) = 3 from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001'));
select pg_temp.ck('le déclencheur du journal est bien remis en marche', (select tgenabled = 'O' from pg_trigger where tgname = 'trg_audit_maintenance_items'));

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
