-- M3ak — Mode vocal en temps réel (prototype) : suivi des sessions pour appliquer les limites de minutes et estimer le coût.
--
--  * Une ligne par session vocale : agence, utilisateur, modèle, voix, durée, tokens, coût estimé. AUCUN son, AUCUNE phrase.
--  * Écrite et lue uniquement par les fonctions serveur (rôle service) : RLS activée, aucune policy, donc illisible depuis l'app.
--  * Les limites (durée d'une session, minutes par utilisateur et par jour, minutes par agence et par jour) sont des secrets
--    Supabase réglables sans redéployer : LIVE_SESSION_SECONDS, LIVE_USER_DAILY_SECONDS, LIVE_AGENCY_DAILY_SECONDS.
-- Aucune donnée existante n'est modifiée.

create table if not exists public.chat_live_sessions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  model text not null,
  voice text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds integer check (seconds is null or seconds between 0 and 86400),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cost_usd numeric(10, 4),
  ended_reason text check (ended_reason is null or char_length(ended_reason) <= 40)
);

create index if not exists chat_live_sessions_agency_started_idx on public.chat_live_sessions (agency_id, started_at desc);
create index if not exists chat_live_sessions_user_started_idx on public.chat_live_sessions (user_id, started_at desc);

alter table public.chat_live_sessions enable row level security;
-- Volontairement AUCUNE policy : seules les fonctions serveur (rôle service, qui ignore la RLS) y accèdent.
revoke all on public.chat_live_sessions from anon, authenticated;
