-- M3ak — Données de démo : une agence à Casablanca avec ~15 véhicules.
-- Ce fichier est rejoué par `supabase db reset`. Il ne crée PAS d'utilisateur
-- (Supabase Auth doit rester la seule source des comptes) : après votre
-- inscription dans l'app, reliez votre compte à cette agence avec la requête
-- donnée dans supabase/README.md.

insert into public.agencies (id, nom, ville, plan)
values ('11111111-1111-1111-1111-111111111111', 'M3ak Demo — Casablanca', 'Casablanca', 'trial')
on conflict (id) do nothing;

insert into public.branches (id, agency_id, nom, ville, adresse)
values (
  '11111111-1111-1111-1111-111111111112',
  '11111111-1111-1111-1111-111111111111',
  'Agence principale — Maarif',
  'Casablanca',
  '12 Rue Ibnou Mounir, Maarif, Casablanca'
)
on conflict (id) do nothing;

insert into public.vehicles
  (agency_id, branch_id, immatriculation, marque, modele, annee, carburant, kilometrage, statut, prix_jour)
values
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '8921-أ-14', 'Dacia', 'Logan', 2022, 'diesel', 32000, 'disponible', 250),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '4410-ب-14', 'Dacia', 'Sandero', 2023, 'essence', 18500, 'disponible', 260),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '7765-ج-14', 'Renault', 'Clio', 2021, 'essence', 45200, 'en_location', 280),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '2290-د-14', 'Renault', 'Symbol', 2020, 'diesel', 61000, 'disponible', 270),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '5561-ه-14', 'Peugeot', '208', 2022, 'essence', 27800, 'en_location', 290),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '3340-و-14', 'Peugeot', '301', 2021, 'diesel', 52300, 'a_inspecter', 275),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '9012-ز-14', 'Hyundai', 'Accent', 2020, 'essence', 68900, 'maintenance', 260),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '6678-ح-14', 'Kia', 'Picanto', 2023, 'essence', 9800, 'disponible', 220),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '1123-ط-14', 'Volkswagen', 'Golf', 2021, 'diesel', 41200, 'disponible', 380),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '8834-ي-14', 'Fiat', 'Panda', 2019, 'essence', 74100, 'disponible', 200),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '4456-ك-14', 'Citroën', 'C3', 2022, 'essence', 21400, 'en_location', 265),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '7789-ل-14', 'Toyota', 'Yaris', 2023, 'hybride', 12600, 'disponible', 350),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '2201-م-14', 'Seat', 'Ibiza', 2020, 'essence', 58700, 'disponible', 255),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '5590-ن-14', 'Skoda', 'Fabia', 2021, 'diesel', 39900, 'a_inspecter', 260),
  ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111112', '3312-س-14', 'Dacia', 'Duster', 2022, 'diesel', 33500, 'disponible', 420)
on conflict (agency_id, immatriculation) do nothing;

insert into public.customers (agency_id, nom_complet, cin_ou_passeport, numero_permis, telephone)
values
  ('11111111-1111-1111-1111-111111111111', 'Youssef El Amrani', 'BE482913', 'A123456', '+212661234567'),
  ('11111111-1111-1111-1111-111111111111', 'Salma Bennani', 'BK190273', 'B987654', '+212662345678'),
  ('11111111-1111-1111-1111-111111111111', 'Karim Idrissi', 'BJ004521', 'C456789', '+212663456789');

insert into public.maintenance_items (agency_id, vehicle_id, type, echeance_date, echeance_km, statut)
select
  '11111111-1111-1111-1111-111111111111',
  v.id,
  m.type::public.maintenance_type,
  m.echeance_date,
  m.echeance_km,
  m.statut::public.maintenance_status
from public.vehicles v
join (
  values
    ('9012-ز-14', 'vidange', current_date + interval '3 days', 72000, 'due'),
    ('9012-ز-14', 'freins', current_date + interval '10 days', null, 'a_venir'),
    ('3340-و-14', 'visite_technique', current_date - interval '2 days', null, 'en_retard'),
    ('1123-ط-14', 'assurance', current_date + interval '20 days', null, 'a_venir')
) as m(immatriculation, type, echeance_date, echeance_km, statut)
  on m.immatriculation = v.immatriculation
where v.agency_id = '11111111-1111-1111-1111-111111111111';
