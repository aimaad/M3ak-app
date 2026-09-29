import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCustomer,
  getCustomer,
  getDocumentSignedUrl,
  listCustomers,
  updateCustomer,
  updateCustomerDocuments,
} from './api';
import type { CustomerDocument, CustomerInput } from './types';

const customersKey = ['customers'] as const;
const customerKey = (id: string) => ['customers', id] as const;

export function useCustomers() {
  return useQuery({ queryKey: customersKey, queryFn: listCustomers });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: customerKey(id ?? ''),
    queryFn: () => getCustomer(id as string),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, input }: { agencyId: string; input: CustomerInput }) =>
      createCustomer(agencyId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKey });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CustomerInput }) => updateCustomer(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customersKey });
      queryClient.invalidateQueries({ queryKey: customerKey(data.id) });
    },
  });
}

export function useUpdateCustomerDocuments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, documents }: { id: string; documents: CustomerDocument[] }) =>
      updateCustomerDocuments(id, documents),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customersKey });
      queryClient.invalidateQueries({ queryKey: customerKey(data.id) });
    },
  });
}

export function useDocumentSignedUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['document-url', path],
    queryFn: () => getDocumentSignedUrl(path as string),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  });
}
