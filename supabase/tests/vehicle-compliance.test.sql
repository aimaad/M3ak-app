-- Tests SQL des obligations du véhicule : assurance, visite technique, vignette (migration 0069).
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
create function pg_temp.rows(stmt text) returns int language plpgsql as $$ declare n int; begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant execute on function pg_temp.as_user(text), pg_temp.ck(text, boolean, text), pg_temp.try(text, text, text), pg_temp.rows(text) to authenticated;

set session_replication_role = replica;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'own@x.test'), ('00000000-0000-0000-0000-0000000000a2', 'mgr@x.test'), ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test'), ('00000000-0000-0000-0000-0000000000b1', 'oth@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'), ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Propriétaire'), ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'Responsable'), ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé'), ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Autre');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut, documents) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible',
   '[{"type":"assurance","path":"A/v/ass.jpg","uploadedAt":"2026-01-01T00:00:00Z","expiresAt":"2026-12-26"},{"type":"visite_technique","path":"A/v/vt.jpg","uploadedAt":"2026-01-01T00:00:00Z","expiresAt":"2026-11-23T00:00:00.000Z"},{"type":"carte_grise","path":"A/v/cg.jpg","uploadedAt":"2026-01-01T00:00:00Z","expiresAt":null}]'::jsonb),
  ('f2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '2-B-2', 'Kia', 'Rio', 300, 'disponible', '[]'::jsonb);
insert into maintenance_items (agency_id, vehicle_id, type, echeance_date, statut) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', '2026-12-26', 'a_venir'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', '2027-12-26', 'a_venir'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'visite_technique', '2026-05-01', 'effectuee'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'vidange', '2026-12-01', 'a_venir');
set session_replication_role = origin;

-- Reprise de l'existant : on rejoue les deux requêtes de la migration (sur des données « d'avant »).
delete from vehicle_compliance;
alter table public.vehicle_compliance disable trigger trg_vehicle_compliance_sync;

insert into public.vehicle_compliance (agency_id, vehicle_id, kind, valid_until)
select mi.agency_id, mi.vehicle_id, mi.type::text, mi.echeance_date
from public.maintenance_items mi
where mi.type::text in ('assurance', 'visite_technique')
  and mi.statut::text not in ('effectuee')
  and mi.echeance_date is not null
on conflict (vehicle_id, kind, valid_until) do nothing;

insert into public.vehicle_compliance (agency_id, vehicle_id, kind, valid_until, document_path)
select v.agency_id, v.id, d ->> 'type', left(d ->> 'expiresAt', 10)::date, d ->> 'path'
from public.vehicles v
cross join lateral jsonb_array_elements(case when jsonb_typeof(v.documents) = 'array' then v.documents else '[]'::jsonb end) d
where d ->> 'type' in ('assurance', 'visite_technique')
  and (d ->> 'expiresAt') ~ '^\d{4}-\d{2}-\d{2}'
on conflict (vehicle_id, kind, valid_until) do update
  set document_path = coalesce(public.vehicle_compliance.document_path, excluded.document_path);

alter table public.vehicle_compliance enable trigger trg_vehicle_compliance_sync;

do $$
declare
  r record;
begin
  for r in select distinct vehicle_id, kind, agency_id from public.vehicle_compliance where kind in ('assurance', 'visite_technique') loop
    perform public.vehicle_compliance_resync(r.vehicle_id, r.kind, r.agency_id);
  end loop;
end;
$$;

select pg_temp.ck('reprise : assurance du document (26/12/2026) avec sa photo', (select count(*) = 1 from vehicle_compliance where kind = 'assurance' and valid_until = '2026-12-26' and document_path = 'A/v/ass.jpg'), '');
select pg_temp.ck('reprise : l''échéance d''entretien de même date ne fait pas de doublon', (select count(*) = 2 from vehicle_compliance where kind = 'assurance'), (select count(*)::text from vehicle_compliance where kind = 'assurance'));
select pg_temp.ck('reprise : visite technique du document (date ISO complète)', (select count(*) = 1 from vehicle_compliance where kind = 'visite_technique' and valid_until = '2026-11-23'), '');
select pg_temp.ck('reprise : la carte grise et la vidange ne sont pas reprises', (select count(*) = 3 from vehicle_compliance), (select count(*)::text from vehicle_compliance));
select pg_temp.ck('reprise : une visite déjà effectuée n''est pas reprise', (select count(*) = 0 from vehicle_compliance where kind = 'visite_technique' and valid_until = '2026-05-01'), '');

