-- Tests SQL : outils du chat : finances, alertes, statistiques, activité, contrats (migration 0059).
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
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'ownerb@x.test');
insert into agencies (id, nom, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Agence B', '00000000-0000-0000-0000-0000000000b1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner A'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Emp A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1', 'owner', 'Owner B');
insert into customers (id, agency_id, nom_complet, telephone, cin_ou_passeport) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Karim Alami', '0661000001', 'AB123456');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, documents) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300,
    jsonb_build_array(jsonb_build_object('type', 'assurance', 'expiresAt', (current_date - 3)::text),
                      jsonb_build_object('type', 'visite_technique', 'expiresAt', (current_date + 10)::text),
                      jsonb_build_object('type', 'carte_grise', 'expiresAt', (current_date - 100)::text))),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-3', 'Renault', 'Clio', 350, '[]'),
  ('f2000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', '2-B-2', 'Kia', 'Rio', 300, '[]');
insert into maintenance_items (agency_id, vehicle_id, type, echeance_date, statut) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'vidange', current_date + 5, 'a_venir'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'freins', current_date + 200, 'a_venir');
insert into rentals (id, agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue, prix_total) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'terminee', now() - interval '10 days', now() - interval '8 days', 1000),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'terminee', now() - interval '6 days', now() - interval '4 days', 600),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'annulee', now() - interval '3 days', now() - interval '2 days', 999);
insert into payments (agency_id, rental_id, montant, statut, date_paiement) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1000, 'paye', now() - interval '8 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 200, 'paye', now() - interval '4 days'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 100, 'en_attente', now() - interval '4 days');
insert into deposits (rental_id, agency_id, montant_bloque, montant_retenu, montant_restitue, statut) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 2000, 300, 1700, 'partiellement_retenue');
insert into contracts (agency_id, rental_id, numero, statut, customer_nom, customer_cin, vehicle_immatriculation, vehicle_marque, vehicle_modele, date_debut_prevue, date_fin_prevue, signed_at, client_signature_path) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'C-001', 'signe', 'Karim Alami', 'AB123456', '1-A-1', 'Dacia', 'Logan', now() - interval '10 days', now() - interval '8 days', now() - interval '10 days', 'aaaaaaaa-0000-0000-0000-000000000001/sig-secret.png');
insert into agency_audit_log (agency_id, actor_id, actor_name, action, target_label, details, category) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'Emp A', 'rental_created', 'Karim Alami', '{"note":"TEXTE-SENSIBLE"}', 'rental');
set session_replication_role = origin;

set role authenticated;

