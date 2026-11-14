-- Tests SQL des échéances périodiques (migration 0071).
\set ON_ERROR_STOP off
create temp table res (n serial, name text, ok boolean, detail text);
grant all on res to authenticated;
grant usage, select on sequence res_n_seq to authenticated;
create function pg_temp.ck(label text, cond boolean, detail text default '') returns void
language plpgsql as $$ begin insert into res(name, ok, detail) values (label, coalesce(cond, false), detail); end $$;
grant execute on function pg_temp.ck(text, boolean, text) to authenticated;

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test'), ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut, kilometrage) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible', 48200);
insert into maintenance_items (id, agency_id, vehicle_id, type, echeance_km, statut, repeat_km, repeat_months) values
  ('11000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'vidange', 45000, 'en_cours', 10000, 12),
  ('11000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'freins', 50000, 'en_cours', null, null),
  ('11000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'pneus', 60000, 'en_cours', 40000, null);
set session_replication_role = origin;

-- Un employé peut terminer l'entretien : la suivante est créée quand même (fonction du serveur).
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', false);
update maintenance_items set statut = 'effectuee', date_intervention = '2026-11-14' where id = '11000000-0000-0000-0000-000000000001';
reset role;

select pg_temp.ck('vidange périodique : une échéance suivante est créée', (select count(*) from maintenance_items where type = 'vidange' and statut = 'a_venir') = 1);
select pg_temp.ck('km suivant = kilométrage actuel + 10 000', (select echeance_km from maintenance_items where type = 'vidange' and statut = 'a_venir') = 58200);
select pg_temp.ck('date suivante = intervention + 12 mois', (select echeance_date from maintenance_items where type = 'vidange' and statut = 'a_venir') = date '2027-11-14');
select pg_temp.ck('la périodicité est reprise sur la suivante', (select repeat_km = 10000 and repeat_months = 12 from maintenance_items where type = 'vidange' and statut = 'a_venir'));

-- Rejouer la même mise à jour ne crée rien de plus.
update maintenance_items set notes = 'x' where id = '11000000-0000-0000-0000-000000000001';
update maintenance_items set statut = 'effectuee' where id = '11000000-0000-0000-0000-000000000001';
select pg_temp.ck('pas de doublon si on rejoue', (select count(*) from maintenance_items where type = 'vidange') = 2);

-- Sans périodicité : rien n'est créé.
update maintenance_items set statut = 'effectuee', date_intervention = '2026-11-14' where id = '11000000-0000-0000-0000-000000000002';
select pg_temp.ck('sans périodicité : pas de suivante', (select count(*) from maintenance_items where type = 'freins') = 1);

-- Kilométrage seul : pas de date.
update maintenance_items set statut = 'effectuee', date_intervention = '2026-11-14' where id = '11000000-0000-0000-0000-000000000003';
select pg_temp.ck('km seul : 48 200 + 40 000 et aucune date', (select echeance_km = 88200 and echeance_date is null from maintenance_items where type = 'pneus' and statut = 'a_venir'));

-- Une échéance déjà en attente (créée à la main) : pas de deuxième.
insert into maintenance_items (id, agency_id, vehicle_id, type, echeance_km, statut, repeat_km) values
  ('11000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'autre', 70000, 'en_cours', 5000),
  ('11000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'autre', 75000, 'a_venir', null);
update maintenance_items set statut = 'effectuee' where id = '11000000-0000-0000-0000-000000000004';
select pg_temp.ck('déjà une échéance en attente : pas de doublon', (select count(*) from maintenance_items where type = 'autre' and statut = 'a_venir') = 1);

-- Valeurs absurdes refusées.
do $$ begin
  begin update maintenance_items set repeat_km = 0 where id = '11000000-0000-0000-0000-000000000003'; perform pg_temp.ck('repeat_km = 0 refusé', false);
  exception when check_violation then perform pg_temp.ck('repeat_km = 0 refusé', true); end;
end $$;

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
