-- BIBIP — Chat : cartes de données sous les réponses (véhicules libres, locations), construites côté serveur à partir des
-- résultats réels des outils. Stockées avec le message pour réapparaître quand on rouvre la conversation.
alter table public.chat_convo_messages
  add column if not exists cards jsonb not null default '[]'::jsonb
  check (jsonb_typeof(cards) = 'array' and pg_column_size(cards) <= 8000);
