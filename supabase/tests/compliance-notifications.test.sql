-- Tests SQL des rappels d'obligations du véhicule (migration 0070).
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
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test'), ('00000000-0000-0000-0000-0000000000a2', 'mgr@x.test'), ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'P'), ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'R'), ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'E');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut, archived_at) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible', null),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Dacia', 'Sandero', 300, 'disponible', null),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-3', 'Renault', 'Clio', 300, 'disponible', null),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '4-A-4', 'Kia', 'Rio', 300, 'disponible', null),
  ('f5000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', '5-A-5', 'Kia', 'Picanto', 300, 'disponible', null),
  ('f6000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', '6-A-6', 'Peugeot', '208', 300, 'disponible', null),
  ('f7000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', '7-A-7', 'Fiat', 'Tipo', 300, 'disponible', now()),
  ('f8000000-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000001', '8-A-8', 'Fiat', 'Doblo', 300, 'disponible', null),
  ('f9000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', '9-A-9', 'Ford', 'Fiesta', 300, 'disponible', null);
-- Aujourd'hui (heure du Maroc) = 2026-11-15.
insert into vehicle_compliance (vehicle_id, agency_id, kind, valid_until) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'assurance', '2026-12-10'),        -- dans 25 jours
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'assurance', '2026-11-21'),        -- dans 6 jours
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'assurance', '2026-11-15'),        -- aujourd'hui
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'assurance', '2026-11-12'),        -- expirée depuis 3 jours
  ('f5000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'vignette', '2026-12-31'),         -- année couverte : prochaine limite le 31/01/2027 (dans 77 jours)
  ('f6000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', 'vignette', '2025-12-31'),         -- année en cours non couverte : limite du 31/01/2026 dépassée
  ('f7000000-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', 'assurance', '2026-11-01'),        -- véhicule archivé
  ('f9000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'visite_technique', '2026-10-01'), -- ancienne période expirée…
  ('f9000000-0000-0000-0000-000000000009', 'aaaaaaaa-0000-0000-0000-000000000001', 'visite_technique', '2027-12-01'); -- …remplacée par une période en cours lointaine
set session_replication_role = origin;

select public.generate_compliance_notifications('2026-11-15 10:00:00+01');
select pg_temp.ck('assurance dans 25 jours : palier 30', (select count(*) = 1 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'compliance_due:%:30' and (params ->> 'plate') = '1-A-1'), '');
select pg_temp.ck('assurance dans 6 jours : palier 7, sévérité « warning »', (select count(*) = 1 and bool_and(severity = 'warning') from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'compliance_due:%:7' and (params ->> 'plate') = '2-A-2'), '');
select pg_temp.ck('assurance aujourd''hui : palier 0', (select count(*) = 1 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'compliance_due:%:0' and (params ->> 'plate') = '3-A-3'), '');
select pg_temp.ck('assurance expirée : « expirée », urgent', (select count(*) = 1 and bool_and(severity = 'urgent') from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'compliance_expired' and (params ->> 'plate') = '4-A-4'), '');
select pg_temp.ck('vignette payée pour l''année : aucun rappel (prochaine limite dans 77 jours)', (select count(*) = 0 from notifications where (params ->> 'plate') = '5-A-5'), '');
select pg_temp.ck('vignette de l''année non couverte, date limite dépassée : « expirée »', (select count(*) = 1 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'compliance_expired' and (params ->> 'plate') = '6-A-6' and (params ->> 'maintenance') = 'vignette'), '');
select pg_temp.ck('véhicule archivé : aucun rappel', (select count(*) = 0 from notifications where (params ->> 'plate') = '7-A-7'), '');
select pg_temp.ck('véhicule sans période : aucun rappel', (select count(*) = 0 from notifications where (params ->> 'plate') = '8-A-8'), '');
select pg_temp.ck('seule la période en cours compte (l''ancienne expirée est remplacée)', (select count(*) = 0 from notifications where (params ->> 'plate') = '9-A-9'), '');
select pg_temp.ck('le responsable est prévenu comme le propriétaire', (select count(*) = (select count(*) from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1') from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a2'), '');
select pg_temp.ck('l''employé n''est pas prévenu (propriétaire et responsables seulement)', (select count(*) = 0 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a3'), '');
select pg_temp.ck('la notification ouvre la fiche du véhicule', (select bool_and(link_type = 'vehicle' and link_id is not null) from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1'), '');

-- Pas de doublon à la deuxième exécution, ni le lendemain pour le même palier.
create temp table before as select count(*) as n from notifications;
select public.generate_compliance_notifications('2026-11-15 11:00:00+01');
select pg_temp.ck('même jour, nouvelle exécution : aucun doublon', (select count(*) = (select n from before) from notifications), '');
select public.generate_compliance_notifications('2026-11-16 10:00:00+01');
select pg_temp.ck('le lendemain : seul le palier franchi est envoyé (assurance du 21/11 : toujours palier 7, pas de doublon)', (select count(*) = 1 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'compliance_due:%:7' and (params ->> 'plate') = '2-A-2'), '');
select pg_temp.ck('le lendemain : l''assurance qui finissait hier est maintenant expirée', (select count(*) = 1 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'compliance_expired' and (params ->> 'plate') = '3-A-3'), '');
select pg_temp.ck('« expirée » : pas de doublon la même semaine', (select count(*) = 1 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'compliance_expired' and (params ->> 'plate') = '4-A-4'), '');
select public.generate_compliance_notifications('2026-11-23 10:00:00+01');
select pg_temp.ck('« expirée » : rappelée la semaine suivante', (select count(*) = 2 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'compliance_expired' and (params ->> 'plate') = '4-A-4'), '');

-- Renouvellement : nouvelle période, nouveaux paliers.
insert into vehicle_compliance (vehicle_id, agency_id, kind, valid_until) values ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'assurance', '2026-12-20');
select public.generate_compliance_notifications('2026-11-24 10:00:00+01');
select pg_temp.ck('après renouvellement : plus de rappel « expirée », nouveau palier 30', (select count(*) = 1 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and dedupe_key like 'compliance_due:%:30' and (params ->> 'plate') = '4-A-4'), '');

-- Pas de rappel en pleine nuit.
drop table before;
create temp table before as select count(*) as n from notifications;
select public.generate_compliance_notifications('2026-12-30 23:30:00+01');
select pg_temp.ck('la nuit (21 h – 7 h) : aucun rappel', (select count(*) = (select n from before) from notifications), '');

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
