import { Modal } from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { CreateDocumentModal } from '../../documents/components/CreateDocumentModal';
import { FavoriteDocumentCard } from '../components/FavoriteDocumentCard';
import { FavoritesEmptyState } from '../components/FavoritesEmptyState';
import { FavoritesFilters } from '../components/FavoritesFilters';
import { FavoritesHero } from '../components/FavoritesHero';
import { FavoritesSelectionToolbar } from '../components/FavoritesSelectionToolbar';
import { FavoritesSummaryGrid } from '../components/FavoritesSummaryGrid';
import {
  useBulkRemoveFavoritesMutation,
  useFavoritesListQuery,
  useFavoritesSummaryQuery,
} from '../hooks/useFavoritesQueries';
import type { FavoritesSort } from '../types/favorites.types';
import styles from './FavoritesPage.module.css';

export function FavoritesPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [sort, setSort] = useState<FavoritesSort>('recent');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      sort,
      workspaceId: workspaceId ?? undefined,
    }),
    [debouncedSearch, sort, workspaceId],
  );

  const summaryQuery = useFavoritesSummaryQuery();
  const workspaceSourceQuery = useFavoritesListQuery({ sort: 'title' });
  const listQuery = useFavoritesListQuery(filters);
  const bulkRemoveMutation = useBulkRemoveFavoritesMutation();

  const favorites = listQuery.data?.favorites ?? [];
  const totalFavorites = summaryQuery.data?.favoriteCount ?? 0;

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of workspaceSourceQuery.data?.favorites ?? []) {
      const label = item.workspaceName?.trim() || 'Kişisel';
      map.set(item.workspaceId, label);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }, [workspaceSourceQuery.data?.favorites]);

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || workspaceId || sort !== 'recent',
  );

  const isTrulyEmpty =
    !summaryQuery.isLoading &&
    !listQuery.isLoading &&
    totalFavorites === 0 &&
    !hasActiveFilters;

  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, workspaceId, sort]);

  const clearFilters = () => {
    setSearch('');
    setWorkspaceId(null);
    setSort('recent');
  };

  const toggleSelect = (documentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(documentId)) {
        next.delete(documentId);
      } else {
        next.add(documentId);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkRemove = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    void bulkRemoveMutation.mutate(ids, {
      onSuccess: () => {
        notifications.show({
          color: 'green',
          message:
            ids.length === 1
              ? 'Favorilerden çıkarıldı.'
              : `${ids.length} favori listeden çıkarıldı.`,
        });
        clearSelection();
      },
      onError: () => {
        notifications.show({
          color: 'red',
          message: 'Seçili favoriler çıkarılamadı.',
        });
      },
    });
  };

  const showLoading = listQuery.isLoading;
  const showEmptyList = !showLoading && favorites.length === 0;
  const emptyVariant: 'empty' | 'no-results' =
    !hasActiveFilters && totalFavorites === 0 ? 'empty' : 'no-results';

  return (
    <div className={styles.page}>
      <FavoritesHero onNewDocument={openCreate} />

      {!isTrulyEmpty ? (
        <FavoritesSummaryGrid loading={summaryQuery.isLoading} summary={summaryQuery.data} />
      ) : null}

      {!isTrulyEmpty ? (
        <FavoritesFilters
          search={search}
          sort={sort}
          workspaceId={workspaceId}
          workspaceOptions={workspaceOptions}
          resultCount={favorites.length}
          hasActiveFilters={hasActiveFilters}
          onSearchChange={setSearch}
          onSortChange={setSort}
          onWorkspaceChange={setWorkspaceId}
          onClearFilters={clearFilters}
        />
      ) : null}

      {selectedIds.size > 0 ? (
        <FavoritesSelectionToolbar
          selectedCount={selectedIds.size}
          removeLoading={bulkRemoveMutation.isPending}
          onClearSelection={clearSelection}
          onRemoveSelected={handleBulkRemove}
        />
      ) : null}

      {showLoading ? (
        <section className={styles.grid} aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.favCardSkeleton} />
          ))}
        </section>
      ) : showEmptyList ? (
        <FavoritesEmptyState
          variant={emptyVariant}
          onClearFilters={clearFilters}
          onNewDocument={emptyVariant === 'empty' ? openCreate : undefined}
        />
      ) : (
        <section className={styles.grid}>
          {favorites.map((item) => (
            <FavoriteDocumentCard
              key={item.favoriteId}
              item={item}
              selected={selectedIds.has(item.id)}
              removeLoading={
                bulkRemoveMutation.isPending && selectedIds.has(item.id)
              }
              onToggleSelect={toggleSelect}
            />
          ))}
        </section>
      )}

      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Yeni doküman"
        centered
        radius="md"
      >
        <CreateDocumentModal
          opened={createOpened}
          onClose={closeCreate}
          onCreated={() => {
            closeCreate();
          }}
        />
      </Modal>
    </div>
  );
}
