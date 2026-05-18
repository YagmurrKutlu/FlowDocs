import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchSharedByMe,
  fetchSharedSummary,
  fetchSharedWithMe,
  leaveSharedWithMe,
} from '../api/shared.api';
import { documentsQueryKeys } from '../../documents/hooks/useDocumentsQueries';
import type { SharedByMeParams, SharedWithMeParams } from '../types/shared.types';

export const sharedQueryKeys = {
  summary: () => ['shared', 'summary'] as const,
  withMe: (filters: SharedWithMeParams) => ['shared', 'with-me', filters] as const,
  byMe: (filters: SharedByMeParams) => ['shared', 'by-me', filters] as const,
};

export function useSharedSummaryQuery() {
  return useQuery({
    queryKey: sharedQueryKeys.summary(),
    queryFn: fetchSharedSummary,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useSharedWithMeQuery(filters: SharedWithMeParams) {
  return useQuery({
    queryKey: sharedQueryKeys.withMe(filters),
    queryFn: () => fetchSharedWithMe(filters),
  });
}

export function useSharedByMeQuery(filters: SharedByMeParams) {
  return useQuery({
    queryKey: sharedQueryKeys.byMe(filters),
    queryFn: () => fetchSharedByMe(filters),
  });
}

function invalidateSharedRelated(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['shared'] });
  void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.list() });
  void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.all });
}

export function useLeaveSharedWithMeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => leaveSharedWithMe(documentId),
    onSuccess: () => invalidateSharedRelated(queryClient),
  });
}
