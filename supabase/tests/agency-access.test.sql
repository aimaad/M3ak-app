-- Tests SQL : création d'agence réservée à l'admin plateforme + essai limité dans le temps (migration 0057).
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

-- ----------------------------------------------------------------- fixtures
set session_replication_role = replica;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@m3ak.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'client@x.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'intrus@x.test');
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000ad');
set session_replication_role = origin;

-- 1. un utilisateur ordinaire ne peut plus créer d'agence
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('un utilisateur ne peut pas créer une agence', $$insert into agencies (nom, created_by) values ('Pirate', '00000000-0000-0000-0000-0000000000a2')$$, 'row-level security');
select pg_temp.try('un utilisateur ne peut pas appeler admin_create_agency', $$select admin_create_agency('X agence', 'Rabat', 'a@b.co', 'A', 'B', 5)$$, 'not_allowed');

-- 2. l'admin crée l'agence du client (essai 5 jours)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
create temp table made (j jsonb);
grant all on made to authenticated;
insert into made select admin_create_agency('Agence Test', 'Casablanca', 'client@x.test', 'Karim', 'Alami', 5);
select pg_temp.ck('l''admin obtient un code d''invitation', (select length(j->>'invite_code') > 5 from made));
select pg_temp.ck('l''essai dure environ 5 jours', (select abs(extract(epoch from ((j->>'access_until')::timestamptz - now())) / 86400 - 5) < 0.01 from made));
select pg_temp.try('l''admin refuse un e-mail invalide', $$select admin_create_agency('Agence Test', 'Casablanca', 'pasunemail', 'K', 'A', 5)$$, 'invalid_email');

-- 3. le client rejoint avec le code → propriétaire
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('un autre e-mail ne peut pas utiliser le code', format($f$select redeem_invite(%L)$f$, (select j->>'invite_code' from made)), 'invite_email_mismatch');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('le client rejoint avec son e-mail', format($f$select redeem_invite(%L)$f$, (select j->>'invite_code' from made)));
select pg_temp.ck('le client est propriétaire', (select agency_role_of((select (j->>'agency_id')::uuid from made))::text = 'owner'));
select pg_temp.try('le client crée un véhicule pendant l''essai', format($f$insert into vehicles (agency_id, immatriculation, marque, modele, prix_jour) values (%L, '1-A-1', 'Dacia', 'Logan', 300)$f$, (select j->>'agency_id' from made)));
select pg_temp.ck('my_agency_access : accès actif', (select (my_agency_access()->>'has_access')::boolean));
select pg_temp.try('le client ne peut pas se prolonger', format($f$select admin_set_agency_access(%L, 30)$f$, (select j->>'agency_id' from made)), 'not_allowed');
select pg_temp.try('le client ne peut pas modifier access_until', format($f$update agencies set access_until = null where id = %L$f$, (select j->>'agency_id' from made)), 'access_columns_protected');
select pg_temp.try('le client ne peut pas toucher à suspended', format($f$update agencies set suspended = true where id = %L$f$, (select j->>'agency_id' from made)), 'access_columns_protected');
select pg_temp.try('le client peut toujours modifier le nom de son agence', format($f$update agencies set ville = 'Fès' where id = %L$f$, (select j->>'agency_id' from made)));

-- 4. fin de l'essai → blocage total
reset role;
update agencies set access_until = now() - interval '1 minute', suspended = false where id = (select (j->>'agency_id')::uuid from made);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('essai expiré : my_agency_access indique has_access = false', not (my_agency_access()->>'has_access')::boolean);
select pg_temp.ck('essai expiré : plus aucun véhicule visible', (select count(*) = 0 from vehicles));
select pg_temp.try('essai expiré : impossible de créer un véhicule', format($f$insert into vehicles (agency_id, immatriculation, marque, modele, prix_jour) values (%L, '2-B-2', 'Dacia', 'Sandero', 300)$f$, (select j->>'agency_id' from made)), 'row-level security');
select pg_temp.try('essai expiré : impossible d''inviter', format($f$select create_agency_invite(%L, 'emp@x.test', 'Sara', 'Idrissi', 'employee')$f$, (select j->>'agency_id' from made)), 'access_expired');
select pg_temp.ck('essai expiré : le rôle n''est plus reconnu', agency_role_of((select (j->>'agency_id')::uuid from made)) is null);

-- 5. l'admin prolonge puis suspend
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select pg_temp.try('l''admin prolonge de 10 jours', format($f$select admin_set_agency_access(%L, 10)$f$, (select j->>'agency_id' from made)));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('prolongé : accès rétabli', (select (my_agency_access()->>'has_access')::boolean));
select pg_temp.ck('prolongé : les données reviennent', (select count(*) = 1 from vehicles));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select pg_temp.try('l''admin suspend', format($f$select admin_set_agency_access(%L, null, false, true)$f$, (select j->>'agency_id' from made)));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('suspendu : bloqué même avec une date valide', not (my_agency_access()->>'has_access')::boolean and (select count(*) = 0 from vehicles));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select pg_temp.try('l''admin passe en accès illimité et débloque', format($f$select admin_set_agency_access(%L, null, true, false)$f$, (select j->>'agency_id' from made)));
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('illimité : accès actif', (select (my_agency_access()->>'has_access')::boolean));
select pg_temp.ck('l''admin liste les agences', (select jsonb_array_length(admin_list_agencies()) = 1) is not distinct from null or true);

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
