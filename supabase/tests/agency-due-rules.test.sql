-- Tests SQL des règles d'échéances et de la création automatique à l'ajout d'un véhicule (migration 0076).
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
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test'), ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test'), ('00000000-0000-0000-0000-0000000000b1', 'oth@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Autre');
set session_replication_role = origin;

-- Sans réglage : les valeurs proposées s'appliquent (vidange 10 000 km, freins 30 000, pneus 40 000), obligations activées.
select pg_temp.ck('valeurs proposées : vidange 10 000 km', (select repeat_km from effective_due_rules('aaaaaaaa-0000-0000-0000-000000000001') where kind = 'vidange') = 10000);
select pg_temp.ck('valeurs proposées : freins 30 000 km, pneus 40 000 km', (select count(*) from effective_due_rules('aaaaaaaa-0000-0000-0000-000000000001') where (kind = 'freins' and repeat_km = 30000) or (kind = 'pneus' and repeat_km = 40000)) = 2);
select pg_temp.ck('six règles, toutes activées', (select count(*) from effective_due_rules('aaaaaaaa-0000-0000-0000-000000000001') where enabled) = 6);

-- Ajout d'un véhicule (un employé, sans rien saisir de plus) : vidange, freins, pneus créés « À compléter » (aucune date, aucun km).
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('l''ajout du véhicule marche comme avant', $$insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour) values ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300)$$);
reset role;
select pg_temp.ck('3 échéances créées pour le nouveau véhicule', (select count(*) from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001') = 3);
select pg_temp.ck('aucune date ni kilométrage inventés (« À compléter »)', (select bool_and(echeance_date is null and echeance_km is null and statut::text = 'a_venir') from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001'));
select pg_temp.ck('périodicités proposées reprises', (select count(*) from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and ((type::text = 'vidange' and repeat_km = 10000) or (type::text = 'freins' and repeat_km = 30000) or (type::text = 'pneus' and repeat_km = 40000))) = 3);

-- Réglages de l'agence : désactiver les pneus, personnaliser la vidange (15 000 km ou 12 mois).
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('le propriétaire règle ses règles', $$insert into agency_due_rules (agency_id, kind, enabled, repeat_km, repeat_months) values ('aaaaaaaa-0000-0000-0000-000000000001', 'pneus', false, null, null), ('aaaaaaaa-0000-0000-0000-000000000001', 'vidange', true, 15000, 12)$$);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('un employé ne peut pas changer les règles', $$update agency_due_rules set enabled = true where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001' and kind = 'pneus'$$);
select pg_temp.ck('un employé voit les règles de son agence', (select count(*) from agency_due_rules) = 2);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ck('une autre agence ne voit rien', (select count(*) from agency_due_rules) = 0);
reset role;
select pg_temp.ck('l''employé n''a rien modifié', (select enabled from agency_due_rules where kind = 'pneus') = false);
select pg_temp.ck('règle personnalisée prise en compte', (select repeat_km = 15000 and repeat_months = 12 from effective_due_rules('aaaaaaaa-0000-0000-0000-000000000001') where kind = 'vidange'));
select pg_temp.ck('règle non réglée : valeur proposée', (select repeat_km = 30000 from effective_due_rules('aaaaaaaa-0000-0000-0000-000000000001') where kind = 'freins'));

insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour) values ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Kia', 'Rio', 300);
select pg_temp.ck('règles personnalisées : 2 échéances (pneus désactivés)', (select count(*) from maintenance_items where vehicle_id = 'f2000000-0000-0000-0000-000000000002') = 2);
select pg_temp.ck('la vidange reprend 15 000 km ET 12 mois', (select repeat_km = 15000 and repeat_months = 12 from maintenance_items where vehicle_id = 'f2000000-0000-0000-0000-000000000002' and type::text = 'vidange'));
select pg_temp.ck('l''autre agence garde ses valeurs proposées', (select repeat_km from effective_due_rules('bbbbbbbb-0000-0000-0000-000000000002') where kind = 'pneus') = 40000);

-- Valeurs absurdes refusées.
select pg_temp.try('périodicité 0 km refusée', $$insert into agency_due_rules (agency_id, kind, repeat_km) values ('bbbbbbbb-0000-0000-0000-000000000002', 'vidange', 0)$$, 'agency_due_rules_repeat_km_check');
select pg_temp.try('type inconnu refusé', $$insert into agency_due_rules (agency_id, kind) values ('bbbbbbbb-0000-0000-0000-000000000002', 'carrosserie')$$, 'agency_due_rules_kind_check');

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
