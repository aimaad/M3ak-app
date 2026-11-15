import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createComplianceRecord,
  deleteComplianceRecord,
  getComplianceSettings,
  listAllCompliance,
  listVehicleCompliance,
  saveComplianceSettings,
  updateComplianceRecord,
  uploadComplianceDocument,
  type ComplianceCorrection,
} from './api';
import { DEFAULT_COMPLIANCE_SETTINGS, type ComplianceInput, type ComplianceKind, type ComplianceSettings } from './types';

const complianceKey = ['compliance'] as const;
const vehicleComplianceKey = (vehicleId: string) => ['compliance', 'vehicle', vehicleId] as const;
const settingsKey = (agencyId: string) => ['compliance', 'settings', agencyId] as const;

export function useVehicleCompliance(vehicleId: string | undefined) {
  return useQuery({ queryKey: vehicleComplianceKey(vehicleId ?? ''), queryFn: () => listVehicleCompliance(vehicleId as string), enabled: !!vehicleId });
}

export function useAllCompliance(enabled = true) {
  return useQuery({ queryKey: [...complianceKey, 'all'], queryFn: listAllCompliance, enabled });
}

export function useComplianceSettings(agencyId: string | undefined) {
  const query = useQuery({ queryKey: settingsKey(agencyId ?? ''), queryFn: () => getComplianceSettings(agencyId as string), enabled: !!agencyId });
  return { ...query, settings: query.data ?? DEFAULT_COMPLIANCE_SETTINGS };
}

/** Une période change : la fiche, les listes, et les anciens écrans (documents, échéances d'entretien) que la base remet d'accord. */
function useInvalidate() {
  const queryClient = useQueryClient();
  return (vehicleId: string) => {
    queryClient.invalidateQueries({ queryKey: complianceKey });
    queryClient.invalidateQueries({ queryKey: vehicleComplianceKey(vehicleId) });
    queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    queryClient.invalidateQueries({ queryKey: ['maintenance'] });
  };
}

export function useRenewCompliance() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ agencyId, input, localDocumentUri }: { agencyId: string; input: ComplianceInput; localDocumentUri?: string | null }) => {
      // Photo d'abord : si l'envoi échoue, rien n'est enregistré (pas de période sans son papier alors qu'on l'avait choisi).
      const documentPath = localDocumentUri ? await uploadComplianceDocument(agencyId, input.vehicleId, input.kind, localDocumentUri) : input.documentPath;
      return createComplianceRecord(agencyId, { ...input, documentPath });
    },
    onSuccess: (record) => invalidate(record.vehicleId),
  });
}

export function useCorrectCompliance() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; vehicleId: string; patch: ComplianceCorrection }) => updateComplianceRecord(id, patch),
    onSuccess: (_record, { vehicleId }) => invalidate(vehicleId),
  });
}

export function useDeleteCompliance() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id }: { id: string; vehicleId: string }) => deleteComplianceRecord(id),
    onSuccess: (_void, { vehicleId }) => invalidate(vehicleId),
  });
}

export function useSaveComplianceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agencyId, settings }: { agencyId: string; settings: ComplianceSettings }) => saveComplianceSettings(agencyId, settings),
    onSuccess: (_settings, { agencyId }) => queryClient.invalidateQueries({ queryKey: settingsKey(agencyId) }),
  });
}

export type { ComplianceKind };