grant all on res to authenticated;
set role authenticated;

-- Employé : voit et renouvelle.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('employé : renouveler l''assurance', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until, reference, provider, amount) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'assurance', '2027-12-27', '2028-12-26', 'POL-1', 'Wafa', 4200)$$);
select pg_temp.try('employé : vignette de l''année', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'vignette', '2027-01-31')$$);
select pg_temp.try('même période envoyée deux fois : pas de doublon', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'vignette', '2027-01-31')$$, 'duplicate key');
select pg_temp.try('type inconnu refusé', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'permis', '2027-01-31')$$, 'kind');
select pg_temp.try('début après la fin refusé', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_from, valid_until) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'visite_technique', '2027-06-01', '2027-01-01')$$, 'check');
select pg_temp.try('montant négatif refusé', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until, amount) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'visite_technique', '2027-03-01', -5)$$, 'amount');
select pg_temp.try('référence trop longue refusée', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until, reference) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'visite_technique', '2027-03-02', repeat('x', 81))$$, 'reference');
select pg_temp.try('l''agence envoyée par le client est ignorée (c''est celle du véhicule)', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until) values ('bbbbbbbb-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'visite_technique', '2027-04-01')$$);
select pg_temp.ck('… la ligne est bien dans l''agence du véhicule', (select agency_id = 'aaaaaaaa-0000-0000-0000-000000000001' and created_by = '00000000-0000-0000-0000-0000000000a3' from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and kind = 'visite_technique' and valid_until = '2027-04-01'), '');
select pg_temp.try('employé : ne peut pas renouveler pour un véhicule d''une autre agence', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until) values ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'assurance', '2027-05-01')$$, 'row-level security');
select pg_temp.ck('employé : voit les périodes de son agence', (select count(*) >= 3 from vehicle_compliance), '');
select pg_temp.ck('employé : ne corrige pas une ligne (0 ligne modifiée)', pg_temp.rows($$update vehicle_compliance set reference = 'X' where vehicle_id = 'f1000000-0000-0000-0000-000000000001'$$) = 0, '');
select pg_temp.ck('employé : ne supprime pas une ligne (0 ligne supprimée)', pg_temp.rows($$delete from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001'$$) = 0, '');

-- Responsable : corrige et supprime.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.ck('responsable : corrige une ligne', pg_temp.rows($$update vehicle_compliance set reference = 'POL-1-corrigé' where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and kind = 'assurance' and valid_until = '2028-12-26'$$) = 1, '');
select pg_temp.ck('responsable : ne peut pas déplacer une ligne vers un autre véhicule', pg_temp.rows($$update vehicle_compliance set vehicle_id = 'f2000000-0000-0000-0000-000000000002' where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and kind = 'vignette'$$) = 1 and (select count(*) = 1 from vehicle_compliance where kind = 'vignette' and vehicle_id = 'f1000000-0000-0000-0000-000000000001'), '');
select pg_temp.ck('responsable : supprime une ligne', pg_temp.rows($$delete from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and kind = 'vignette'$$) = 1, '');

-- Autre agence : rien.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ck('autre agence : ne voit rien de l''agence A', (select count(*) = 0 from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('autre agence : ne peut pas ajouter pour un véhicule de A', $$insert into vehicle_compliance (agency_id, vehicle_id, kind, valid_until) values ('bbbbbbbb-0000-0000-0000-000000000002', 'f1000000-0000-0000-0000-000000000001', 'assurance', '2030-01-01')$$, 'row-level security');

-- Réglages : périodicité de la visite technique.
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('employé : ne règle pas la périodicité', $$insert into agency_compliance_settings (agency_id, visit_interval_months) values ('aaaaaaaa-0000-0000-0000-000000000001', 12)$$, 'row-level security');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('responsable : règle la périodicité à 12 mois', $$insert into agency_compliance_settings (agency_id, visit_interval_months) values ('aaaaaaaa-0000-0000-0000-000000000001', 12)$$);
select pg_temp.try('périodicité à 0 refusée', $$update agency_compliance_settings set visit_interval_months = 0 where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'visit_interval_months');
select pg_temp.try('périodicité à 40 mois refusée', $$update agency_compliance_settings set visit_interval_months = 40 where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'visit_interval_months');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('employé : lit la périodicité', (select visit_interval_months = 12 from agency_compliance_settings where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ck('autre agence : ne lit pas les réglages de A', (select count(*) = 0 from agency_compliance_settings where agency_id = 'aaaaaaaa-0000-0000-0000-000000000001'), '');

-- Cohérence avec les anciens écrans (documents du véhicule + échéances d'entretien).
reset role;
select pg_temp.ck('sync : une seule échéance d''entretien ouverte « assurance », à la date de la période en cours', (select count(*) = 1 and bool_and(echeance_date = '2028-12-26') from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type = 'assurance' and statut in ('a_venir', 'due', 'en_retard')), (select string_agg(echeance_date::text, ',') from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type = 'assurance'));
select pg_temp.ck('sync : la date d''expiration du document « assurance » suit', (select (d ->> 'expiresAt') = '2028-12-26' from vehicles v, jsonb_array_elements(v.documents) d where v.id = 'f1000000-0000-0000-0000-000000000001' and d ->> 'type' = 'assurance'), '');
select pg_temp.ck('sync : la photo du document existant est conservée (renouvellement sans nouvelle photo)', (select (d ->> 'path') = 'A/v/ass.jpg' from vehicles v, jsonb_array_elements(v.documents) d where v.id = 'f1000000-0000-0000-0000-000000000001' and d ->> 'type' = 'assurance'), '');
select pg_temp.ck('sync : les autres documents (carte grise) ne bougent pas', (select count(*) = 1 from vehicles v, jsonb_array_elements(v.documents) d where v.id = 'f1000000-0000-0000-0000-000000000001' and d ->> 'type' = 'carte_grise'), '');
select pg_temp.ck('sync : la vidange (autre type) n''est pas touchée', (select count(*) = 1 from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type = 'vidange' and statut = 'a_venir'), '');
select pg_temp.ck('sync : pas d''échéance d''entretien pour la vignette', (select count(*) = 0 from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type::text = 'vignette'), '');
insert into vehicle_compliance (vehicle_id, kind, valid_until, document_path) values ('f1000000-0000-0000-0000-000000000001', 'visite_technique', '2027-05-20', 'A/v/vt-new.jpg');
select pg_temp.ck('sync : nouvelle photo de visite technique → le document pointe vers elle', (select (d ->> 'path') = 'A/v/vt-new.jpg' and (d ->> 'expiresAt') = '2027-05-20' from vehicles v, jsonb_array_elements(v.documents) d where v.id = 'f1000000-0000-0000-0000-000000000001' and d ->> 'type' = 'visite_technique'), '');
select pg_temp.ck('sync : l''ancienne échéance de visite technique est remplacée', (select count(*) = 1 and bool_and(echeance_date = '2027-05-20') from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type = 'visite_technique' and statut = 'a_venir'), '');
select pg_temp.ck('sync : une visite déjà effectuée reste dans l''historique des entretiens', (select count(*) = 1 from maintenance_items where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and type = 'visite_technique' and statut = 'effectuee'), '');
delete from vehicle_compliance where vehicle_id = 'f1000000-0000-0000-0000-000000000001' and kind = 'visite_technique' and valid_until = '2027-05-20';
select pg_temp.ck('sync : on supprime la période en cours → la précédente (2027-04-01) redevient la période en cours', (select (d ->> 'expiresAt') = '2027-04-01' from vehicles v, jsonb_array_elements(v.documents) d where v.id = 'f1000000-0000-0000-0000-000000000001' and d ->> 'type' = 'visite_technique'), '');

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
