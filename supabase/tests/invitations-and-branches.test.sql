-- Tests SQL des invitations sécurisées (0026) puis de l'accès par filiale (0022, 0024, 0025).
-- Le second bloc réutilise les agences, membres et filiales créés par le premier.

\set ON_ERROR_STOP off
create temp table res(name text, ok boolean, detail text);
-- helpers
set session_replication_role = replica;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-0000000000a1','owner@x.test'),
 ('00000000-0000-0000-0000-0000000000a2','mgr-rabat@x.test'),
 ('00000000-0000-0000-0000-0000000000a3','emp-casa@x.test'),
 ('00000000-0000-0000-0000-0000000000a4','emp-all@x.test'),
 ('00000000-0000-0000-0000-0000000000a5','intruder@x.test'),
 ('00000000-0000-0000-0000-0000000000a6','outsider@x.test');
insert into agencies (id,nom,created_by) values ('11111111-1111-1111-1111-111111111111','A','00000000-0000-0000-0000-0000000000a1'),
                                                  ('22222222-2222-2222-2222-222222222222','B','00000000-0000-0000-0000-0000000000a6');
insert into branches (id,agency_id,nom) values ('b1111111-1111-1111-1111-111111111111','11111111-1111-1111-1111-111111111111','Casa'),
                                                ('b2222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Rabat');
insert into agency_members (agency_id,user_id,role,nom_complet,branch_id) values
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a1','owner','Owner',null),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a2','manager','Mgr Rabat','b2222222-2222-2222-2222-222222222222'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a3','employee','Emp Casa','b1111111-1111-1111-1111-111111111111'),
 ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000a4','employee','Emp All',null),
 ('22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-0000000000a6','owner','Out',null);
