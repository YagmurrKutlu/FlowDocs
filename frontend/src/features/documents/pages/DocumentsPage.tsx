import { Checkbox, Modal } from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreateDocumentModal } from '../components/CreateDocumentModal';
import { CreateWorkspaceModal } from '../../team/components/CreateWorkspaceModal';
import { useCreateWorkspaceModal } from '../../team/hooks/useCreateWorkspaceModal';
import { BulkMoveToTrashModal } from '../components/BulkMoveToTrashModal';
import { DocumentManagementCard } from '../components/DocumentManagementCard';
import { DocumentManagementListView } from '../components/DocumentManagementListView';
import { DocumentsEmptyState } from '../components/DocumentsEmptyState';
import { DocumentsFilters } from '../components/DocumentsFilters';
import { DocumentsHero } from '../components/DocumentsHero';
import { DocumentsSelectionToolbar } from '../components/DocumentsSelectionToolbar';
import { DocumentsSummaryGrid } from '../components/DocumentsSummaryGrid';
import { DocumentsViewTabs } from '../components/DocumentsViewTabs';
import {
  formatBulkPartialMessage,
  useBulkAddFavoritesMutation,
  useBulkRemoveFavoritesMutation,
} from '../hooks/useDocumentsBulkFavorites';
import { useDocumentsViewMode } from '../hooks/useDocumentsViewMode';
import {
  useBulkMoveToTrashMutation,
  useDocumentsListQuery,
  useDocumentsSummaryQuery,
} from '../hooks/useDocumentsQueries';
import type {
  DocumentsListParams,
  DocumentsRoleFilter,
  DocumentsSort,
  DocumentsView,
} from '../types/document.types';
import styles from './DocumentsPage.module.css';

const VIEW_VALUES: DocumentsView[] = [
  'all',
  'owned',
  'shared',
  'recent',
  'favorites',
];

