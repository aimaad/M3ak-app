-- M3ak — réglages simples du contrat d'une agence (interrupteurs, mentions légales, conditions modifiées…).
-- Le modèle de contrat (colonne `template`) est fabriqué par l'app à partir de ces réglages ; on garde les réglages
-- pour que le propriétaire les retrouve tels qu'il les a laissés.

alter table public.agency_contract_templates add column if not exists options jsonb;

alter table public.agency_contract_templates drop constraint if exists contract_options_check;
alter table public.agency_contract_templates
  add constraint contract_options_check
  check (options is null or (jsonb_typeof(options) = 'object' and pg_column_size(options) <= 200000));
