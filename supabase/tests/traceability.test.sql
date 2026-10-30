-- Tests SQL de la traçabilité (migration 0036) : qui a fait quoi, visible du propriétaire seulement, infalsifiable.
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
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner-b@x.test');
insert into agencies (id, nom, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'Manager A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employee A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Owner B');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour)
values ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300);
set session_replication_role = origin;

grant all on res to authenticated;
set role authenticated;

-- 1. L'employé agit : client, véhicule, location, paiement, note
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
insert into customers (id, agency_id, nom_complet, telephone, cin_ou_passeport)
  values ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Un', '0661000001', 'AB123456');
update customers set telephone = '0661999999', ville = 'Casablanca' where id = 'c1000000-0000-0000-0000-000000000001';
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue)
  values ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'en_attente_confirmation', now() + interval '1 day', now() + interval '3 day');
update rentals set statut = 'confirmee' where id = 'a1000000-0000-0000-0000-000000000001';
insert into payments (agency_id, rental_id, montant, methode, statut) values ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 250, 'especes', 'paye');
insert into customer_notes (agency_id, customer_id, body) values ('aaaaaaaa-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'SECRET : client à surveiller');

-- 2. Le responsable archive un véhicule
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
update vehicles set prix_jour = 350 where id = 'f1000000-0000-0000-0000-000000000001';

-- 3. Visibilité : propriétaire seulement
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('journal : un employé ne voit rien', (select count(*) = 0 from agency_audit_log), (select count(*)::text from agency_audit_log));
select pg_temp.try('résumé : un employé est refusé', $$select public.audit_activity_summary('aaaaaaaa-0000-0000-0000-000000000001')$$, 'not_allowed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.ck('journal : un responsable ne voit rien', (select count(*) = 0 from agency_audit_log), '');
select pg_temp.try('résumé : un responsable est refusé', $$select public.audit_activity_summary('aaaaaaaa-0000-0000-0000-000000000001')$$, 'not_allowed');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ck('journal : le propriétaire d''une autre entreprise ne voit rien de A', (select count(*) = 0 from agency_audit_log where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '');
select pg_temp.try('résumé : une autre entreprise est refusée', $$select public.audit_activity_summary('aaaaaaaa-0000-0000-0000-000000000001')$$, 'not_allowed');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('journal : le propriétaire voit les actions de l''employé avec son nom et son rôle',
  (select count(*) >= 6 from agency_audit_log where actor_name = 'Employee A' and actor_role = 'employee'), (select string_agg(action, ',') from agency_audit_log));
select pg_temp.ck('journal : client créé et modifié (noms de champs seulement)',
  (select count(*) = 1 from agency_audit_log where action = 'customer_created' and target_label = 'Client Un')
  and (select details -> 'fields' @> '["telephone","ville"]'::jsonb from agency_audit_log where action = 'customer_updated'), '');
select pg_temp.ck('journal : location créée puis confirmée, avec véhicule et client',
  (select details ->> 'vehicle' = 'Dacia Logan' and details ->> 'customer' = 'Client Un' from agency_audit_log where action = 'rental_created')
  and exists (select 1 from agency_audit_log where action = 'rental_confirmed' and target_label like 'RES-%'), (select string_agg(action, ',') from agency_audit_log));
select pg_temp.ck('journal : paiement enregistré avec montant et mode',
  (select (details ->> 'amount')::numeric = 250 and details ->> 'method' = 'especes' from agency_audit_log where action = 'payment_recorded'), '');
select pg_temp.ck('journal : le prix modifié par le responsable est tracé avec son nom',
  (select actor_name = 'Manager A' and (details ->> 'from')::numeric = 300 and (details ->> 'to')::numeric = 350 from agency_audit_log where action = 'vehicle_price_changed'), '');
select pg_temp.ck('journal : la note est tracée SANS son contenu, et aucune pièce d''identité n''apparaît',
  exists (select 1 from agency_audit_log where action = 'customer_note_added')
  and not exists (select 1 from agency_audit_log where details::text ilike '%SECRET%' or target_label ilike '%SECRET%' or details::text like '%AB123456%'), '');
select pg_temp.ck('journal : chaque ligne a une catégorie',
  (select count(*) = 0 from agency_audit_log where category is null), '');

select pg_temp.ck('résumé : le propriétaire voit l''activité par employé',
  (select (e ->> 'total')::int >= 6 and e -> 'categories' ? 'rental' from jsonb_array_elements(public.audit_activity_summary('aaaaaaaa-0000-0000-0000-000000000001')) e where e ->> 'actor_name' = 'Employee A'), '');
select pg_temp.ck('résumé : la période filtre (rien dans le futur)',
  jsonb_array_length(public.audit_activity_summary('aaaaaaaa-0000-0000-0000-000000000001', now() + interval '1 day', null)) = 0, '');

-- 4. Infalsifiable, même par le propriétaire
select pg_temp.try('journal : le propriétaire ne peut pas modifier une ligne', $$update agency_audit_log set actor_name = 'Autre'$$, 'permission denied');
select pg_temp.try('journal : le propriétaire ne peut pas effacer une ligne', $$delete from agency_audit_log$$, 'permission denied');
select pg_temp.try('journal : le propriétaire ne peut pas inventer une ligne', $$insert into agency_audit_log (agency_id, action) values ('aaaaaaaa-0000-0000-0000-000000000001', 'rental_created')$$, 'permission denied');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('journal : un employé ne peut pas appeler audit_event', $$select public.audit_event('aaaaaaaa-0000-0000-0000-000000000001', 'rental_created', 'X', null)$$, 'permission denied');

-- 5. Un échec du journal ne bloque jamais l'opération métier
reset role;
alter table agency_audit_log add constraint test_break check (action <> 'customer_created');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('robustesse : l''opération métier réussit même si le journal échoue',
  $$insert into customers (agency_id, nom_complet) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Client Robuste')$$);
select pg_temp.ck('robustesse : le client a bien été créé', (select count(*) = 1 from customers where nom_complet = 'Client Robuste'), '');

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
