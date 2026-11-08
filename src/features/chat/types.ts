export type ChatSource = { type: 'rental'; id: string; label: string };

/** Une ligne d'une carte de données (construite par le serveur à partir des résultats réels des outils). */
export type ChatCardItem = {
  kind: 'vehicle' | 'rental';
  id: string;
  title: string;
  plate: string | null;
  customer: string | null;
  date: string | null;
  tone: 'free' | 'late' | 'rented' | 'pending';
};
export type ChatCard = { type: 'vehicles' | 'rentals'; items: ChatCardItem[] };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[];
  cards: ChatCard[];
  createdAt: string;
};

/** `preview` : début de la dernière réponse de BIBIP (null si aucune). */
export type ChatConversation = { id: string; title: string; updatedAt: string; preview: string | null };

export type ChatAnswer = { conversationId: string; answer: string; sources: ChatSource[]; cards: ChatCard[] };
