import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getDepositForRental, resolveDepositRecord } from './api';
import type { Deposit } from './types';

const depositKey = (rentalId: string) => ['deposits', rentalId] as const;

export function useDeposit(rentalId: string | undefined) {
  return useQuery({
    queryKey: depositKey(rentalId ?? ''),
    queryFn: () => getDepositForRental(rentalId as string),
    enabled: !!rentalId,
  });
}

export function useResolveDeposit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: { montantRetenu: number; montantRestitue: number; statut: Deposit['statut'] };
    }) => resolveDepositRecord(id, values),
    onSuccess: (deposit) => {
      queryClient.invalidateQueries({ queryKey: depositKey(deposit.rentalId) });
    },
  });
}
