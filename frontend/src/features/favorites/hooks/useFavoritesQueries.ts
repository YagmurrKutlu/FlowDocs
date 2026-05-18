import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addFavorite,
  fetchFavorites,
  fetchFavoritesSummary,
  removeFavorite,
} from '../api/favorites.api';
import type {
  FavoritesListParams,
  FavoritesListResponse,
  FavoritesSummaryResponse,
} from '../types/favorites.types';
import { documentsQueryKeys } from '../../documents/hooks/useDocumentsQueries';

export const favoritesQueryKeys = {
  summary: () => ['favorites', 'summary'] as const,
  list: (filters: FavoritesListParams) => ['favorites', 'list', filters] as const,
};

function invalidateFavoriteRelated(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: favoritesQueryKeys.summary() });
  void queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
  void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.list() });
  void queryClient.invalidateQueries({ queryKey: documentsQueryKeys.all });
}

type RemoveFavoriteContext = {
  previousLists: [readonly unknown[], FavoritesListResponse | undefined][];
  previousSummary: FavoritesSummaryResponse | undefined;
};

function optimisticRemoveFavorite(
  queryClient: ReturnType<typeof useQueryClient>,
  documentId: string,
) {
  const previousLists = queryClient.getQueriesData<FavoritesListResponse>({
    queryKey: ['favorites', 'list'],
  });
  const previousSummary = queryClient.getQueryData<FavoritesSummaryResponse>(
    favoritesQueryKeys.summary(),
  );

  queryClient.setQueriesData<FavoritesListResponse>(
    { queryKey: ['favorites', 'list'] },
    (old) => {
      if (!old) return old;
      return {
        favorites: old.favorites.filter((item) => item.id !== documentId),
      };
    },
  );

  if (previousSummary) {
    queryClient.setQueryData<FavoritesSummaryResponse>(favoritesQueryKeys.summary(), {
      ...previousSummary,
      favoriteCount: Math.max(0, previousSummary.favoriteCount - 1),
    });
  }

  return { previousLists, previousSummary };
}

export function useFavoritesSummaryQuery() {
  return useQuery({
    queryKey: favoritesQueryKeys.summary(),
    queryFn: fetchFavoritesSummary,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useFavoritesListQuery(filters: FavoritesListParams) {
  return useQuery({
    queryKey: favoritesQueryKeys.list(filters),
    queryFn: () => fetchFavorites(filters),
  });
}

export function useToggleFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
      isFavorite,
    }: {
      documentId: string;
      isFavorite: boolean;
    }) => {
      if (isFavorite) {
        return removeFavorite(documentId);
      }
      return addFavorite(documentId);
    },
    onSuccess: () => invalidateFavoriteRelated(queryClient),
  });
}

export function useRemoveFavoriteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => removeFavorite(documentId),
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', 'list'] });
      await queryClient.cancelQueries({ queryKey: favoritesQueryKeys.summary() });
      return optimisticRemoveFavorite(queryClient, documentId);
    },
    onError: (_error, _documentId, context: RemoveFavoriteContext | undefined) => {
      context?.previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.previousSummary) {
        queryClient.setQueryData(favoritesQueryKeys.summary(), context.previousSummary);
      }
    },
    onSettled: () => invalidateFavoriteRelated(queryClient),
  });
}

export function useBulkRemoveFavoritesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentIds: string[]) => {
      await Promise.all(documentIds.map((id) => removeFavorite(id)));
    },
    onMutate: async (documentIds) => {
      await queryClient.cancelQueries({ queryKey: ['favorites', 'list'] });
      await queryClient.cancelQueries({ queryKey: favoritesQueryKeys.summary() });

      const previousLists = queryClient.getQueriesData<FavoritesListResponse>({
        queryKey: ['favorites', 'list'],
      });
      const previousSummary = queryClient.getQueryData<FavoritesSummaryResponse>(
        favoritesQueryKeys.summary(),
      );

      const idSet = new Set(documentIds);
      queryClient.setQueriesData<FavoritesListResponse>(
        { queryKey: ['favorites', 'list'] },
        (old) => {
          if (!old) return old;
          return {
            favorites: old.favorites.filter((item) => !idSet.has(item.id)),
          };
        },
      );

      if (previousSummary) {
        queryClient.setQueryData<FavoritesSummaryResponse>(favoritesQueryKeys.summary(), {
          ...previousSummary,
          favoriteCount: Math.max(0, previousSummary.favoriteCount - documentIds.length),
        });
      }

      return { previousLists, previousSummary };
    },
    onError: (_error, _ids, context: RemoveFavoriteContext | undefined) => {
      context?.previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.previousSummary) {
        queryClient.setQueryData(favoritesQueryKeys.summary(), context.previousSummary);
      }
    },
    onSettled: () => invalidateFavoriteRelated(queryClient),
  });
}
