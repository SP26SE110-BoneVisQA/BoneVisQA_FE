'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminFlaggedChunks,
  patchAdminChunkFlagResolution,
} from '@/lib/api/admin-flagged-chunks';
import { queryKeys } from '@/lib/query-keys';

export function useAdminFlaggedChunks() {
  return useQuery({
    queryKey: [...queryKeys.admin.all, 'flagged-chunks'] as const,
    queryFn: fetchAdminFlaggedChunks,
    staleTime: 15_000,
  });
}

export function useResolveFlaggedChunk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chunkId, resolved }: { chunkId: string; resolved: boolean }) =>
      patchAdminChunkFlagResolution(chunkId, { resolved }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.admin.all, 'flagged-chunks'] });
    },
  });
}
