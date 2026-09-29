import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  completeInspection,
  createInspection,
  getInspectionForRental,
  getPhotoSignedUrl,
  listInspectionPhotos,
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
