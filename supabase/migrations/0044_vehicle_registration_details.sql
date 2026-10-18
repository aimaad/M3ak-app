-- M3ak — informations de la carte grise marocaine conservées sur la fiche du véhicule :
-- date de première mise en circulation et puissance fiscale (CV). Les autres informations de la carte
-- (immatriculation, châssis, marque, modèle, carburant, places) ont déjà leur colonne ; la fin de validité
-- de la carte grise est portée par le document « carte grise » du véhicule (alertes d'expiration).

alter table public.vehicles
  add column if not exists date_mise_en_circulation date,
  add column if not exists puissance_fiscale smallint;

alter table public.vehicles drop constraint if exists vehicles_puissance_fiscale_check;
alter table public.vehicles
  add constraint vehicles_puissance_fiscale_check check (puissance_fiscale is null or (puissance_fiscale between 1 and 60));
