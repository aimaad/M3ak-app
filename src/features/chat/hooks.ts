import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { askChat, deleteConversation, listConversations, listMessages } from './api';

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
