import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archiveCustomer,
  createCustomer,
  createDriver,
  getCustomer,
  listCustomers,
  listDrivers,
  reactivateCustomer,
  removeDriver,
  setCustomerConsent,
  updateCustomer,
  updateCustomerDocuments,
} from './api';
import type { Customer, CustomerDocument, CustomerInput, DriverInput } from './types';

const customersKey = ['customers'] as const;
const customerKey = (id: string) => ['customers', id] as const;
const driversKey = (customerId: string) => ['drivers', customerId] as const;

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

function useCustomerStatusMutation(mutationFn: (id: string) => Promise<Customer>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: customersKey });
      queryClient.invalidateQueries({ queryKey: customerKey(data.id) });
    },
  });
}

export function useArchiveCustomer() {
  return useCustomerStatusMutation(archiveCustomer);
}

export function useReactivateCustomer() {
  return useCustomerStatusMutation(reactivateCustomer);
}

export function useSetCustomerConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, consent }: { id: string; consent: boolean }) => setCustomerConsent(id, consent),
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

export function useDrivers(customerId: string | undefined) {
  return useQuery({
    queryKey: driversKey(customerId ?? ''),
    queryFn: () => listDrivers(customerId as string),
    enabled: !!customerId,
  });
}

export function useCreateDriver(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, input }: { agencyId: string; input: DriverInput }) =>
      createDriver(agencyId, customerId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driversKey(customerId) });
    },
  });
}

export function useRemoveDriver(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (driverId: string) => removeDriver(driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driversKey(customerId) });
    },
  });
}
