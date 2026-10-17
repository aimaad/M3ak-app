import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { saveContractSignatures } from '@/features/signatures/api';
import type { HandwrittenSignature } from '@/features/signatures/signature';

import {
  cancelContract,
  createContract,
  getContract,
  getContractForRental,
  listContracts,
  markReadyToSign,
  recordDeparture,
  recordReturn,
  signContract,
  uploadContractPdf,
} from './api';
import type { ContractCreateInput, DepartContractInput, RetourContractInput } from './types';

const contractsKey = ['contracts'] as const;
const contractKey = (id: string) => ['contracts', id] as const;
const contractForRentalKey = (rentalId: string) => ['contracts', 'rental', rentalId] as const;

export function useContracts() {
  return useQuery({ queryKey: contractsKey, queryFn: listContracts });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: contractKey(id ?? ''),
    queryFn: () => getContract(id as string),
    enabled: !!id,
  });
}

export function useContractForRental(rentalId: string | undefined) {
  return useQuery({
    queryKey: contractForRentalKey(rentalId ?? ''),
    queryFn: () => getContractForRental(rentalId as string),
    enabled: !!rentalId,
  });
}

function useInvalidateContracts() {
  const queryClient = useQueryClient();
  return (contract: { id: string; rentalId: string }) => {
    queryClient.invalidateQueries({ queryKey: contractsKey });
    queryClient.invalidateQueries({ queryKey: contractKey(contract.id) });
    queryClient.invalidateQueries({ queryKey: contractForRentalKey(contract.rentalId) });
  };
}

export function useCreateContract() {
  const invalidate = useInvalidateContracts();

  return useMutation({
    mutationFn: ({
      agencyId,
      input,
      snapshot,
    }: {
      agencyId: string;
      input: ContractCreateInput;
      snapshot: Parameters<typeof createContract>[2];
    }) => createContract(agencyId, input, snapshot),
    onSuccess: (contract) => invalidate(contract),
  });
}

export function useMarkReadyToSign() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (id: string) => markReadyToSign(id),
    onSuccess: (contract) => invalidate(contract),
  });
}

export function useSignContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: async ({
      contract,
      clientSignature,
      agencySignature,
    }: {
      contract: { id: string; agencyId: string };
      clientSignature: HandwrittenSignature;
      agencySignature: HandwrittenSignature | null;
    }) => {
      const paths = await saveContractSignatures(contract.agencyId, contract.id, clientSignature, agencySignature);
      return signContract(contract.id, paths);
    },
    onSuccess: (contract) => invalidate(contract),
  });
}

export function useCancelContract() {
  const invalidate = useInvalidateContracts();
  return useMutation({
    mutationFn: (id: string) => cancelContract(id),
    onSuccess: (contract) => invalidate(contract),
  });
}

export function useRecordDeparture() {
  const invalidate = useInvalidateContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rentalId,
      contractId,
      kmDepart,
      carburantDepart,
      input,
    }: {
      rentalId: string;
      contractId: string;
      kmDepart: number;
      carburantDepart: number;
      input: DepartContractInput;
    }) => recordDeparture(rentalId, contractId, kmDepart, carburantDepart, input),
    onSuccess: (_void, variables) => {
      invalidate({ id: variables.contractId, rentalId: variables.rentalId });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentals', variables.rentalId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useRecordReturn() {
  const invalidate = useInvalidateContracts();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rentalId,
      contractId,
      kmRetour,
      carburantRetour,
      input,
    }: {
      rentalId: string;
      contractId: string;
      kmRetour: number;
      carburantRetour: number;
      input: RetourContractInput;
    }) => recordReturn(rentalId, contractId, kmRetour, carburantRetour, input),
    onSuccess: (_void, variables) => {
      invalidate({ id: variables.contractId, rentalId: variables.rentalId });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['rentals', variables.rentalId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
}

export function useUploadContractPdf() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agencyId, contractId, localUri }: { agencyId: string; contractId: string; localUri: string }) =>
      uploadContractPdf(agencyId, contractId, localUri),
    onSuccess: (_path, variables) => {
      queryClient.invalidateQueries({ queryKey: contractKey(variables.contractId) });
    },
  });
}
