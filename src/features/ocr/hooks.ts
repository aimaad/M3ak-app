import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useMyAgency } from '@/features/agency/hooks';

import { ocrAvailability, type OcrAvailability } from './availability';
import { NO_OCR_SETTINGS, getOcrSettings, setOcrCloudEnabled, type OcrSettings } from './settings-api';

const key = (agencyId: string | undefined) => ['ocr-settings', agencyId] as const;

/** Réglage OCR de l'entreprise. En cas d'erreur (ex. migration absente), la fonction est considérée comme non active. */
export function useOcrSettings(): { settings: OcrSettings; isLoading: boolean; agencyId: string | undefined; availability: OcrAvailability } {
  const agency = useMyAgency();
  const agencyId = agency.data?.agencyId;
  const query = useQuery({ queryKey: key(agencyId), queryFn: () => getOcrSettings(agencyId as string), enabled: !!agencyId });
  const settings = query.data ?? NO_OCR_SETTINGS;
  const isLoading = agency.isLoading || query.isLoading;
  return { settings, isLoading, agencyId, availability: ocrAvailability(settings, isLoading, agency.data?.role) };
}

export function useSetOcrCloudEnabled(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setOcrCloudEnabled(agencyId as string, enabled),
    onSuccess: (data) => queryClient.setQueryData(key(agencyId), data),
  });
}
