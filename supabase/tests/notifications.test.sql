-- Tests SQL des notifications (migration 0053).
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
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'casa@x.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'rabat@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'ownerb@x.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'empb@x.test');
insert into agencies (id, nom, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B (sans filiale)', '00000000-0000-0000-0000-0000000000b1');
insert into branches (id, agency_id, nom) values
  ('b1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Casa'),
  ('b2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Rabat');
insert into agency_members (agency_id, user_id, role, nom_complet, branch_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner', null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'Manager', null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Emp Casa', 'b1000000-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 'employee', 'Emp Rabat', 'b2000000-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Owner B', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b2', 'employee', 'Emp B', null);
insert into customers (id, agency_id, nom_complet, telephone) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Karim Alami', '0661000001'),
  ('c2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Client B', '0662000002');
insert into vehicles (id, agency_id, branch_id, immatriculation, marque, modele, prix_jour) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300),
  ('f2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', null, '2-B-2', 'Renault', 'Clio', 300);
set session_replication_role = origin;
grant all on res to authenticated;

-- ----------------------------------------------------------------- création d'une location (auteur : le système)
select set_config('request.jwt.claim.sub', '', false);
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue, branch_depart_id, branch_retour_id)
values ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'en_attente_confirmation',
        now() + interval '1 day', now() + interval '3 day', 'b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001');
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue)
values ('a2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'reservee', now() + interval '1 day', now() + interval '3 day');

create function pg_temp.has(uid text, k text) returns boolean language sql as $$
  select exists (select 1 from notifications where recipient_id = uid::uuid and kind = k and dismissed_at is null) $$;

select pg_temp.ck('le propriétaire reçoit la location', pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'rental_created'), '');
select pg_temp.ck('le responsable sans filiale la reçoit', pg_temp.has('00000000-0000-0000-0000-0000000000a2', 'rental_created'), '');
select pg_temp.ck('l''employé de la filiale concernée la reçoit', pg_temp.has('00000000-0000-0000-0000-0000000000a3', 'rental_created'), '');
select pg_temp.ck('l''employé d''une AUTRE filiale ne la reçoit pas', not pg_temp.has('00000000-0000-0000-0000-0000000000a4', 'rental_created'), '');
select pg_temp.ck('une autre agence ne reçoit rien', (select count(*) = 0 from notifications where agency_id <> 'aaaaaaaa-0000-0000-0000-000000000001' and recipient_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3')), '');
select pg_temp.ck('le nom de la filiale est mentionné quand l''agence en a', (select params ->> 'branch' = 'Casa' from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'rental_created'), '');
select pg_temp.ck('le client et son numéro sont dans la notification', (select params ->> 'customer' = 'Karim Alami' and params ->> 'phone' = '0661000001' from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'rental_created'), '');
select pg_temp.ck('sans filiale, aucune filiale n''est mentionnée', (select not (params ? 'branch') from notifications where recipient_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'rental_created'), '');
select pg_temp.ck('sans filiale, l''employé de l''agence reçoit aussi', pg_temp.has('00000000-0000-0000-0000-0000000000b2', 'rental_created'), '');

-- ----------------------------------------------------------------- l'auteur n'est pas notifié de sa propre action
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
update rentals set statut = 'confirmee' where id = 'a1000000-0000-0000-0000-000000000001';
select pg_temp.ck('l''auteur ne reçoit pas sa propre action', not pg_temp.has('00000000-0000-0000-0000-0000000000a3', 'rental_confirmed'), '');
select pg_temp.ck('le propriétaire reçoit l''action de l''employé', pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'rental_confirmed'), '');

-- ----------------------------------------------------------------- préférences
set session_replication_role = replica;
insert into notification_preferences (user_id, agency_id, enabled) values ('00000000-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000001', false);
insert into notification_preferences (user_id, agency_id, muted_categories) values ('00000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000001', array['payment']);
set session_replication_role = origin;
select set_config('request.jwt.claim.sub', '', false);
insert into payments (agency_id, rental_id, montant, methode, statut) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 500, 'especes', 'paye');
select pg_temp.ck('notifications coupées : rien pour ce membre', not pg_temp.has('00000000-0000-0000-0000-0000000000a2', 'payment_received'), '');
select pg_temp.ck('catégorie coupée : rien pour cette catégorie', not pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'payment_received'), '');
select pg_temp.ck('les autres catégories continuent d''arriver', pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'rental_confirmed'), '');
select pg_temp.ck('l''employé concerné reçoit le paiement', pg_temp.has('00000000-0000-0000-0000-0000000000a3', 'payment_received'), '');

