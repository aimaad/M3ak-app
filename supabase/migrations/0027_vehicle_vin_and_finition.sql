-- M3ak — création rapide de véhicule : VIN et finition/version, pour le
-- préremplissage par scan de carte grise ou saisie manuelle. `vin` est
-- unique par agence quand renseigné (Postgres traite chaque NULL comme
-- distinct, donc plusieurs véhicules sans VIN restent possibles).

alter table public.vehicles
  add column vin text,
  add column finition text,
  add constraint vehicles_agency_vin_unique unique (agency_id, vin);
