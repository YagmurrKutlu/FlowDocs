import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addFavorite, removeFavorite } from '../../favorites/api/favorites.api';
import { favoritesQueryKeys } from '../../favorites/hooks/useFavoritesQueries';
import { formatBulkPartialMessage } from '../documents-bulk.utils';
import type { DocumentListItem } from '../types/document.types';
import { invalidateDocumentsRelated } from './useDocumentsQueries';

async function runBulkFavorite(
  documents: DocumentListItem[],
  mode: 'add' | 'remove',
): Promise<{ successCount: number; total: number }> {
  const targets =
    mode === 'add'
      ? documents.filter((doc) => !doc.isFavorite)
      : documents.filter((doc) => doc.isFavorite);

  if (targets.length === 0) {
    return { successCount: 0, total: 0 };
  }

  const results = await Promise.allSettled(
    targets.map((doc) =>
      mode === 'add' ? addFavorite(doc.id) : removeFavorite(doc.id),
    ),
  );

  const successCount = results.filter((r) => r.status === 'fulfilled').length;
  return { successCount, total: targets.length };
}

export function useBulkAddFavoritesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documents: DocumentListItem[]) =>
      runBulkFavorite(documents, 'add'),
    onSuccess: () => {
      invalidateDocumentsRelated(queryClient);
      void queryClient.invalidateQueries({ queryKey: favoritesQueryKeys.summary() });
      void queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    },
  });
}

export function useBulkRemoveFavoritesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documents: DocumentListItem[]) =>
      runBulkFavorite(documents, 'remove'),
    onSuccess: () => {
      invalidateDocumentsRelated(queryClient);
      void queryClient.invalidateQueries({ queryKey: favoritesQueryKeys.summary() });
      void queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    },
  });
}

export { formatBulkPartialMessage };
