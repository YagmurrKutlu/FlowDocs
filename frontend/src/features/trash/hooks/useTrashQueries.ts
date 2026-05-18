import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bulkPermanentDeleteDocuments,
  bulkRestoreTrashDocuments,
  fetchTrashDocuments,
  fetchTrashSummary,
  permanentlyDeleteDocument,
  restoreTrashDocument,
} from '../api/trash.api';
import type { TrashDocumentsParams } from '../types/trash.types';
import { documentsQueryKeys } from '../../documents/hooks/useDocumentsQueries';
import { teamQueryKeys } from '../../team/hooks/useTeamQueries';

export const trashQueryKeys = {
  summary: () => ['trash', 'summary'] as const,
  documents: (filters: TrashDocumentsParams) =>
    ['trash', 'documents', filters] as const,
};

function invalidateTrashRelated(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: trashQueryKeys.summary() });
  void queryClient.invalidateQueries({ queryKey: ['trash', 'documents'] });
  void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.list() });
  void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.all });
  void queryClient.invalidateQueries({ queryKey: teamQueryKeys.overview() });
  void queryClient.invalidateQueries({ queryKey: ['team'] });
  void queryClient.invalidateQueries({ queryKey: ['profile'] });
}

const TRASH_SUMMARY_STALE_MS = 5 * 60 * 1000;

export function useTrashSummaryQuery() {
  return useQuery({
    queryKey: trashQueryKeys.summary(),
    queryFn: fetchTrashSummary,
    staleTime: TRASH_SUMMARY_STALE_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

export function useTrashDocumentsQuery(filters: TrashDocumentsParams) {
  return useQuery({
    queryKey: trashQueryKeys.documents(filters),
    queryFn: () => fetchTrashDocuments(filters),
  });
}

export function useRestoreTrashDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => restoreTrashDocument(documentId),
    onSuccess: () => invalidateTrashRelated(queryClient),
  });
}

export function usePermanentDeleteTrashDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => permanentlyDeleteDocument(documentId),
    onSuccess: () => invalidateTrashRelated(queryClient),
  });
}

export function useBulkRestoreTrashMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentIds: string[]) => bulkRestoreTrashDocuments(documentIds),
    onSuccess: () => invalidateTrashRelated(queryClient),
  });
}

export function useBulkPermanentDeleteTrashMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentIds: string[]) =>
      bulkPermanentDeleteDocuments(documentIds),
    onSuccess: () => invalidateTrashRelated(queryClient),
  });
}
