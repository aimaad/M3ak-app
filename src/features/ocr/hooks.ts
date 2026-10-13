import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useMyAgency } from '@/features/agency/hooks';

import { DEVICE_ONLY_OCR_SETTINGS, getOcrSettings, setOcrCloudEnabled, type OcrSettings } from './settings-api';

const key = (agencyId: string | undefined) => ['ocr-settings', agencyId] as const;

/** Réglage OCR de l'entreprise. En cas d'erreur (ex. migration absente), on reste sur la lecture locale. */
export function useOcrSettings(): { settings: OcrSettings; isLoading: boolean; agencyId: string | undefined } {
  const agencyId = useMyAgency().data?.agencyId;
  const query = useQuery({ queryKey: key(agencyId), queryFn: () => getOcrSettings(agencyId as string), enabled: !!agencyId });
  return { settings: query.data ?? DEVICE_ONLY_OCR_SETTINGS, isLoading: query.isLoading, agencyId };
}

export function useSetOcrCloudEnabled(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setOcrCloudEnabled(agencyId as string, enabled),
    onSuccess: (data) => queryClient.setQueryData(key(agencyId), data),
  });
}
