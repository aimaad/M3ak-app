-- Tests SQL des photos du véhicule (migration 0067) : 12 au maximum, angles valides, droits de l'employé ; et message d'archivage précis.
\set ON_ERROR_STOP off
create temp table res (n serial, name text, ok boolean, detail text);
grant all on res to authenticated;
grant usage, select on sequence res_n_seq to authenticated;
create function pg_temp.as_user(u text) returns void language plpgsql as $$ begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create function pg_temp.ck(label text, cond boolean, detail text default '') returns void
language plpgsql as $$ begin insert into res(name, ok, detail) values (label, coalesce(cond, false), detail); end $$;
-- Exécute une instruction : `expect` = texte attendu dans le message d'erreur (null = aucune erreur attendue) ; `expect_detail` = texte attendu dans le détail.
create function pg_temp.try(label text, stmt text, expect text default null, expect_detail text default null) returns void
language plpgsql as $$
declare
  det text;
begin
  begin
    execute stmt;
    insert into res(name, ok, detail) values (label, expect is null, case when expect is null then '' else 'aucune erreur (attendu : ' || expect || ')' end);
  exception when others then
    get stacked diagnostics det = pg_exception_detail;
    insert into res(name, ok, detail) values (label, expect is not null and sqlerrm like '%' || expect || '%' and (expect_detail is null or coalesce(det, '') like '%' || expect_detail || '%'), sqlerrm || ' / ' || coalesce(det, ''));
  end;
end $$;
grant execute on function pg_temp.as_user(text), pg_temp.ck(text, boolean, text), pg_temp.try(text, text, text, text) to authenticated;

set session_replication_role = replica;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@x.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager@x.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'emp@x.test');
insert into agencies (id, nom, created_by) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Agence A', '00000000-0000-0000-0000-0000000000a1');
insert into agency_members (agency_id, user_id, role, nom_complet) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'owner', 'Owner'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', 'manager', 'Manager'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'employee', 'Employé');
insert into vehicles (id, agency_id, immatriculation, marque, modele, prix_jour, statut, photos) values
  ('f1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '1-A-1', 'Dacia', 'Logan', 300, 'disponible',
    '[{"path":"p1","uploadedAt":"2030-01-01","angle":"avant"},{"path":"p2","uploadedAt":"2030-01-02","angle":"arriere"},{"path":"p3","uploadedAt":"2030-01-03"}]'),
  ('f2000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2-A-1', 'Kia', 'Picanto', 280, 'disponible', '[]'),
  ('f3000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '3-A-1', 'Fiat', 'Punto', 250, 'disponible', '[]'),
  ('f4000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '4-A-1', 'Renault', 'Clio', 350, 'en_location', '[]'),
  ('f5000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', '5-A-1', 'Seat', 'Ibiza', 320, 'disponible', '[]'),
  -- Photos « anciennes » invalides (plus de 12) : un autre champ doit pouvoir être modifié sans échouer à cause d'elles
  ('f6000000-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', '6-A-1', 'Opel', 'Corsa', 270, 'disponible',
    (select jsonb_agg(jsonb_build_object('path', 'old' || g, 'uploadedAt', '2029-01-01')) from generate_series(1, 14) g));
insert into customers (id, agency_id, nom_complet) values ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Un');
insert into rentals (agency_id, vehicle_id, customer_id, statut, date_debut_prevue, date_fin_prevue) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'reservee', now() + interval '5 day', now() + interval '8 day'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'reservee', now() + interval '10 day', now() + interval '12 day'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'terminee', now() - interval '20 day', now() - interval '15 day'),
  -- f3 : une location en retard (en cours, retour prévu dépassé)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000001', 'en_cours', now() - interval '9 day', now() - interval '3 day'),
  -- f5 : seulement des locations terminées ou annulées
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'terminee', now() - interval '20 day', now() - interval '15 day'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'f5000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000001', 'annulee', now() + interval '3 day', now() + interval '5 day');
set session_replication_role = origin;

grant all on res to authenticated;
set role authenticated;

