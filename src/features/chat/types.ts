export type ChatSource = { type: 'rental'; id: string; label: string };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[];
  createdAt: string;
};

export type ChatConversation = { id: string; title: string; updatedAt: string };

export type ChatAnswer = { conversationId: string; answer: string; sources: ChatSource[] };
