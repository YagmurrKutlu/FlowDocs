import { apiClient } from '../../../shared/api/client';
import type {
  SharedByMeParams,
  SharedByMeResponse,
  SharedSummaryResponse,
  SharedWithMeParams,
  SharedWithMeResponse,
} from '../types/shared.types';

export async function fetchSharedWithMe(
  params: SharedWithMeParams,
): Promise<SharedWithMeResponse> {
  const { data } = await apiClient.get<SharedWithMeResponse>('/shared/with-me', {
    params,
  });
  return data;
}

export async function fetchSharedByMe(
  params: SharedByMeParams,
): Promise<SharedByMeResponse> {
  const { data } = await apiClient.get<SharedByMeResponse>('/shared/by-me', {
    params,
  });
  return data;
}

export async function fetchSharedSummary(): Promise<SharedSummaryResponse> {
  const { data } = await apiClient.get<SharedSummaryResponse>('/shared/summary');
  return data;
}

export async function leaveSharedWithMe(
  documentId: string,
): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(
    `/shared/with-me/${documentId}`,
  );
  return data;
}
