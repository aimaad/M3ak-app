-- BIBIP — Chat : messages vocaux.
--   * chat_convo_messages : chemin de l'audio, durée, indicateur « vocal » ; chat_conversations : commencée à la voix ;
--   * bucket PRIVÉ « chat-audio » : seul l'auteur lit, écrit ou supprime ses fichiers (dossier = son identifiant) ;
--   * file d'attente de suppression : quand un message est supprimé (avec sa conversation, ou par la purge de 90 jours), le
--     chemin de son audio est mis en file ; la fonction `chat-m3ak` supprime les fichiers de la file (stockage = API Storage).

alter table public.chat_conversations
  add column if not exists via_voice boolean not null default false;

alter table public.chat_convo_messages
  add column if not exists audio_path text check (audio_path is null or length(audio_path) <= 200),
  add column if not exists audio_ms integer check (audio_ms is null or audio_ms between 0 and 120000),
  add column if not exists via_voice boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-audio', 'chat-audio', false, 6291456, array['audio/wav', 'audio/x-wav', 'audio/aac', 'audio/mp4', 'audio/mpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat_audio_select_own" on storage.objects;
create policy "chat_audio_select_own" on storage.objects
  for select using (bucket_id = 'chat-audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "chat_audio_insert_own" on storage.objects;
create policy "chat_audio_insert_own" on storage.objects
  for insert with check (bucket_id = 'chat-audio' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "chat_audio_delete_own" on storage.objects;
create policy "chat_audio_delete_own" on storage.objects
  for delete using (bucket_id = 'chat-audio' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.chat_audio_cleanup (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  created_at timestamptz not null default now()
);
-- RLS active et aucune règle : personne côté application ; seul le rôle service (fonction serveur) y accède.
alter table public.chat_audio_cleanup enable row level security;

create or replace function public.chat_audio_enqueue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.audio_path is not null then
    insert into public.chat_audio_cleanup (path) values (old.audio_path);
  end if;
  return old;
end;
$$;
revoke all on function public.chat_audio_enqueue() from public, anon, authenticated;

drop trigger if exists chat_audio_enqueue_trg on public.chat_convo_messages;
create trigger chat_audio_enqueue_trg
  before delete on public.chat_convo_messages
  for each row execute function public.chat_audio_enqueue();
