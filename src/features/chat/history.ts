import type { ChatConversation } from './types';

export type HistorySectionKind = 'today' | 'yesterday' | 'week' | 'month';
export type HistorySection = {
  /** Clé stable : `today`, `yesterday`, `week` ou `AAAA-MM`. */
  key: string;
  kind: HistorySectionKind;
  /** Premier jour du mois (sections « mois »). */
  month?: Date;
  items: ChatConversation[];
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Regroupe les conversations (déjà triées de la plus récente à la plus ancienne) : AUJOURD'HUI, HIER, CETTE SEMAINE (les 5 jours
 * d'avant hier), puis un groupe par mois (« octobre », « septembre »…).
 */
export function groupConversations(conversations: ChatConversation[], now: Date): HistorySection[] {
  const today = startOfDay(now).getTime();
  const sections: HistorySection[] = [];
  const slot = (key: string, kind: HistorySectionKind, month?: Date): HistorySection => {
    let section = sections.find((s) => s.key === key);
    if (!section) {
      section = { key, kind, ...(month ? { month } : {}), items: [] };
      sections.push(section);
    }
    return section;
  };
  // La plus récente d'abord, même si la liste reçue n'est pas triée.
  const ordered = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const conversation of ordered) {
    const date = new Date(conversation.updatedAt);
    const days = Math.round((today - startOfDay(date).getTime()) / DAY_MS);
    if (days <= 0) slot('today', 'today').items.push(conversation);
    else if (days === 1) slot('yesterday', 'yesterday').items.push(conversation);
    else if (days <= 6) slot('week', 'week').items.push(conversation);
    else {
      const month = new Date(date.getFullYear(), date.getMonth(), 1);
      slot(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`, 'month', month).items.push(conversation);
    }
  }
  return sections;
}

/** Texte sans accents ni casse, pour la recherche. */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase();
}

/** Titre ou aperçu qui contient la recherche (sans tenir compte des accents ni de la casse). */
export function matchesSearch(conversation: ChatConversation, query: string): boolean {
  const q = normalizeSearch(query.trim());
  if (!q) return true;
  return normalizeSearch(`${conversation.title} ${conversation.preview ?? ''}`).includes(q);
}
