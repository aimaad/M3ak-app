-- Tests SQL du motif d'indisponibilité (migration 0068).
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
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a3');
insert into agency_members (agency_id, user_id, role, nom_complet) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut) values ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible');
set session_replication_role = origin;
grant all on res to authenticated;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');

select pg_temp.try('rendre indisponible avec un motif', $$update vehicles set statut = 'indisponible', statut_motif = 'Pare-brise cassé' where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('le motif est enregistré', (select statut_motif = 'Pare-brise cassé' from vehicles where id = 'f1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('motif de plus de 200 caractères : refusé', $$update vehicles set statut_motif = repeat('x', 201) where id = 'f1000000-0000-0000-0000-000000000001'$$, 'statut_motif');
select pg_temp.try('motif de 200 caractères : accepté', $$update vehicles set statut_motif = repeat('x', 200) where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.try('rendre disponible', $$update vehicles set statut = 'disponible' where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('le motif disparaît quand le véhicule n''est plus indisponible', (select statut_motif is null from vehicles where id = 'f1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('un motif sur un véhicule disponible est ignoré', $$update vehicles set statut_motif = 'oublié' where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('… il n''est pas gardé', (select statut_motif is null from vehicles where id = 'f1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('sans motif : rendre indisponible', $$update vehicles set statut = 'indisponible', statut_motif = null where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('statut indisponible sans motif', (select statut = 'indisponible' and statut_motif is null from vehicles where id = 'f1000000-0000-0000-0000-000000000001'), '');

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
