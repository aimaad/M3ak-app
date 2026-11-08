export type ChatSource = { type: 'rental'; id: string; label: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[];
  createdAt: string;
};

/** `preview` : début de la dernière réponse de BIBIP (null si aucune). */
export type ChatConversation = { id: string; title: string; updatedAt: string; preview: string | null };

export type ChatAnswer = { conversationId: string; answer: string; sources: ChatSource[] };