-- ---- propriétaire de A
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('finances : encaissé sur 30 jours = 1200', (public.chat_tool_finance(now() - interval '30 days', now() + interval '1 day')->>'collected')::numeric = 1200, public.chat_tool_finance()::text);
select pg_temp.ck('finances : en attente = 100', (public.chat_tool_finance()->>'pending_payments')::numeric = 100, '');
select pg_temp.ck('finances : impayé = 400 (la location annulée est ignorée)', (public.chat_tool_finance()->>'unpaid_total')::numeric = 400, public.chat_tool_finance()::text);
select pg_temp.ck('finances : caution retenue = 300', (public.chat_tool_finance()->'deposits'->>'retained_total')::numeric = 300, '');
select pg_temp.ck('finances : caution encore bloquée = 0', (public.chat_tool_finance()->'deposits'->>'currently_blocked')::numeric = 0, public.chat_tool_finance()::text);
select pg_temp.ck('alertes : assurance expirée signalée', jsonb_array_length(public.chat_tool_fleet_alerts(30)->'expired_documents') = 1, public.chat_tool_fleet_alerts(30)::text);
select pg_temp.ck('alertes : la carte grise n''est pas une alerte', public.chat_tool_fleet_alerts(30)::text not like '%carte_grise%', '');
select pg_temp.ck('alertes : visite technique dans 10 jours', jsonb_array_length(public.chat_tool_fleet_alerts(30)->'documents_expiring_soon') = 1, '');
select pg_temp.ck('alertes : vidange dans 5 jours, freins dans 200 jours ignoré', jsonb_array_length(public.chat_tool_fleet_alerts(30)->'maintenance_due') = 1, public.chat_tool_fleet_alerts(30)::text);
select pg_temp.ck('statistiques : la Logan est la plus louée (2 locations)', (public.chat_tool_fleet_stats()->'most_rented'->0->>'plate') = '1-A-1' and (public.chat_tool_fleet_stats()->'most_rented'->0->>'rentals')::int = 2, public.chat_tool_fleet_stats()::text);
select pg_temp.ck('statistiques : la Clio (annulée) n''a aucune location', (public.chat_tool_fleet_stats()->>'never_rented_in_period')::int = 1, '');
select pg_temp.ck('statistiques : le propriétaire voit le chiffre d''affaires', (public.chat_tool_fleet_stats()->'most_rented'->0->>'revenue') is not null, '');
select pg_temp.ck('statistiques : demande de la période (2) contre précédente (0)', (public.chat_tool_fleet_stats()->'demand'->>'rentals_started_this_period')::int = 2 and (public.chat_tool_fleet_stats()->'demand'->>'rentals_started_previous_period')::int = 0, public.chat_tool_fleet_stats()::text);
select pg_temp.ck('activité : le propriétaire voit les actions de l''employé', jsonb_array_length(public.chat_tool_activity('emp')->'events') = 1, public.chat_tool_activity('emp')::text);
select pg_temp.ck('activité : jamais le contenu des détails', public.chat_tool_activity(null)::text not like '%TEXTE-SENSIBLE%', '');
select pg_temp.ck('activité : l''équipe est listée', jsonb_array_length(public.chat_tool_activity(null)->'team') = 2, '');
select pg_temp.ck('contrats : un contrat signé', (public.chat_tool_contracts('signe')->'contracts'->0->>'client_signed')::boolean, public.chat_tool_contracts('signe')::text);
select pg_temp.ck('contrats : ni CIN ni chemin de signature', public.chat_tool_contracts(null)::text not like '%AB123456%' and public.chat_tool_contracts(null)::text not like '%sig-secret%', '');
select pg_temp.ck('contrats : recherche par client', jsonb_array_length(public.chat_tool_contracts(null, null, null, 'karim')->'contracts') = 1, '');

-- ---- employé de A : pas d'argent, pas de journal
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.ck('employé : finances refusées', public.chat_tool_finance()->>'error' = 'owner_only', public.chat_tool_finance()::text);
select pg_temp.ck('employé : pas de chiffre d''affaires dans les statistiques', (public.chat_tool_fleet_stats()->'most_rented'->0->>'revenue') is null, '');
select pg_temp.ck('employé : journal d''activité vide', jsonb_array_length(public.chat_tool_activity(null)->'events') = 0, '');
select pg_temp.ck('employé : voit quand même les alertes', jsonb_array_length(public.chat_tool_fleet_alerts(30)->'expired_documents') = 1, '');

-- ---- propriétaire de B : isolation
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.ck('isolation : B ne voit rien des finances de A', (public.chat_tool_finance()->>'collected')::numeric = 0 and (public.chat_tool_finance()->>'unpaid_total')::numeric = 0, public.chat_tool_finance()::text);
select pg_temp.ck('isolation : B ne voit pas les contrats de A', jsonb_array_length(public.chat_tool_contracts(null)->'contracts') = 0, '');
select pg_temp.ck('isolation : B ne voit pas les alertes de A', jsonb_array_length(public.chat_tool_fleet_alerts(30)->'expired_documents') = 0, '');

-- ---- accès expiré : tout se ferme
reset role;
update agencies set access_until = now() - interval '1 hour' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.ck('accès expiré : finances refusées', public.chat_tool_finance()->>'error' = 'owner_only', '');
select pg_temp.ck('accès expiré : contrats invisibles', jsonb_array_length(public.chat_tool_contracts(null)->'contracts') = 0, '');

reset role;
select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
