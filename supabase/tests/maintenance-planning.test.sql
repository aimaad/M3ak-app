-- Tests SQL de la planification d'entretien : créneau, conflits, rappels, clôture des notifications (migration 0077).
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
create function pg_temp.count_kind(k text) returns int language sql as $$ select count(*)::int from notifications where kind = k $$;
grant execute on function pg_temp.as_user(text), pg_temp.ck(text, boolean, text), pg_temp.try(text, text, text), pg_temp.count_kind(text) to authenticated;

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test'), ('00000000-0000-0000-0000-0000000000a2', 'mgr@x.test'), ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test'), ('00000000-0000-0000-0000-0000000000b1', 'oth@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'Responsable'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Autre');
insert into customers (id, agency_id, nom_complet, telephone) values ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Karim Alami', '0661000001');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut, kilometrage) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible', 48000),
  ('f2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '2-B-2', 'Kia', 'Rio', 300, 'disponible', 10000);
-- Une location du 20 au 22 déc. 2030 (créneau de conflit) et une terminée le 18 déc. 2030.
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'confirmee', timestamptz '2030-12-20 09:00+00', timestamptz '2030-12-22 18:00+00'),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'terminee', timestamptz '2030-12-18 09:00+00', timestamptz '2030-12-19 18:00+00');
insert into maintenance_items (id, agency_id, vehicle_id, type, echeance_km, statut) values
  ('11000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'vidange', 49000, 'a_venir'),
  ('11000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'freins', 60000, 'a_venir'),
  ('11000000-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'vidange', 12000, 'a_venir');
set session_replication_role = origin;

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');

-- ---------------------------------------------------------------- conflits
select pg_temp.ck('conflit : le créneau tombe pendant la location', (select count(*) from maintenance_conflicts('f1000000-0000-0000-0000-000000000001', timestamptz '2030-12-21 10:00+00', 120)) = 1);
select pg_temp.ck('le conflit nomme le client', (select customer from maintenance_conflicts('f1000000-0000-0000-0000-000000000001', timestamptz '2030-12-21 10:00+00', 120)) = 'Karim Alami');
select pg_temp.ck('pas de conflit hors location (même jour avant le départ)', (select count(*) from maintenance_conflicts('f1000000-0000-0000-0000-000000000001', timestamptz '2030-12-20 06:00+00', 120)) = 0);
select pg_temp.ck('durée inconnue = 2 h : un créneau à 07 h 30 touche un départ à 09 h', (select count(*) from maintenance_conflicts('f1000000-0000-0000-0000-000000000001', timestamptz '2030-12-20 07:30+00', null)) = 1);
select pg_temp.ck('durée 1 h : le même créneau ne touche plus', (select count(*) from maintenance_conflicts('f1000000-0000-0000-0000-000000000001', timestamptz '2030-12-20 07:30+00', 60)) = 0);
select pg_temp.ck('une location terminée ne gêne pas', (select count(*) from maintenance_conflicts('f1000000-0000-0000-0000-000000000001', timestamptz '2030-12-18 12:00+00', 120)) = 0);

-- ---------------------------------------------------------------- planification
select pg_temp.try('planifier sans conflit : accepté', $$select public.plan_maintenance('11000000-0000-0000-0000-000000000002', timestamptz '2030-12-10 10:00+00', 120, ' Garage Atlas ')$$);
select pg_temp.ck('rendez-vous, durée, garage enregistrés ; pas de conflit', (select planned_at = timestamptz '2030-12-10 10:00+00' and planned_minutes = 120 and planned_garage = 'Garage Atlas' and not planned_conflict from maintenance_items where id = '11000000-0000-0000-0000-000000000002'));
select pg_temp.try('avec un conflit : refusé tant qu''on ne poursuit pas', $$select public.plan_maintenance('11000000-0000-0000-0000-000000000001', timestamptz '2030-12-21 10:00+00', 120)$$, 'maintenance_conflict');
select pg_temp.ck('refusé : rien n''est planifié', (select planned_at is null from maintenance_items where id = '11000000-0000-0000-0000-000000000001'));
select pg_temp.try('poursuivre malgré le conflit : accepté', $$select public.plan_maintenance('11000000-0000-0000-0000-000000000001', timestamptz '2030-12-21 10:00+00', 120, null, true)$$);
select pg_temp.ck('le conflit est mémorisé', (select planned_conflict from maintenance_items where id = '11000000-0000-0000-0000-000000000001'));
select pg_temp.try('date passée refusée', $$select public.plan_maintenance('11000000-0000-0000-0000-000000000002', timestamptz '2020-01-01 10:00+00')$$, 'invalid_date');
select pg_temp.try('entretien d''une autre agence refusé', $$select public.plan_maintenance('11000000-0000-0000-0000-000000000003', timestamptz '2030-12-10 10:00+00')$$, 'maintenance_not_found');
reset role;
select set_config('request.jwt.claim.sub', '', false);

select pg_temp.ck('conflit signalé au responsable ET au propriétaire (pas à l''employé)', (select count(*) from notifications where kind = 'maintenance_conflict' and recipient_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')) = 2 and (select count(*) from notifications where kind = 'maintenance_conflict' and recipient_id = '00000000-0000-0000-0000-0000000000a3') = 0);
select pg_temp.ck('la notification dit le client', (select params ->> 'customer' from notifications where kind = 'maintenance_conflict' limit 1) = 'Karim Alami');

-- ---------------------------------------------------------------- rappels du rendez-vous (freins, le 10 déc. 10 h)
select public.generate_maintenance_notifications(timestamp '2030-12-09 08:30' at time zone 'Africa/Casablanca');
select pg_temp.ck('veille avant 9 h : pas de rappel', pg_temp.count_kind('maintenance_planned_eve') = 0);
select public.generate_maintenance_notifications(timestamp '2030-12-09 09:20' at time zone 'Africa/Casablanca');
select pg_temp.ck('veille à 9 h : rappel du rendez-vous', pg_temp.count_kind('maintenance_planned_eve') >= 1);
select pg_temp.ck('le rappel donne l''heure et le garage', (select params ->> 'garage' from notifications where kind = 'maintenance_planned_eve' limit 1) = 'Garage Atlas' and (select params ->> 'time' from notifications where kind = 'maintenance_planned_eve' limit 1) is not null);
select public.generate_maintenance_notifications(timestamp '2030-12-10 08:20' at time zone 'Africa/Casablanca');
select pg_temp.ck('jour du rendez-vous à 8 h : rappel', pg_temp.count_kind('maintenance_planned_today') >= 1);
select public.generate_maintenance_notifications(timestamp '2030-12-10 08:50' at time zone 'Africa/Casablanca');
select pg_temp.ck('rappels : pas de doublon', (select count(*) from notifications where kind = 'maintenance_planned_today' and link_id = '11000000-0000-0000-0000-000000000002') = 3);

-- Pas de « est-ce fait ? » tant que le rendez-vous n'est pas arrivé : on passe le km, le rendez-vous est dans le futur.
update vehicles set kilometrage = 61000 where id = 'f1000000-0000-0000-0000-000000000001';
select public.generate_maintenance_notifications(timestamp '2030-12-09 12:30' at time zone 'Africa/Casablanca');
select pg_temp.ck('km atteint mais rendez-vous à venir : pas de suivi', (select count(*) from notifications where kind = 'maintenance_followup' and link_id = '11000000-0000-0000-0000-000000000002') = 0);
select public.generate_maintenance_notifications(timestamp '2030-12-10 12:30' at time zone 'Africa/Casablanca');
select pg_temp.ck('rendez-vous passé et pas fait : le suivi reprend', (select count(*) from notifications where kind = 'maintenance_followup' and link_id = '11000000-0000-0000-0000-000000000002') >= 1);

-- ---------------------------------------------------------------- clôture des notifications quand c'est fait
select pg_temp.ck('avant : des notifications actives pour les freins', (select count(*) from notifications where link_id = '11000000-0000-0000-0000-000000000002' and dismissed_at is null) > 0);
update notifications set dismissed_at = null;
update maintenance_items set statut = 'effectuee', date_intervention = date '2030-12-10' where id = '11000000-0000-0000-0000-000000000002';
select pg_temp.ck('échéance effectuée : ses notifications sont clôturées', (select count(*) from notifications where link_id = '11000000-0000-0000-0000-000000000002' and dismissed_at is null) = 0);
select pg_temp.ck('les notifications des AUTRES échéances restent', (select count(*) from notifications where link_id = '11000000-0000-0000-0000-000000000001' and dismissed_at is null) > 0);
-- Une notification lue (masquée) n'a pas résolu l'échéance : elle revient au prochain palier.
update maintenance_items set planned_at = null, planned_conflict = false where id = '11000000-0000-0000-0000-000000000001';
update notifications set dismissed_at = now() where link_id = '11000000-0000-0000-0000-000000000001';
select pg_temp.ck('lire une notification ne résout rien : l''échéance reste ouverte', (select statut::text = 'a_venir' from maintenance_items where id = '11000000-0000-0000-0000-000000000001'));
delete from maintenance_items where id = '11000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------- début d'intervention pendant une location
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'en_cours', now() - interval '1 hour', now() + interval '2 days');
update maintenance_items set planned_at = null, planned_minutes = null, planned_garage = null, planned_conflict = false where id = '11000000-0000-0000-0000-000000000001';
delete from notifications;
update vehicles set statut = 'en_location' where id = 'f1000000-0000-0000-0000-000000000001';
update maintenance_items set statut = 'en_cours' where id = '11000000-0000-0000-0000-000000000001';
select pg_temp.ck('début d''intervention pendant une location : le responsable est informé', (select count(*) from notifications where kind = 'maintenance_conflict' and dedupe_key like '%:start:%' and recipient_id = '00000000-0000-0000-0000-0000000000a2') = 1);
select pg_temp.ck('l''information ne bloque rien : l''intervention est bien « en cours »', (select statut::text = 'en_cours' from maintenance_items where id = '11000000-0000-0000-0000-000000000001'));
select pg_temp.ck('le véhicule loué n''est pas passé en maintenance (il reste chez le client)', (select statut::text <> 'maintenance' from vehicles where id = 'f1000000-0000-0000-0000-000000000001'));
update rentals set statut = 'terminee' where id = 'a1000000-0000-0000-0000-000000000003';
update vehicles set statut = 'disponible' where id = 'f1000000-0000-0000-0000-000000000001';
update maintenance_items set statut = 'a_venir' where id = '11000000-0000-0000-0000-000000000001';
delete from notifications;
update maintenance_items set statut = 'en_cours' where id = '11000000-0000-0000-0000-000000000001';
select pg_temp.ck('début d''intervention sans location : aucune alerte', (select count(*) from notifications where kind = 'maintenance_conflict') = 0);
select pg_temp.ck('sans location, le véhicule passe en maintenance', (select statut::text = 'maintenance' from vehicles where id = 'f1000000-0000-0000-0000-000000000001'));

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
