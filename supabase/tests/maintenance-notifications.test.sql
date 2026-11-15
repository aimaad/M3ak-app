-- Les heures sont écrites en heure du Maroc (convertie avec le fuseau de la base : le test ne dépend pas de la version des données horaires).
-- Tests SQL des notifications d'entretien : veille, jour même, kilométrage, suivi « est-ce fait ? » (migration 0074).
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
create function pg_temp.count_kind(k text) returns int language sql as $$ select count(*)::int from notifications where kind = k $$;

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test'), ('00000000-0000-0000-0000-0000000000b1', 'oth@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Autre');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut, kilometrage) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible', 48000),
  ('f2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '2-B-2', 'Kia', 'Rio', 300, 'disponible', 10000);
-- Vidange le 16 nov. 2026 (date seule) ; freins à 50 000 km (km seul) ; pneus en intervention ; autre entretien d'une autre agence.
insert into maintenance_items (id, agency_id, vehicle_id, type, echeance_date, echeance_km, statut) values
  ('11000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'vidange', date '2026-11-16', null, 'a_venir'),
  ('11000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'freins', null, 50000, 'a_venir'),
  ('11000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'pneus', date '2026-11-16', null, 'en_cours'),
  ('11000000-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'vidange', date '2026-11-16', null, 'a_venir');
set session_replication_role = origin;

-- ---------------------------------------------------------------- veille
select public.generate_maintenance_notifications((timestamp '2026-11-15 08:30' at time zone 'Africa/Casablanca'));
select pg_temp.ck('veille avant 9 h : rien', pg_temp.count_kind('maintenance_eve') = 0);
select public.generate_maintenance_notifications((timestamp '2026-11-15 09:10' at time zone 'Africa/Casablanca'));
select pg_temp.ck('veille à 9 h : une notification (propriétaire de l''agence A seulement)', (select count(*) from notifications where kind = 'maintenance_eve' and recipient_id = '00000000-0000-0000-0000-0000000000a1') = 1 and pg_temp.count_kind('maintenance_eve') = 2);
select public.generate_maintenance_notifications((timestamp '2026-11-15 15:00' at time zone 'Africa/Casablanca'));
select pg_temp.ck('veille : pas de doublon si on rejoue', pg_temp.count_kind('maintenance_eve') = 2);
select pg_temp.ck('la veille ne déclenche pas de suivi', pg_temp.count_kind('maintenance_followup') = 0);

-- ---------------------------------------------------------------- jour même
select public.generate_maintenance_notifications((timestamp '2026-11-16 07:30' at time zone 'Africa/Casablanca'));
select pg_temp.ck('jour même avant 8 h : rien', pg_temp.count_kind('maintenance_today') = 0);
select public.generate_maintenance_notifications((timestamp '2026-11-16 08:10' at time zone 'Africa/Casablanca'));
select pg_temp.ck('jour même à 8 h : une notification par agence (2 en tout)', pg_temp.count_kind('maintenance_today') = 2);
select public.generate_maintenance_notifications((timestamp '2026-11-16 11:00' at time zone 'Africa/Casablanca'));
select pg_temp.ck('avant midi : pas encore de suivi', pg_temp.count_kind('maintenance_followup') = 0);

-- ---------------------------------------------------------------- suivi « est-ce fait ? » à midi
select public.generate_maintenance_notifications((timestamp '2026-11-16 12:05' at time zone 'Africa/Casablanca'));
select pg_temp.ck('à midi le jour même : le suivi est envoyé (2 agences)', pg_temp.count_kind('maintenance_followup') = 2);
select pg_temp.ck('le compteur de suivis passe à 1', (select followup_count from maintenance_items where id = '11000000-0000-0000-0000-000000000001') = 1);
select public.generate_maintenance_notifications((timestamp '2026-11-16 16:00' at time zone 'Africa/Casablanca'));
select pg_temp.ck('un seul suivi par jour', pg_temp.count_kind('maintenance_followup') = 2);
select pg_temp.ck('l''entretien en intervention ne déclenche rien', (select count(*) from notifications where link_id = '11000000-0000-0000-0000-000000000003') = 0);

-- « Pas encore » : on reporte (le propriétaire de A)
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('« pas encore » : report accepté', $$select public.snooze_maintenance_followup('11000000-0000-0000-0000-000000000001', 2, timestamp '2026-11-16 12:30' at time zone 'Africa/Casablanca')$$);
select pg_temp.try('report d''un entretien d''une autre entreprise refusé', $$select public.snooze_maintenance_followup('11000000-0000-0000-0000-000000000004', 1)$$, 'maintenance_not_found');
select pg_temp.try('report de 0 jour refusé', $$select public.snooze_maintenance_followup('11000000-0000-0000-0000-000000000001', 0)$$, 'invalid_days');
reset role;
-- Le planificateur (pg_cron) n'a pas d'utilisateur connecté : sinon l'« auteur » ne serait pas notifié de sa propre action.
select set_config('request.jwt.claim.sub', '', false);
select public.generate_maintenance_notifications((timestamp '2026-11-17 12:05' at time zone 'Africa/Casablanca'));
select pg_temp.ck('reporté : pas de suivi le lendemain pour l''entretien de A (celui de B continue)', (select count(*) from notifications where kind = 'maintenance_followup' and link_id = '11000000-0000-0000-0000-000000000001') = 1 and pg_temp.count_kind('maintenance_followup') = 3);
select public.generate_maintenance_notifications((timestamp '2026-11-18 12:05' at time zone 'Africa/Casablanca'));
select pg_temp.ck('le report finit : suivi 2 pour l''entretien de A', (select followup_count from maintenance_items where id = '11000000-0000-0000-0000-000000000001') = 2);
select public.generate_maintenance_notifications((timestamp '2026-11-19 12:05' at time zone 'Africa/Casablanca'));
select pg_temp.ck('suivi 3 pour l''entretien de A', (select followup_count from maintenance_items where id = '11000000-0000-0000-0000-000000000001') = 3);
select public.generate_maintenance_notifications((timestamp '2026-11-20 12:05' at time zone 'Africa/Casablanca'));
select pg_temp.ck('après 3 suivis : plus de « est-ce fait ? » pour A', (select count(*) from notifications where kind = 'maintenance_followup' and link_id = '11000000-0000-0000-0000-000000000001') = 3);
select pg_temp.ck('après 3 suivis : un rappel « en retard » par semaine', (select count(*) from notifications where kind = 'maintenance_overdue' and link_id = '11000000-0000-0000-0000-000000000001') = 1);
select public.generate_maintenance_notifications((timestamp '2026-11-20 18:00' at time zone 'Africa/Casablanca'));
select pg_temp.ck('rappel hebdomadaire : une seule fois la même semaine', (select count(*) from notifications where kind = 'maintenance_overdue' and link_id = '11000000-0000-0000-0000-000000000001') = 1);

-- ---------------------------------------------------------------- kilométrage
select public.generate_maintenance_notifications((timestamp '2026-11-21 08:30' at time zone 'Africa/Casablanca'));
select pg_temp.ck('km : à 2 000 km, aucune alerte', (select count(*) from notifications where link_id = '11000000-0000-0000-0000-000000000002') = 0);
update vehicles set kilometrage = 49600 where id = 'f1000000-0000-0000-0000-000000000001';
select public.generate_maintenance_notifications((timestamp '2026-11-22 08:30' at time zone 'Africa/Casablanca'));
select pg_temp.ck('km : à moins de 500 km, « bientôt » (une fois)', (select count(*) from notifications where kind = 'maintenance_km_soon' and link_id = '11000000-0000-0000-0000-000000000002') = 1);
select public.generate_maintenance_notifications((timestamp '2026-11-22 14:00' at time zone 'Africa/Casablanca'));
select pg_temp.ck('km bientôt : pas de doublon', (select count(*) from notifications where kind = 'maintenance_km_soon') = 1);
update vehicles set kilometrage = 50100 where id = 'f1000000-0000-0000-0000-000000000001';
select public.generate_maintenance_notifications((timestamp '2026-11-23 08:30' at time zone 'Africa/Casablanca'));
select pg_temp.ck('km atteint : une notification', (select count(*) from notifications where kind = 'maintenance_km_reached' and link_id = '11000000-0000-0000-0000-000000000002') = 1);
select public.generate_maintenance_notifications((timestamp '2026-11-23 12:30' at time zone 'Africa/Casablanca'));
select pg_temp.ck('km atteint : suivi à midi (même sans date)', (select count(*) from notifications where kind = 'maintenance_followup' and link_id = '11000000-0000-0000-0000-000000000002') = 1);

-- ---------------------------------------------------------------- une fois fait : plus rien
update maintenance_items set statut = 'effectuee' where id = '11000000-0000-0000-0000-000000000002';
select public.generate_maintenance_notifications((timestamp '2026-11-24 12:30' at time zone 'Africa/Casablanca'));
select pg_temp.ck('entretien fait : plus de suivi', (select count(*) from notifications where kind = 'maintenance_followup' and link_id = '11000000-0000-0000-0000-000000000002') = 1);

-- ---------------------------------------------------------------- nuit et anciens messages
select public.generate_maintenance_notifications((timestamp '2026-11-25 03:00' at time zone 'Africa/Casablanca'));
select pg_temp.ck('pas de rappel en pleine nuit', (select count(*) from notifications where created_at > now() - interval '1 minute' and kind = 'maintenance_followup' and dedupe_key like '%2026-11-25') = 0);
select public.generate_scheduled_notifications((timestamp '2026-11-10 10:00' at time zone 'Africa/Casablanca'));
select pg_temp.ck('l''ancien rappel général n''envoie plus de « entretien à prévoir »', pg_temp.count_kind('maintenance_due') = 0);

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
