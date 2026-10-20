import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { analyzeInspection } from './analysis-api';
import {
  completeInspection,
  createInspection,
  createManualDamage,
  declineAnalysis,
  resumeInspection,
  skipInspection,
  getInspectionForRental,
  getPhotoSignedUrl,
  listDamages,
  listInspectionPhotos,
  updateDamage,
  type DamagePatch,
  type ManualDamageInput,
} from './api';
import type { InspectionType } from './types';

const inspectionKey = (rentalId: string, type: InspectionType) =>
  ['inspection', rentalId, type] as const;
const photosKey = (inspectionId: string) => ['inspection-photos', inspectionId] as const;

export function useInspectionForRental(rentalId: string | undefined, type: InspectionType) {
  return useQuery({
    queryKey: inspectionKey(rentalId ?? '', type),
    queryFn: () => getInspectionForRental(rentalId as string, type),
    enabled: !!rentalId,
  });
}

export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      agencyId,
      rentalId,
      vehicleId,
      type,
    }: {
      agencyId: string;
      rentalId: string;
      vehicleId: string;
      type: InspectionType;
    }) => createInspection(agencyId, rentalId, vehicleId, type),
    onSuccess: (inspection) => {
      queryClient.invalidateQueries({ queryKey: inspectionKey(inspection.rentalId, inspection.type) });
    },
  });
}

export function useCompleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => completeInspection(id),
    onSuccess: (inspection) => {
      queryClient.invalidateQueries({ queryKey: inspectionKey(inspection.rentalId, inspection.type) });
    },
  });
}

export function useInspectionPhotos(inspectionId: string | undefined) {
  return useQuery({
    queryKey: photosKey(inspectionId ?? ''),
    queryFn: () => listInspectionPhotos(inspectionId as string),
    enabled: !!inspectionId,
  });
}

export function usePhotoSignedUrl(path: string | undefined) {
  return useQuery({
    queryKey: ['inspection-photo-url', path],
    queryFn: () => getPhotoSignedUrl(path as string),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  });
}

const damagesKey = (inspectionId: string) => ['inspection-damages', inspectionId] as const;

export function useInspectionDamages(inspectionId: string | undefined) {
  return useQuery({
    queryKey: damagesKey(inspectionId ?? ''),
    queryFn: () => listDamages(inspectionId as string),
    enabled: !!inspectionId,
  });
}

export function useAnalyzeInspection(rentalId: string, type: InspectionType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inspectionId: string) => analyzeInspection(inspectionId),
    onSettled: (_data, _error, inspectionId) => {
      queryClient.invalidateQueries({ queryKey: damagesKey(inspectionId) });
      queryClient.invalidateQueries({ queryKey: inspectionKey(rentalId, type) });
    },
  });
}

export function useUpdateDamage(inspectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DamagePatch }) => updateDamage(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: damagesKey(inspectionId) }),
  });
}

export function useCreateManualDamage(inspectionId: string, agencyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualDamageInput) => createManualDamage(agencyId, inspectionId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: damagesKey(inspectionId) }),
  });
}

export function useSkipInspection(rentalId: string, type: InspectionType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agencyId, vehicleId }: { agencyId: string; vehicleId: string }) => skipInspection(agencyId, rentalId, vehicleId, type),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inspectionKey(rentalId, type) }),
  });
}

export function useResumeInspection(rentalId: string, type: InspectionType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resumeInspection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inspectionKey(rentalId, type) }),
  });
}

export function useDeclineAnalysis(rentalId: string, type: InspectionType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => declineAnalysis(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inspectionKey(rentalId, type) }),
  });
}