-- ============================================================ photos : droits
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('employé : peut AJOUTER une photo (à la fin)',
  $$update vehicles set photos = photos || '[{"path":"p4","uploadedAt":"2030-01-04","angle":"coffre"}]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.try('employé : ne peut pas SUPPRIMER une photo',
  $$update vehicles set photos = '[{"path":"p1","uploadedAt":"2030-01-01","angle":"avant"},{"path":"p3","uploadedAt":"2030-01-03"},{"path":"p4","uploadedAt":"2030-01-04","angle":"coffre"}]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$, 'vehicle_photos_manager_only');
select pg_temp.try('employé : ne peut pas changer la photo principale ni l''ordre',
  $$update vehicles set photos = '[{"path":"p2","uploadedAt":"2030-01-02","angle":"arriere"},{"path":"p1","uploadedAt":"2030-01-01","angle":"avant"},{"path":"p3","uploadedAt":"2030-01-03"},{"path":"p4","uploadedAt":"2030-01-04","angle":"coffre"}]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$, 'vehicle_photos_manager_only');
select pg_temp.try('employé : ne peut pas REMPLACER une photo (même nombre, autre fichier)',
  $$update vehicles set photos = '[{"path":"neuf","uploadedAt":"2030-02-01","angle":"avant"},{"path":"p2","uploadedAt":"2030-01-02","angle":"arriere"},{"path":"p3","uploadedAt":"2030-01-03"},{"path":"p4","uploadedAt":"2030-01-04","angle":"coffre"}]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$, 'vehicle_photos_manager_only');
select pg_temp.try('employé : ne peut pas changer l''angle d''une photo existante',
  $$update vehicles set photos = '[{"path":"p1","uploadedAt":"2030-01-01","angle":"interieur"},{"path":"p2","uploadedAt":"2030-01-02","angle":"arriere"},{"path":"p3","uploadedAt":"2030-01-03"},{"path":"p4","uploadedAt":"2030-01-04","angle":"coffre"}]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$, 'vehicle_photos_manager_only');
select pg_temp.try('employé : ne peut pas insérer une photo AVANT les existantes',
  $$update vehicles set photos = '[{"path":"p0","uploadedAt":"2030-01-00","angle":"autre"}]'::jsonb || photos where id = 'f1000000-0000-0000-0000-000000000001'$$, 'vehicle_photos_manager_only');
select pg_temp.try('employé : modifier un autre champ reste possible (photos inchangées)',
  $$update vehicles set couleur = 'Blanc' where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.try('employé : un autre champ reste modifiable même si d''anciennes photos dépassent la limite',
  $$update vehicles set couleur = 'Rouge' where id = 'f6000000-0000-0000-0000-000000000006'$$);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('responsable : change la photo principale et l''ordre',
  $$update vehicles set photos = '[{"path":"p2","uploadedAt":"2030-01-02","angle":"arriere"},{"path":"p1","uploadedAt":"2030-01-01","angle":"avant"},{"path":"p3","uploadedAt":"2030-01-03"},{"path":"p4","uploadedAt":"2030-01-04","angle":"coffre"}]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.ck('responsable : la première de la liste est la photo principale', (select photos -> 0 ->> 'path' = 'p2' from vehicles where id = 'f1000000-0000-0000-0000-000000000001'), '');
select pg_temp.try('responsable : supprime une photo',
  $$update vehicles set photos = '[{"path":"p2","uploadedAt":"2030-01-02","angle":"arriere"},{"path":"p3","uploadedAt":"2030-01-03"},{"path":"p4","uploadedAt":"2030-01-04","angle":"coffre"}]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$);
select pg_temp.try('responsable : remplace une photo',
  $$update vehicles set photos = '[{"path":"neuf","uploadedAt":"2030-02-01","angle":"arriere"},{"path":"p3","uploadedAt":"2030-01-03"},{"path":"p4","uploadedAt":"2030-01-04","angle":"coffre"}]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$);

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.try('propriétaire : tout, y compris vider la liste', $$update vehicles set photos = '[]'::jsonb where id = 'f1000000-0000-0000-0000-000000000001'$$);

-- ============================================================ photos : limite et angles
select pg_temp.try('12 photos : accepté',
  $$update vehicles set photos = (select jsonb_agg(jsonb_build_object('path', 'x' || g, 'uploadedAt', '2030-01-01', 'angle', 'autre')) from generate_series(1, 12) g) where id = 'f2000000-0000-0000-0000-000000000002'$$);
select pg_temp.try('13 photos : refusé',
  $$update vehicles set photos = (select jsonb_agg(jsonb_build_object('path', 'x' || g, 'uploadedAt', '2030-01-01', 'angle', 'autre')) from generate_series(1, 13) g) where id = 'f2000000-0000-0000-0000-000000000002'$$, 'vehicle_photos_too_many');
select pg_temp.try('angle inconnu : refusé',
  $$update vehicles set photos = '[{"path":"a","uploadedAt":"2030-01-01","angle":"dessus"}]'::jsonb where id = 'f3000000-0000-0000-0000-000000000003'$$, 'vehicle_photo_angle_invalid');
select pg_temp.try('un angle nommé ne sert qu''une fois',
  $$update vehicles set photos = '[{"path":"a","uploadedAt":"2030-01-01","angle":"avant"},{"path":"b","uploadedAt":"2030-01-01","angle":"avant"}]'::jsonb where id = 'f3000000-0000-0000-0000-000000000003'$$, 'vehicle_photo_angle_duplicate');
select pg_temp.try('« autre » peut se répéter, et une photo sans angle (ancienne) reste valable',
  $$update vehicles set photos = '[{"path":"a","uploadedAt":"2030-01-01","angle":"autre"},{"path":"b","uploadedAt":"2030-01-01","angle":"autre"},{"path":"c","uploadedAt":"2030-01-01"}]'::jsonb where id = 'f3000000-0000-0000-0000-000000000003'$$);
select pg_temp.try('les 6 angles nommés : acceptés',
  $$update vehicles set photos = '[{"path":"1","angle":"avant"},{"path":"2","angle":"arriere"},{"path":"3","angle":"cote_gauche"},{"path":"4","angle":"cote_droit"},{"path":"5","angle":"interieur"},{"path":"6","angle":"coffre"}]'::jsonb where id = 'f3000000-0000-0000-0000-000000000003'$$);
select pg_temp.try('liste qui n''est pas un tableau : refusée', $$update vehicles set photos = '{"path":"a"}'::jsonb where id = 'f3000000-0000-0000-0000-000000000003'$$, 'vehicle_photos_invalid');
select pg_temp.try('photo sans chemin : refusée', $$update vehicles set photos = '[{"angle":"avant"}]'::jsonb where id = 'f3000000-0000-0000-0000-000000000003'$$, 'vehicle_photos_invalid');
select pg_temp.try('création avec 13 photos : refusée',
  $$insert into vehicles (agency_id, immatriculation, marque, modele, prix_jour, photos) values ('aaaaaaaa-0000-0000-0000-000000000001', '9-A-1', 'X', 'Y', 1, (select jsonb_agg(jsonb_build_object('path', 'x' || g)) from generate_series(1, 13) g))$$, 'vehicle_photos_too_many');

-- ============================================================ archivage : message précis
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.try('archivage refusé : 2 réservations à venir (la terminée ne compte pas), avec le nombre',
  $$update vehicles set archived_at = now() where id = 'f2000000-0000-0000-0000-000000000002'$$, 'vehicle_has_active_rentals', 'count=2');
select pg_temp.try('archivage refusé : location en retard (en cours, retour dépassé)',
  $$update vehicles set archived_at = now() where id = 'f3000000-0000-0000-0000-000000000003'$$, 'vehicle_has_active_rentals', 'count=1');
select pg_temp.try('archivage refusé : statut en location sans location rattachée (compte 1)',
  $$update vehicles set archived_at = now() where id = 'f4000000-0000-0000-0000-000000000004'$$, 'vehicle_has_active_rentals', 'count=1');
select pg_temp.try('archivage autorisé : locations toutes terminées ou annulées',
  $$update vehicles set archived_at = now() where id = 'f5000000-0000-0000-0000-000000000005'$$);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
select pg_temp.try('archivage refusé à l''employé',
  $$update vehicles set archived_at = now() where id = 'f1000000-0000-0000-0000-000000000001'$$, 'archive_requires_manager');

-- Sans utilisateur (migration, fonction serveur) : pas de restriction de droits sur les photos
reset role;
select pg_temp.as_user('');
select pg_temp.try('sans utilisateur : les photos peuvent être réécrites',
  $$update vehicles set photos = '[]'::jsonb where id = 'f6000000-0000-0000-0000-000000000006'$$);

select case when ok then 'OK  ' else 'FAIL' end as r, name, case when ok then '' else detail end as detail from res order by n;
