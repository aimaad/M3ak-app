-- M3ak — lecture automatique des papiers d'assurance et de visite technique (fonction `scan-document`).
-- Le suivi d'utilisation (compteurs seulement : jamais l'image ni les valeurs lues) accepte ces deux nouveaux types de document.
alter table public.ocr_usage_events drop constraint if exists ocr_usage_events_document_type_check;
alter table public.ocr_usage_events
  add constraint ocr_usage_events_document_type_check check (document_type in ('permis', 'carte_grise', 'insights', 'contrat_modele', 'chat', 'assurance', 'visite_technique'));
