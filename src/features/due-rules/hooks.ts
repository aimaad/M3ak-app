import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listDueRules, saveDueRules } from './api';
import { mergeRules } from './logic';
import type { DueRule } from './types';

const rulesKey = ['due-rules'] as const;
const NO_ROWS: DueRule[] = [];

/** Les règles de l'agence : réglages enregistrés, complétés par les valeurs proposées. */
export function useDueRules() {
  const query = useQuery({ queryKey: rulesKey, queryFn: listDueRules });
  return { ...query, rows: query.data ?? NO_ROWS, rules: mergeRules(query.data ?? NO_ROWS) };
}

export function useSaveDueRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agencyId, rules }: { agencyId: string; rules: DueRule[] }) => saveDueRules(agencyId, rules),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rulesKey }),
  });
}
