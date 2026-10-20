import { useMemo, useState } from 'react';

export const PAGE_SIZE = 15;

export type Page<T> = { items: T[]; page: number; pageCount: number; total: number };

/** Découpe une liste en pages (page commence à 1) ; une page hors limites est ramenée dans les limites. */
export function paginate<T>(items: readonly T[], page: number, pageSize: number = PAGE_SIZE): Page<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), page: current, pageCount, total: items.length };
}

/** Pagination d'une liste déjà filtrée ; revient à la page 1 quand `resetKey` (recherche, filtres…) change. */
export function usePagination<T>(items: readonly T[], resetKey: unknown, pageSize: number = PAGE_SIZE) {
  const [state, setState] = useState({ page: 1, key: resetKey });
  // Un changement de recherche/filtre ramène à la page 1 sans effet intermédiaire.
  const page = Object.is(state.key, resetKey) ? state.page : 1;
  const result = useMemo(() => paginate(items, page, pageSize), [items, page, pageSize]);
  return { ...result, setPage: (next: number) => setState({ page: next, key: resetKey }) };
}