-- ----------------------------------------------------------------- rappels planifiés
-- « Demain » est évalué en heure du Maroc ; on simule 10 h (heure locale) du jour courant pour ne pas dépendre de l'heure du test.
create function pg_temp.at_local(day_offset int, hh int) returns timestamptz language sql as $$
  select (date_trunc('day', now() at time zone 'Africa/Casablanca') + make_interval(days => day_offset, hours => hh)) at time zone 'Africa/Casablanca' $$;
set session_replication_role = replica;
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue, branch_depart_id, branch_retour_id)
values ('a3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'en_cours',
        pg_temp.at_local(-2, 9), pg_temp.at_local(1, 12), 'b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001');
set session_replication_role = origin;
select public.generate_scheduled_notifications(pg_temp.at_local(0, 10));
select pg_temp.ck('rappel : retour prévu demain, reçu par l''employé de la filiale', pg_temp.has('00000000-0000-0000-0000-0000000000a3', 'return_tomorrow'), '');
select pg_temp.ck('rappel : le propriétaire le reçoit aussi', pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'return_tomorrow'), '');
select pg_temp.ck('rappel : pas pour l''autre filiale', not pg_temp.has('00000000-0000-0000-0000-0000000000a4', 'return_tomorrow'), '');
select pg_temp.ck('rappel : le numéro du client est dans le message', (select params ->> 'phone' = '0661000001' from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'return_tomorrow'), '');
select public.generate_scheduled_notifications(pg_temp.at_local(0, 11));
select pg_temp.ck('rappel : jamais en double', (select count(*) = 1 from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'return_tomorrow'), '');
select public.generate_scheduled_notifications(pg_temp.at_local(1, 15));
select pg_temp.ck('rappel : retard le lendemain après l''heure, urgent', (select severity = 'urgent' from notifications where recipient_id = '00000000-0000-0000-0000-0000000000a3' and kind = 'return_late'), '');
select pg_temp.ck('rappel : retour du jour signalé aussi', pg_temp.has('00000000-0000-0000-0000-0000000000a3', 'return_today'), '');
select count(*) as avant from notifications \gset
select public.generate_scheduled_notifications(pg_temp.at_local(2, 2));
select pg_temp.ck('rappel : rien la nuit', (select count(*) = :avant from notifications), '');

-- ----------------------------------------------------------------- masquer / supprimer : seulement pour soi
reset role;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('l''employé ne voit que ses notifications', (select count(*) > 0 and bool_and(recipient_id = '00000000-0000-0000-0000-0000000000a3') from notifications), '');
select pg_temp.try('masquer une notification', $$update notifications set dismissed_at = now() where kind = 'rental_created'$$);
select pg_temp.ck('la notification masquée disparaît de sa liste', (select count(*) = 0 from notifications where kind = 'rental_created' and dismissed_at is null), '');
reset role;
select pg_temp.ck('les autres destinataires la gardent', pg_temp.has('00000000-0000-0000-0000-0000000000a1', 'rental_created'), '');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('on ne peut pas modifier le contenu', $$update notifications set kind = 'x'$$, 'permission denied');
select pg_temp.try('on ne peut pas créer de notification', $$insert into notifications (agency_id, recipient_id, kind, category) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'x', 'rental')$$, 'permission denied');
select pg_temp.try('on ne peut pas en effacer côté serveur', $$delete from notifications$$, 'permission denied');
select pg_temp.try('un employé règle ses préférences', $$insert into notification_preferences (user_id, agency_id, enabled, locale) values ('00000000-0000-0000-0000-0000000000a3', 'aaaaaaaa-0000-0000-0000-000000000001', false, 'ar')$$);
select pg_temp.try('on ne règle pas les préférences d''un autre', $$insert into notification_preferences (user_id, agency_id) values ('00000000-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-000000000001')$$, 'row-level security');
select pg_temp.try('un employé enregistre son téléphone (push)', $$insert into push_tokens (token, user_id, platform) values ('ExponentPushToken[abcdefghij]', '00000000-0000-0000-0000-0000000000a3', 'ios')$$);
select pg_temp.try('on ne peut pas enregistrer un téléphone pour un autre', $$insert into push_tokens (token, user_id) values ('ExponentPushToken[zzzzzzzzzz]', '00000000-0000-0000-0000-0000000000a4')$$, 'row-level security');

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
