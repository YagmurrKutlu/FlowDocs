import { apiClient } from '../../../shared/api/client';
import type {
  FavoriteActionResponse,
  FavoritesListParams,
  FavoritesListResponse,
  FavoritesSummaryResponse,
} from '../types/favorites.types';

export async function fetchFavorites(
  params: FavoritesListParams = {},
): Promise<FavoritesListResponse> {
  const { data } = await apiClient.get<FavoritesListResponse>('/favorites', {
    params,
  });
  return data;
}

export async function fetchFavoritesSummary(): Promise<FavoritesSummaryResponse> {
  const { data } = await apiClient.get<FavoritesSummaryResponse>(
    '/favorites/summary',
  );
  return data;
}

export async function addFavorite(
  documentId: string,
): Promise<FavoriteActionResponse> {
  const { data } = await apiClient.post<FavoriteActionResponse>(
    `/favorites/${documentId}`,
  );
  return data;
}

export async function removeFavorite(
  documentId: string,
): Promise<FavoriteActionResponse> {
  const { data } = await apiClient.delete<FavoriteActionResponse>(
    `/favorites/${documentId}`,
  );
  return data;
}
