import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { askChat, deleteConversation, listConversations, listMessages, renameConversation, searchConversationIds } from './api';

export function useConversations() {
  return useQuery({ queryKey: ['chat-conversations'], queryFn: listConversations });
}

export function useChatMessages(conversationId: string | null) {
  return useQuery({ queryKey: ['chat-messages', conversationId], enabled: !!conversationId, queryFn: () => listMessages(conversationId as string) });
}

export function useAskChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: askChat,
    onSuccess: (answer) => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      return queryClient.invalidateQueries({ queryKey: ['chat-messages', answer.conversationId] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }),
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: renameConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }),
  });
}

/** Recherche dans le contenu des messages côté serveur ; si la fonction n'est pas encore installée, la liste filtre localement. */
export function useConversationSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['chat-search', q],
    enabled: q.length >= 2,
    retry: false,
    staleTime: 30_000,
    queryFn: () => searchConversationIds(q),
  });
}
