-- BIBIP — Chat : historique des conversations.
--   * chat_search : recherche dans les titres ET le contenu des messages de l'utilisateur (RLS : ses conversations seulement).
-- Le nettoyage des conversations vides (doublons laissés par des envois échoués) n'est PAS fait ici : voir
-- supabase/maintenance/chat-empty-conversations.sql (compter d'abord, supprimer ensuite).

create or replace function public.chat_search(p_query text)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select '%' || replace(replace(replace(btrim(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
           length(btrim(coalesce(p_query, ''))) as len
  )
  select c.id
  from public.chat_conversations c, q
  where q.len >= 2
    and (
      c.title ilike q.pattern
      or exists (select 1 from public.chat_convo_messages m where m.conversation_id = c.id and m.content ilike q.pattern)
    )
  order by c.updated_at desc
  limit 100;
$$;

revoke all on function public.chat_search(text) from public, anon;
grant execute on function public.chat_search(text) to authenticated;
