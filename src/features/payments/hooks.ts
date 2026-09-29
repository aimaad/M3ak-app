import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createPayment, listPaymentsForRental } from './api';
import type { PaymentInput } from './types';

const paymentsKey = (rentalId: string) => ['payments', rentalId] as const;

export function usePaymentsForRental(rentalId: string | undefined) {
  return useQuery({
    queryKey: paymentsKey(rentalId ?? ''),
    queryFn: () => listPaymentsForRental(rentalId as string),
    enabled: !!rentalId,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agencyId,
      rentalId,
      input,
    }: {
      agencyId: string;
      rentalId: string;
      input: PaymentInput;
    }) => createPayment(agencyId, rentalId, input),
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(payment.rentalId) });
    },
  });
}
