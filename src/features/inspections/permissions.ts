import { useMyAgency } from '@/features/agency/hooks';
import type { AgencyRole } from '@/features/agency/types';
import type { DeparturePolicy } from '@/features/rentals/departure-check';
import { useDeparturePolicy } from '@/features/rentals/hooks';

/**
 * Ce que l'employé a le droit de faire : ignorer la prise de photos, refuser l'analyse de M3ak.
 * Le propriétaire en décide (politique de l'agence) ; le gérant et le propriétaire peuvent toujours. Le serveur applique la même règle.
 */
export function inspectionPermissions(
  policy: Pick<DeparturePolicy, 'allowSkipInspection' | 'allowDeclineAi'>,
  role: AgencyRole | null | undefined
): { canSkip: boolean; canDecline: boolean } {
  const privileged = role === 'owner' || role === 'manager';
  return { canSkip: privileged || policy.allowSkipInspection, canDecline: privileged || policy.allowDeclineAi };
}

export function useInspectionPermissions(agencyId: string | undefined) {
  const agency = useMyAgency();
  const policy = useDeparturePolicy(agencyId);
  return inspectionPermissions(policy.data ?? { allowSkipInspection: true, allowDeclineAi: true }, agency.data?.role);
}
