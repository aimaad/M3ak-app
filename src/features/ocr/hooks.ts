import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useMyAgency } from '@/features/agency/hooks';

import { chatAvailability, insightsAvailability, ocrAvailability, type ChatAvailability, type InsightsAvailability, type OcrAvailability } from './availability';
import { NO_OCR_SETTINGS, getOcrSettings, setAiChatEnabled, setAiInsightsEnabled, setOcrCloudEnabled, type OcrSettings } from './settings-api';

const key = (agencyId: string | undefined) => ['ocr-settings', agencyId] as const;

/** Réglage OCR de l'entreprise. En cas d'erreur (ex. migration absente), la fonction est considérée comme non active. */
export function useOcrSettings(): {
  settings: OcrSettings;
  isLoading: boolean;
  agencyId: string | undefined;
  availability: OcrAvailability;
  insightsAvailability: InsightsAvailability;
  chatAvailability: ChatAvailability;
} {
  const agency = useMyAgency();
  const agencyId = agency.data?.agencyId;
  const query = useQuery({ queryKey: key(agencyId), queryFn: () => getOcrSettings(agencyId as string), enabled: !!agencyId });
  const settings = query.data ?? NO_OCR_SETTINGS;
  const isLoading = agency.isLoading || query.isLoading;
  return {
    settings,
    isLoading,
    agencyId,
    availability: ocrAvailability(settings, isLoading, agency.data?.role),
    insightsAvailability: insightsAvailability(settings, isLoading, agency.data?.role),
    chatAvailability: chatAvailability(settings, isLoading, agency.data?.role),
  };
}

export function useSetOcrCloudEnabled(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setOcrCloudEnabled(agencyId as string, enabled),
    onSuccess: (data) => queryClient.setQueryData(key(agencyId), data),
  });
}

export function useSetAiInsightsEnabled(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setAiInsightsEnabled(agencyId as string, enabled),
    onSuccess: (data) => queryClient.setQueryData(key(agencyId), data),
  });
}

export function useSetAiChatEnabled(agencyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => setAiChatEnabled(agencyId as string, enabled),
    onSuccess: (data) => queryClient.setQueryData(key(agencyId), data),
  });
}
