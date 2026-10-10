-- M3ak — consentement de protection des données personnelles (client).
-- Simple déclaratif (case à cocher + horodatage), pas un système de gestion
-- de consentements granulaire par finalité : suffisant pour une agence qui
-- doit juste attester avoir recueilli l'accord du client.

alter table public.customers
  add column consentement_donnees boolean not null default false,
  add column consentement_date timestamptz;