function parseView(value: string | null): DocumentsView {
  if (value && VIEW_VALUES.includes(value as DocumentsView)) {
    return value as DocumentsView;
  }
  return 'all';
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { viewMode, setViewMode } = useDocumentsViewMode();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [sort, setSort] = useState<DocumentsSort>('updated');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<DocumentsRoleFilter>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const createWorkspaceModal = useCreateWorkspaceModal();
  const [bulkTrashOpened, { open: openBulkTrash, close: closeBulkTrash }] =
    useDisclosure(false);

  const activeView = parseView(searchParams.get('view'));

  const setActiveView = (view: DocumentsView) => {
    const next = new URLSearchParams(searchParams);
    if (view === 'all') {
      next.delete('view');
    } else {
      next.set('view', view);
    }
    setSearchParams(next, { replace: true });
  };

  const listFilters = useMemo<DocumentsListParams>(
    () => ({
      search: debouncedSearch.trim() || undefined,
      sort,
      workspaceId: workspaceId ?? undefined,
      role: role || undefined,
      view: activeView,
      take: 500,
    }),
    [debouncedSearch, sort, workspaceId, role, activeView],
  );

  const workspaceSourceFilters = useMemo<DocumentsListParams>(
    () => ({ view: 'all', take: 500, sort: 'title' }),
    [],
  );

  const summaryQuery = useDocumentsSummaryQuery();
  const listQuery = useDocumentsListQuery(listFilters);
  const workspaceSourceQuery = useDocumentsListQuery(workspaceSourceFilters);
  const bulkAddFavorites = useBulkAddFavoritesMutation();
  const bulkRemoveFavorites = useBulkRemoveFavoritesMutation();
  const bulkTrashMutation = useBulkMoveToTrashMutation();

  const summary = summaryQuery.data;
  const documents = listQuery.data?.documents ?? [];

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of workspaceSourceQuery.data?.documents ?? []) {
      const label = doc.workspaceName?.trim() || 'Kişisel';
      map.set(doc.workspaceId, label);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }, [workspaceSourceQuery.data?.documents]);

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || workspaceId || role || sort !== 'updated',
  );

  const selectedDocuments = useMemo(
    () => documents.filter((doc) => selectedIds.has(doc.id)),
    [documents, selectedIds],
  );

  const deletableCount = selectedDocuments.filter((doc) => doc.canDelete).length;
  const allSelected =
    documents.length > 0 && documents.every((doc) => selectedIds.has(doc.id));

  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, workspaceId, role, sort, activeView]);

  const clearFilters = () => {
    setSearch('');
    setWorkspaceId(null);
    setRole('');
    setSort('updated');
  };

  const clearSelection = () => setSelectedIds(new Set());

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

  const toggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedIds(new Set(documents.map((doc) => doc.id)));
    }
  };

  const handleBulkAddFavorites = () => {
    void bulkAddFavorites.mutate(selectedDocuments, {
      onSuccess: ({ successCount, total }) => {
        if (total === 0) {
          notifications.show({ color: 'blue', message: 'Seçili dokümanlar zaten favoride.' });
          return;
        }
        notifications.show({
          color: successCount === total ? 'green' : 'orange',
          message: formatBulkPartialMessage(
            total,
            successCount,
            'favorilere eklendi',
          ),
        });
        if (successCount > 0) clearSelection();
      },
      onError: () => {
        notifications.show({ color: 'red', message: 'Favorilere eklenemedi.' });
      },
    });
  };

  const handleBulkRemoveFavorites = () => {
    void bulkRemoveFavorites.mutate(selectedDocuments, {
      onSuccess: ({ successCount, total }) => {
        if (total === 0) {
          notifications.show({
            color: 'blue',
            message: 'Seçili dokümanlar zaten favoride değil.',
          });
          return;
        }
        notifications.show({
          color: successCount === total ? 'green' : 'orange',
          message: formatBulkPartialMessage(
            total,
            successCount,
            'favorilerden çıkarıldı',
          ),
        });
        if (successCount > 0) clearSelection();
      },
      onError: () => {
        notifications.show({ color: 'red', message: 'Favorilerden çıkarılamadı.' });
      },
    });
  };

  const handleBulkTrash = () => {
    const ids = selectedDocuments
      .filter((doc) => doc.canDelete)
      .map((doc) => doc.id);
    if (ids.length === 0) {
      notifications.show({
        color: 'orange',
        message: 'Seçili dokümanların hiçbiri çöp kutusuna taşınamaz.',
      });
      return;
    }

    void bulkTrashMutation.mutate(ids, {
      onSuccess: (result) => {
        const successCount = result.movedCount;
        notifications.show({
          color: result.failedCount === 0 ? 'green' : 'orange',
          message: formatBulkPartialMessage(
            ids.length,
            successCount,
            'çöp kutusuna taşındı',
          ),
        });
        closeBulkTrash();
        clearSelection();
      },
      onError: () => {
        notifications.show({
          color: 'red',
          message: 'Çöp kutusuna taşıma başarısız.',
        });
      },
    });
  };

  const emptyVariant: 'empty' | 'no-results' =
    (summary?.totalDocuments ?? 0) === 0 ? 'empty' : 'no-results';

  const showEmptyList = !listQuery.isLoading && documents.length === 0;
  const favoriteBulkLoading =
    bulkAddFavorites.isPending || bulkRemoveFavorites.isPending;

  return (
    <div className={styles.page}>
      <DocumentsHero
        onNewWorkspace={createWorkspaceModal.open}
        onNewDocument={openCreate}
      />
      {summary && summary.recentlyUpdated > 0 ? (
        <p className={styles.recentPill}>
          Son 7 gün güncellenen: {summary.recentlyUpdated}
        </p>
      ) : null}
      <DocumentsSummaryGrid loading={summaryQuery.isLoading} summary={summary} />
      <DocumentsViewTabs
        activeView={activeView}
        summary={summary}
        onChange={setActiveView}
      />
      <DocumentsFilters
        search={search}
        sort={sort}
        workspaceId={workspaceId}
        role={role}
        workspaceOptions={workspaceOptions}
        resultCount={documents.length}
        hasActiveFilters={hasActiveFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearchChange={setSearch}
        onSortChange={setSort}
        onWorkspaceChange={setWorkspaceId}
        onRoleChange={setRole}
        onClearFilters={clearFilters}
      />

      {selectedIds.size > 0 ? (
        <DocumentsSelectionToolbar
          selectedCount={selectedIds.size}
          deletableCount={deletableCount}
          favoriteLoading={favoriteBulkLoading}
          trashLoading={bulkTrashMutation.isPending}
          onClearSelection={clearSelection}
          onAddFavorites={handleBulkAddFavorites}
          onRemoveFavorites={handleBulkRemoveFavorites}
          onMoveToTrash={openBulkTrash}
        />
      ) : null}

      {!showEmptyList && documents.length > 0 ? (
        <div className={styles.selectAllBar}>
          <Checkbox
            checked={allSelected}
            indeterminate={selectedIds.size > 0 && !allSelected}
            label="Tümünü seç"
            onChange={toggleSelectAll}
          />
        </div>
      ) : null}

      {listQuery.isLoading ? (
        <section
          className={viewMode === 'grid' ? styles.grid : styles.listSkeleton}
          aria-busy="true"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={
                viewMode === 'grid' ? styles.cardSkeleton : styles.listRowSkeleton
              }
            />
          ))}
        </section>
      ) : showEmptyList ? (
        <DocumentsEmptyState
          variant={emptyVariant}
          onNewDocument={openCreate}
          onClearFilters={clearFilters}
        />
      ) : viewMode === 'list' ? (
        <DocumentManagementListView
          documents={documents}
          selectedIds={selectedIds}
          allSelected={allSelected}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      ) : (
        <section className={styles.grid}>
          {documents.map((doc) => (
            <DocumentManagementCard
              key={doc.id}
              document={doc}
              selected={selectedIds.has(doc.id)}
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
          onCreated={(id) => {
            closeCreate();
            navigate(`/documents/${id}`);
          }}
        />
      </Modal>

      <BulkMoveToTrashModal
        opened={bulkTrashOpened}
        selectedCount={selectedIds.size}
        deletableCount={deletableCount}
        loading={bulkTrashMutation.isPending}
        onClose={closeBulkTrash}
        onConfirm={handleBulkTrash}
      />

      <CreateWorkspaceModal
        opened={createWorkspaceModal.opened}
        loading={createWorkspaceModal.isPending}
        onClose={createWorkspaceModal.close}
        onSubmit={createWorkspaceModal.handleSubmit}
      />
    </div>
  );
}