set session_replication_role = origin;
grant all on res to authenticated;
set role authenticated;
\set A '11111111-1111-1111-1111-111111111111'
-- 1. owner crée invitation
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select set_config('t.inv1', public.create_agency_invite('11111111-1111-1111-1111-111111111111','New.Person@Mail.com','Sara','Idrissi','employee','b1111111-1111-1111-1111-111111111111')::text, false);
insert into res select 'owner crée invitation', (current_setting('t.inv1')::jsonb->>'code') ~ '^[A-Z2-9]{12}$', current_setting('t.inv1');
-- code non stocké en clair
reset role;
insert into res select 'code jamais stocké en clair', not exists (select 1 from agency_invites where code is not null) and (select code_hash = public.invite_code_hash(current_setting('t.inv1')::jsonb->>'code') from agency_invites where email='new.person@mail.com'), '';
set role authenticated;
-- 2. écriture directe interdite
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin begin insert into agency_invites(agency_id,role,expires_at,email,code_hash) values ('11111111-1111-1111-1111-111111111111','employee',now()+interval '1 day','z@z.com','x'); insert into res values('insert direct interdit', false,'insert passé'); exception when others then insert into res values('insert direct interdit', true, sqlerrm); end; end $$;
-- 3. doublon en attente
do $$ begin begin perform public.create_agency_invite('11111111-1111-1111-1111-111111111111','new.person@mail.com','Sara','Idrissi','employee',null); insert into res values('doublon refusé', false, ''); exception when others then insert into res values('doublon refusé', sqlerrm='invite_already_pending', sqlerrm); end; end $$;
-- 4. membre existant
do $$ begin begin perform public.create_agency_invite('11111111-1111-1111-1111-111111111111','emp-all@x.test','Sara','Idrissi','employee',null); insert into res values('déjà membre refusé', false, ''); exception when others then insert into res values('déjà membre refusé', sqlerrm='already_member', sqlerrm); end; end $$;
-- 5. rôle owner interdit
do $$ begin begin perform public.create_agency_invite('11111111-1111-1111-1111-111111111111','o@x.com','Sara','Idrissi','owner',null); insert into res values('rôle owner refusé', false, ''); exception when others then insert into res values('rôle owner refusé', sqlerrm='role_not_allowed', sqlerrm); end; end $$;
-- 6. employé ne peut pas inviter
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$ begin begin perform public.create_agency_invite('11111111-1111-1111-1111-111111111111','e@x.com','Sara','Idrissi','employee',null); insert into res values('employé ne peut pas inviter', false, ''); exception when others then insert into res values('employé ne peut pas inviter', sqlerrm='not_allowed', sqlerrm); end; end $$;
insert into res select 'employé ne voit pas les invitations', (select count(*) from agency_invites)=0, '';
-- 7. responsable Rabat : autre filiale refusée, sans filiale => Rabat, agence entière interdite
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
do $$ begin begin perform public.create_agency_invite('11111111-1111-1111-1111-111111111111','c@x.com','Sara','Idrissi','employee','b1111111-1111-1111-1111-111111111111'); insert into res values('resp Rabat -> Casa refusé', false, ''); exception when others then insert into res values('resp Rabat -> Casa refusé', sqlerrm='branch_access_denied', sqlerrm); end; end $$;
select set_config('t.inv2', public.create_agency_invite('11111111-1111-1111-1111-111111111111','rabat.guy@mail.com','Omar','Alami','employee',null)::text, false);
insert into res select 'resp Rabat sans filiale => Rabat', (current_setting('t.inv2')::jsonb->>'branch_id')='b2222222-2222-2222-2222-222222222222', current_setting('t.inv2');
insert into res select 'resp Rabat ne voit que ses invitations', (select count(*) from agency_invites)=1, (select count(*)::text from agency_invites);
-- 8. rejoindre : mauvais e-mail
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
do $$ begin begin perform public.redeem_invite((current_setting('t.inv1')::jsonb->>'code')); insert into res values('mauvais e-mail refusé', false, ''); exception when others then insert into res values('mauvais e-mail refusé', sqlerrm='invite_email_mismatch', sqlerrm); end; end $$;
do $$ begin begin perform public.redeem_invite('AAAAAAAAAAAA'); insert into res values('code inconnu refusé', false, ''); exception when others then insert into res values('code inconnu refusé', sqlerrm='invite_invalid_or_expired', sqlerrm); end; end $$;
-- 9. bon e-mail
reset role;
insert into auth.users (id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b1','New.Person@mail.com','{"prenom":"Sara","nom":"Idrissi-Signup"}');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select set_config('t.role', public.redeem_invite(lower(substr(current_setting('t.inv1')::jsonb->>'code',1,4)||'-'||substr(current_setting('t.inv1')::jsonb->>'code',5,4)||'-'||substr(current_setting('t.inv1')::jsonb->>'code',9,4)))::text, false);
insert into res select 'bon e-mail rejoint (code avec tirets/minuscules)', current_setting('t.role')='employee', current_setting('t.role');
insert into res select 'profil rempli avec nom', (select nom_complet='Sara Idrissi-Signup' and branch_id='b1111111-1111-1111-1111-111111111111' from agency_members where user_id='00000000-0000-0000-0000-0000000000b1'), (select nom_complet from agency_members where user_id='00000000-0000-0000-0000-0000000000b1');
-- 10. usage unique
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a5');
do $$ begin begin perform public.redeem_invite((current_setting('t.inv1')::jsonb->>'code')); insert into res values('usage unique', false, ''); exception when others then insert into res values('usage unique', sqlerrm='invite_invalid_or_expired', sqlerrm); end; end $$;
-- 11. renvoyer : ancien code mort, nouveau ok
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select set_config('t.inv2b', public.resend_agency_invite((current_setting('t.inv2')::jsonb->>'id')::uuid)::text, false);
insert into res select 'renvoi change le code', (current_setting('t.inv2b')::jsonb->>'code') <> (current_setting('t.inv2')::jsonb->>'code'), '';
reset role;
insert into auth.users (id,email) values ('00000000-0000-0000-0000-0000000000b2','rabat.guy@mail.com');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin begin perform public.redeem_invite((current_setting('t.inv2')::jsonb->>'code')); insert into res values('ancien code invalide après renvoi', false, ''); exception when others then insert into res values('ancien code invalide après renvoi', sqlerrm='invite_invalid_or_expired', sqlerrm); end; end $$;
-- 12. annulation
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.revoke_agency_invite((current_setting('t.inv2')::jsonb->>'id')::uuid);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b2');
do $$ begin begin perform public.redeem_invite((current_setting('t.inv2b')::jsonb->>'code')); insert into res values('invitation annulée inutilisable', false, ''); exception when others then insert into res values('invitation annulée inutilisable', sqlerrm='invite_invalid_or_expired', sqlerrm); end; end $$;
-- 13. e-mail non confirmé
reset role;
insert into auth.users (id,email,email_confirmed_at) values ('00000000-0000-0000-0000-0000000000b3','late@mail.com',null);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select set_config('t.inv3', public.create_agency_invite('11111111-1111-1111-1111-111111111111','late@mail.com','Late','Guy','manager',null)::text, false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
do $$ begin begin perform public.redeem_invite((current_setting('t.inv3')::jsonb->>'code')); insert into res values('e-mail non confirmé refusé', false, ''); exception when others then insert into res values('e-mail non confirmé refusé', sqlerrm='email_not_confirmed', sqlerrm); end; end $$;
-- 14. expiration
reset role;
update agency_invites set expires_at = now() - interval '1 minute' where email='late@mail.com';
update auth.users set email_confirmed_at = now() where id='00000000-0000-0000-0000-0000000000b3';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b3');
do $$ begin begin perform public.redeem_invite((current_setting('t.inv3')::jsonb->>'code')); insert into res values('invitation expirée refusée', false, ''); exception when others then insert into res values('invitation expirée refusée', sqlerrm='invite_invalid_or_expired', sqlerrm); end; end $$;
-- 15. ré-invitation après expiration
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin begin perform public.create_agency_invite('11111111-1111-1111-1111-111111111111','late@mail.com','Late','Guy','manager',null); insert into res values('réinvitation après expiration', true, ''); exception when others then insert into res values('réinvitation après expiration', false, sqlerrm); end; end $$;
-- 16. autre agence ne peut pas inviter dans A
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a6');
do $$ begin begin perform public.create_agency_invite('11111111-1111-1111-1111-111111111111','q@x.com','Sara','Idrissi','employee',null); insert into res values('autre agence refusée', false, ''); exception when others then insert into res values('autre agence refusée', sqlerrm='not_allowed', sqlerrm); end; end $$;
-- 17. anon sans droit
reset role;
insert into res select 'anon sans EXECUTE', not has_function_privilege('anon','public.redeem_invite(text)','execute') and not has_function_privilege('anon','public.create_agency_invite(uuid,text,text,text,public.agency_role,uuid)','execute'), '';
select case when ok then 'OK  ' else 'FAIL' end as r, name, detail from res order by ok, name;

-- ============================ accès par filiale ============================
reset role;
set session_replication_role = replica;
create temp table res2(name text, ok boolean, detail text);
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u::text, false); end $$;
-- fixtures from previous scenario remain: owner a1, mgr Rabat a2 (Rabat), emp Casa a3 (Casa), emp all a4
insert into vehicles (id, agency_id, branch_id, immatriculation, marque, modele) values
 ('c1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','b1111111-1111-1111-1111-111111111111','1-A-1','Dacia','Logan'),
 ('c2000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','2-A-1','Renault','Clio'),
 ('c3000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',null,'3-A-1','Fiat','Tipo');
insert into customers (id, agency_id, nom_complet) values ('d0000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Client');
set session_replication_role = origin;
grant all on res2 to authenticated;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into res2 select 'emp Casa voit Casa + partagé (2)', (select count(*) from vehicles)=2, (select string_agg(immatriculation,',') from vehicles);
insert into res2 select 'emp Casa ne voit qu''une filiale', (select count(*) from branches)=1, '';
insert into res2 select 'emp Casa ne voit pas membres Rabat', not exists(select 1 from agency_members where user_id='00000000-0000-0000-0000-0000000000a2'), '';
with u as (update vehicles set kilometrage=5 where immatriculation='2-A-1' returning 1) insert into res2 select 'emp Casa ne modifie pas véhicule Rabat', (select count(*) from u)=0, '';
do $$ begin begin update vehicles set branch_id='b1111111-1111-1111-1111-111111111111' where immatriculation='3-A-1'; insert into res2 values('emp Casa ne s''approprie pas le partagé', not found, 'rows='||(case when found then 'updated' else '0' end)); exception when others then insert into res2 values('emp Casa ne s''approprie pas le partagé', true, sqlerrm); end; end $$;
do $$ begin begin insert into vehicles(agency_id,branch_id,immatriculation,marque,modele) values ('11111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','9-A-1','K','R'); insert into res2 values('emp Casa ne crée pas dans Rabat', false, ''); exception when others then insert into res2 values('emp Casa ne crée pas dans Rabat', true, sqlerrm); end; end $$;
insert into vehicles(agency_id,immatriculation,marque,modele) values ('11111111-1111-1111-1111-111111111111','8-A-1','K','R');
insert into res2 select 'véhicule créé rattaché à sa filiale', (select branch_id from vehicles where immatriculation='8-A-1')='b1111111-1111-1111-1111-111111111111', '';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
insert into res2 select 'emp sans filiale voit tout (4)', (select count(*) from vehicles)=4, (select count(*)::text from vehicles);
insert into res2 select 'emp sans filiale voit 2 filiales', (select count(*) from branches)=2, '';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into res2 select 'owner voit tout', (select count(*) from vehicles)=4 and (select count(*) from branches)=2, '';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into res2 select 'resp Rabat voit Rabat + partagé (2)', (select count(*) from vehicles)=2, (select string_agg(immatriculation,',') from vehicles);
do $$ begin begin insert into branches(agency_id,nom) values ('11111111-1111-1111-1111-111111111111','Tanger'); insert into res2 values('resp de filiale ne crée pas de filiale', false,''); exception when others then insert into res2 values('resp de filiale ne crée pas de filiale', true, sqlerrm); end; end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
-- location d'un véhicule partagé par emp Casa -> branch_depart = Casa
insert into rentals(agency_id, vehicle_id, customer_id, date_debut_prevue, date_fin_prevue, prix_total) values ('11111111-1111-1111-1111-111111111111','c3000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000001', now()+interval '1 day', now()+interval '3 day', 100);
insert into res2 select 'location véhicule partagé rattachée à la filiale de l''employé', (select branch_depart_id from rentals limit 1)='b1111111-1111-1111-1111-111111111111', coalesce((select branch_depart_id::text from rentals limit 1),'null');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into res2 select 'resp Rabat ne voit pas la location de Casa', (select count(*) from rentals)=0, (select count(*)::text from rentals);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4');
insert into res2 select 'emp sans filiale voit la location', (select count(*) from rentals)=1, '';
-- 0030 : un véhicule réservé / en location ne peut pas être archivé
reset role;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$ begin begin update vehicles set archived_at = now() where id='c3000000-0000-0000-0000-000000000003'; insert into res2 values('archivage refusé si location active', false, 'passé'); exception when others then insert into res2 values('archivage refusé si location active', sqlerrm='vehicle_has_active_rentals', sqlerrm); end; end $$;
reset role;
update rentals set statut='annulee';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
update vehicles set archived_at = now() where id='c3000000-0000-0000-0000-000000000003';
insert into res2 select 'archivage autorisé si location annulée', archived_at is not null, '' from vehicles where id='c3000000-0000-0000-0000-000000000003';
reset role;
select case when ok then 'OK  ' else 'FAIL' end r, name, detail from res2 order by ok, name;
