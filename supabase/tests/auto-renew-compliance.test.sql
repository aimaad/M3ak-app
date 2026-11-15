-- Tests SQL : renouvellement automatique des obligations périodiques (migration 0085).
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
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Kia', 'Rio', 300),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-3', 'Fiat', 'Tipo', 300),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '4-A-4', 'Seat', 'Ibiza', 300),
  ('f5000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', '5-A-5', 'Opel', 'Corsa', 300);
set session_replication_role = origin;

-- 1 : périodique (12 mois), finie HIER, avec papier        → renouvelée automatiquement
-- 2 : finie hier mais PAS périodique (aucune durée réglée)  → rien
-- 3 : périodique mais finie il y a 10 jours                 → rien (reste « À régulariser »)
-- 4 : période déjà AUTOMATIQUE, finie hier, sans papier     → rien (pas de chaîne sans justificatif)
-- 5 : période automatique finie hier, AVEC papier ajouté    → renouvelée
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until, period_months, document_path, auto_created) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', (now() at time zone 'Africa/Casablanca')::date - 365, (now() at time zone 'Africa/Casablanca')::date - 1, 12, 'p1.jpg', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'assurance', (now() at time zone 'Africa/Casablanca')::date - 365, (now() at time zone 'Africa/Casablanca')::date - 1, null, 'p2.jpg', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'assurance', (now() at time zone 'Africa/Casablanca')::date - 375, (now() at time zone 'Africa/Casablanca')::date - 10, 12, 'p3.jpg', false),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'assurance', (now() at time zone 'Africa/Casablanca')::date - 365, (now() at time zone 'Africa/Casablanca')::date - 1, 12, null, true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000005', 'assurance', (now() at time zone 'Africa/Casablanca')::date - 365, (now() at time zone 'Africa/Casablanca')::date - 1, 12, 'p5.jpg', true);

select public.auto_renew_compliance(now());

select pg_temp.ck('périodique finie hier : la période suivante est créée seule (début = aujourd''hui)', (select count(*) = 1 from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and valid_from = (now() at time zone 'Africa/Casablanca')::date and auto_created));
select pg_temp.ck('la nouvelle période dure la même durée (12 mois, veille de l''anniversaire)', (select valid_until = ((now() at time zone 'Africa/Casablanca')::date + interval '12 months')::date - 1 and period_months = 12 from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and auto_created));
select pg_temp.ck('l''obligation est de nouveau couverte (échéance d''entretien suit la nouvelle fin)', (select bool_and(echeance_date = ((now() at time zone 'Africa/Casablanca')::date + interval '12 months')::date - 1) from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type::text = 'assurance'));
select pg_temp.ck('pas périodique : rien n''est créé', (select count(*) = 1 from vehicle_compliance where vehicle_id = 'f2000000-0000-0000-0000-000000000002'));
select pg_temp.ck('finie depuis trop longtemps (10 jours) : rien, reste à régulariser', (select count(*) = 1 from vehicle_compliance where vehicle_id = 'f3000000-0000-0000-0000-000000000003'));
select pg_temp.ck('période déjà automatique SANS papier : pas de renouvellement en chaîne', (select count(*) = 1 from vehicle_compliance where vehicle_id = 'f4000000-0000-0000-0000-000000000004'));
select pg_temp.ck('période automatique dont le papier a été ajouté : renouvelée', (select count(*) = 2 from vehicle_compliance where vehicle_id = 'f5000000-0000-0000-0000-000000000005'));
select pg_temp.ck('le responsable est prévenu (information), une notification par renouvellement', (select count(*) = 2 and bool_and(severity::text = 'info') from notifications where kind = 'compliance_auto_renewed' and recipient_id = '00000000-0000-0000-0000-0000000000a1'));
select pg_temp.ck('jamais à l''employé', (select count(*) = 0 from notifications where kind = 'compliance_auto_renewed' and recipient_id = '00000000-0000-0000-0000-0000000000a3'));
select pg_temp.ck('le renouvellement automatique est tracé dans l''historique', (select count(*) = 2 from agency_audit_log where action = 'compliance_auto_renewed'));

select public.auto_renew_compliance(now());
select public.auto_renew_compliance(now() + interval '1 hour');
select pg_temp.ck('rejouer ne crée aucun doublon (période, notification, trace)', (select count(*) = 2 from vehicle_compliance where auto_created and valid_from = (now() at time zone 'Africa/Casablanca')::date) and (select count(*) = 2 from notifications where kind = 'compliance_auto_renewed') and (select count(*) = 2 from agency_audit_log where action = 'compliance_auto_renewed'));
select pg_temp.ck('la période créée automatiquement n''en entraîne pas une autre tout de suite (aucune période future en plus)', (select count(*) = 1 from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and auto_created));

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
