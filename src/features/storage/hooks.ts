import { useQuery } from '@tanstack/react-query';

import { getSignedUrl } from './api';

export function useSignedUrl(bucket: string, path: string | undefined) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    queryFn: () => getSignedUrl(bucket, path as string),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  });
}
