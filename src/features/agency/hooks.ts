import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session-context';

import { getMyAgencyMembership } from './api';

export function useMyAgency() {
  const { session } = useSession();

  return useQuery({
    queryKey: ['my-agency', session?.user.id],
    queryFn: getMyAgencyMembership,
    enabled: !!session,
  });
}
