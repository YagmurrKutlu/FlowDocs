import { apiClient } from '../../../shared/api/client';
import type {
  BulkTrashActionResponse,
  PermanentDeleteResponse,
  RestoreTrashDocumentResponse,
  TrashDocumentsParams,
  TrashDocumentsResponse,
  TrashSummaryResponse,
} from '../types/trash.types';

export async function fetchTrashSummary(): Promise<TrashSummaryResponse> {
  const { data } = await apiClient.get<TrashSummaryResponse>('/trash/summary');
  return data;
}

export async function fetchTrashDocuments(
  params: TrashDocumentsParams = {},
): Promise<TrashDocumentsResponse> {
  const { data } = await apiClient.get<TrashDocumentsResponse>('/trash/documents', {
    params,
  });
  return data;
}

export async function restoreTrashDocument(
  documentId: string,
): Promise<RestoreTrashDocumentResponse> {
  const { data } = await apiClient.post<RestoreTrashDocumentResponse>(
    `/trash/documents/${documentId}/restore`,
  );
  return data;
}

export async function permanentlyDeleteDocument(
  documentId: string,
): Promise<PermanentDeleteResponse> {
  const { data } = await apiClient.delete<PermanentDeleteResponse>(
    `/trash/documents/${documentId}/permanent`,
  );
  return data;
}

export async function bulkRestoreTrashDocuments(
  documentIds: string[],
): Promise<BulkTrashActionResponse> {
  const { data } = await apiClient.post<BulkTrashActionResponse>(
    '/trash/documents/bulk-restore',
    { documentIds },
  );
  return data;
}

export async function bulkPermanentDeleteDocuments(
  documentIds: string[],
): Promise<BulkTrashActionResponse> {
  const { data } = await apiClient.post<BulkTrashActionResponse>(
    '/trash/documents/bulk-permanent-delete',
    { documentIds },
  );
  return data;
}
