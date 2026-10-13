import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archiveCustomer,
  createCustomer,
  createDriver,
  ensureCustomerDriver,
  getCustomer,
  listAllDrivers,
  listCustomers,
  listDrivers,
  reactivateCustomer,
  removeDriver,
  setCustomerConsent,
  updateCustomer,
} from './api';
import {
  addDocument,
  deleteDocument,
  listOwnerDocuments,
  replaceDocumentFile,
  updateDocument,
  type DocumentOwner,
} from './documents-api';
import {
  addCustomerNote,
  deleteCustomerNote,
  listCustomerNotes,
  listNoteRevisions,
  updateCustomerNote,
} from './notes-api';
import type { Customer, CustomerDocument, CustomerInput, DocumentInput, DriverInput } from './types';

const customersKey = ['customers'] as const;
const customerKey = (id: string) => ['customers', id] as const;
const driversKey = (customerId: string) => ['drivers', customerId] as const;
const allDriversKey = ['drivers', 'all'] as const;

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
      queryClient.invalidateQueries({ queryKey: allDriversKey });
    },
  });
}

export function useRemoveDriver(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (driverId: string) => removeDriver(driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driversKey(customerId) });
      queryClient.invalidateQueries({ queryKey: allDriversKey });
    },
  });
}

export function useAllDrivers() {
  return useQuery({ queryKey: allDriversKey, queryFn: listAllDrivers });
}

export function useEnsureCustomerDriver() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (customerId: string) => ensureCustomerDriver(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: allDriversKey });
    },
  });
}

// ----------------------------------------------------------------------
// Documents (client ou conducteur)
// ----------------------------------------------------------------------

const documentsKey = (owner: DocumentOwner) => ['customer-documents', owner.kind, owner.id] as const;

function invalidateDocuments(queryClient: ReturnType<typeof useQueryClient>, owner: DocumentOwner) {
  queryClient.invalidateQueries({ queryKey: documentsKey(owner) });
  // La fiche client et la liste embarquent aussi les documents (alertes, recherche, filtres).
  queryClient.invalidateQueries({ queryKey: customersKey });
  // La liste de contrôle de départ dépend des documents.
  queryClient.invalidateQueries({ queryKey: ['departure-check'] });
}

export function useOwnerDocuments(owner: DocumentOwner | undefined) {
  return useQuery({
    queryKey: owner ? documentsKey(owner) : ['customer-documents', 'none'],
    queryFn: () => listOwnerDocuments(owner as DocumentOwner),
    enabled: !!owner,
  });
}

export function useAddDocument(owner: DocumentOwner) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, input, localUri }: { agencyId: string; input: DocumentInput; localUri: string | null }) =>
      addDocument(agencyId, owner, input, localUri),
    onSuccess: () => invalidateDocuments(queryClient, owner),
  });
}

export function useUpdateDocument(owner: DocumentOwner) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DocumentInput }) => updateDocument(id, input),
    onSuccess: () => invalidateDocuments(queryClient, owner),
  });
}

export function useReplaceDocumentFile(owner: DocumentOwner) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agencyId,
      doc,
      localUri,
    }: {
      agencyId: string;
      doc: Pick<CustomerDocument, 'id' | 'type' | 'path'>;
      localUri: string;
    }) => replaceDocumentFile(agencyId, owner, doc, localUri),
    onSuccess: () => invalidateDocuments(queryClient, owner),
  });
}

export function useDeleteDocument(owner: DocumentOwner) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (doc: Pick<CustomerDocument, 'id' | 'path'>) => deleteDocument(doc),
    onSuccess: () => invalidateDocuments(queryClient, owner),
  });
}

// ----------------------------------------------------------------------
// Notes internes
// ----------------------------------------------------------------------

const notesKey = (customerId: string) => ['customer-notes', customerId] as const;

export function useCustomerNotes(customerId: string | undefined) {
  return useQuery({
    queryKey: notesKey(customerId ?? ''),
    queryFn: () => listCustomerNotes(customerId as string),
    enabled: !!customerId,
  });
}

export function useAddCustomerNote(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agencyId, body }: { agencyId: string; body: string }) => addCustomerNote(agencyId, customerId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey(customerId) }),
  });
}

export function useUpdateCustomerNote(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => updateCustomerNote(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notesKey(customerId) });
      queryClient.invalidateQueries({ queryKey: ['customer-note-revisions'] });
    },
  });
}

export function useDeleteCustomerNote(customerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCustomerNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey(customerId) }),
  });
}

export function useNoteRevisions(noteId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-note-revisions', noteId],
    queryFn: () => listNoteRevisions(noteId as string),
    enabled: !!noteId && enabled,
  });
}
