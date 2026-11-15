-- Tests SQL : les anciens écrans (document, échéance d'entretien) suivent la couverture RÉELLE (migration 0082).
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
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, documents) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, '[{"type":"assurance","path":"","uploadedAt":"2026-01-01T00:00:00Z","expiresAt":"2020-01-01"}]'),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-2', 'Kia', 'Rio', 300, '[{"type":"assurance","path":"","uploadedAt":"2026-01-01T00:00:00Z","expiresAt":"2020-01-01"}]'),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-3', 'Fiat', 'Tipo', 300, '[{"type":"assurance","path":"","uploadedAt":"2026-01-01T00:00:00Z","expiresAt":"2020-01-01"}]'),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '4-A-4', 'Seat', 'Ibiza', 300, '[{"type":"assurance","path":"old/paper.jpg","uploadedAt":"2026-01-01T00:00:00Z","expiresAt":"2020-01-01"}]');
set session_replication_role = origin;

-- 1 : SEULEMENT une période à venir (dans 400 jours) ; 2 : en cours (finit dans 20 j) + suivante enchaînée (dans 385 j) ; 3 : terminée il y a 5 j + à venir dans 100 j.
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', current_date + 400, current_date + 765),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'assurance', current_date - 345, current_date + 20),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'assurance', current_date + 21, current_date + 385),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'assurance', current_date - 370, current_date - 5),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'assurance', current_date + 100, current_date + 465);

select pg_temp.ck('seule une période à venir : échéance d''entretien EN RETARD (vue par À surveiller et le chat)', (select count(*) = 1 and bool_and(statut::text = 'en_retard' and echeance_date < current_date) from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type::text = 'assurance'));
select pg_temp.ck('seule une période à venir : le document garde sa vraie date (aucune période inventée)', (select documents -> 0 ->> 'expiresAt' = (current_date + 765)::text from vehicles where id = 'f1000000-0000-0000-0000-000000000001'));
select pg_temp.ck('seule une période à venir : aucune période créée en plus', (select count(*) = 1 from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001'));
select pg_temp.ck('couverture continue : échéance et document = fin de la CHAÎNE', (select count(*) = 1 and bool_and(echeance_date = current_date + 385 and statut::text = 'a_venir') from maintenance_items where vehicle_id = 'f2000000-0000-0000-0000-000000000002' and type::text = 'assurance')
  and (select documents -> 0 ->> 'expiresAt' = (current_date + 385)::text from vehicles where id = 'f2000000-0000-0000-0000-000000000002'));
select pg_temp.ck('trou de couverture : échéance et document = fin de la dernière période TERMINÉE (donc expirée)', (select bool_and(echeance_date = current_date - 5) from maintenance_items where vehicle_id = 'f3000000-0000-0000-0000-000000000003' and type::text = 'assurance')
  and (select documents -> 0 ->> 'expiresAt' = (current_date - 5)::text from vehicles where id = 'f3000000-0000-0000-0000-000000000003'));

select pg_temp.ck('le chat voit l''assurance du trou de couverture (3-A-3) parmi les documents expirés, pas celle du véhicule couvert (2-A-2)', (select position('3-A-3' in (public.chat_tool_fleet_alerts(30) -> 'expired_documents')::text) > 0 and position('2-A-2' in (public.chat_tool_fleet_alerts(30) -> 'expired_documents')::text) = 0));

-- Un renouvellement REMPLACE le papier (la photo est facultative) : l'ancien papier périmé ne reste jamais rattaché à la nouvelle date.
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until, document_path) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'assurance', current_date - 300, current_date - 10, 'old/paper.jpg');
select pg_temp.ck('papier : la période avec photo range sa photo dans le document', (select documents -> 0 ->> 'path' = 'old/paper.jpg' from vehicles where id = 'f4000000-0000-0000-0000-000000000004'));
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'assurance', current_date - 9, current_date + 355);
select pg_temp.ck('papier : renouvellement SANS photo → l''ancien papier périmé est retiré (chemin vide)', (select documents -> 0 ->> 'path' = '' and documents -> 0 ->> 'expiresAt' = (current_date + 355)::text from vehicles where id = 'f4000000-0000-0000-0000-000000000004'));
insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until, document_path) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f4000000-0000-0000-0000-000000000004', 'assurance', current_date + 356, current_date + 720, 'new/paper.jpg');
select pg_temp.ck('papier : renouvellement AVEC photo → le nouveau papier remplace l''ancien', (select documents -> 0 ->> 'path' = 'new/paper.jpg' from vehicles where id = 'f4000000-0000-0000-0000-000000000004'));

-- Le temps passe sans écriture : dans 30 jours, la période du véhicule 1 est encore à venir ; dans 410 jours elle est en cours.
select public.refresh_compliance_bridge(now() + interval '30 days');
select pg_temp.ck('30 jours plus tard (rien n''a changé) : toujours une seule échéance en retard', (select count(*) = 1 and bool_and(statut::text = 'en_retard') from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type::text = 'assurance'));
select public.refresh_compliance_bridge(now() + interval '410 days');
select pg_temp.ck('la période à venir a commencé : l''échéance suit sa fin', (select count(*) = 1 and bool_and(echeance_date = current_date + 765 and statut::text = 'a_venir') from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type::text = 'assurance'));
select pg_temp.ck('dans 410 jours, le véhicule 3 (trou) est couvert par sa période devenue en cours', (select bool_and(echeance_date = current_date + 465) from maintenance_items where vehicle_id = 'f3000000-0000-0000-0000-000000000003' and type::text = 'assurance'));

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
