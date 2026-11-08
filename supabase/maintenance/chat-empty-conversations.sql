-- BIBIP — Nettoyage des conversations de chat VIDES (0 message) : doublons laissés par des envois échoués.
-- À lancer dans Supabase → SQL Editor. ÉTAPE 1 : compter. ÉTAPE 2 : supprimer (seulement après avoir vérifié le nombre).
-- Ne touche jamais une conversation qui contient au moins un message.

-- ÉTAPE 1 — combien de conversations seraient supprimées ?
select count(*) as conversations_vides
from public.chat_conversations c
where not exists (select 1 from public.chat_convo_messages m where m.conversation_id = c.id);

-- (facultatif) aperçu : titre et date de chaque conversation vide
select c.id, c.title, c.created_at
from public.chat_conversations c
where not exists (select 1 from public.chat_convo_messages m where m.conversation_id = c.id)
order by c.created_at desc
limit 50;

-- ÉTAPE 2 — suppression, dans une transaction que VOUS validez. Lancez les 2 premières lignes (begin + with…), lisez le
-- nombre « supprimees » : s'il est égal au nombre compté à l'étape 1, tapez « commit; » ; sinon « rollback; » (rien n'est perdu).
-- Décommentez les lignes ci-dessous seulement quand vous êtes prêt.
--
-- begin;
-- with deleted as (
--   delete from public.chat_conversations c
--   where not exists (select 1 from public.chat_convo_messages m where m.conversation_id = c.id)
--   returning c.id
-- )
-- select count(*) as supprimees from deleted;
-- commit;   -- ou : rollback;
