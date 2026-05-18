import { Button, Checkbox } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../../shared/api/errors';
import { DeletedDocumentCard } from '../components/DeletedDocumentCard';
import { PermanentDeleteModal } from '../components/PermanentDeleteModal';
import { RestoreConfirmModal } from '../components/RestoreConfirmModal';
import { TrashEmptyState } from '../components/TrashEmptyState';
import { TrashFilters } from '../components/TrashFilters';
import { TrashHero } from '../components/TrashHero';
import { TrashSelectionToolbar } from '../components/TrashSelectionToolbar';
import { TrashDocumentCardSkeleton } from '../components/TrashDocumentCardSkeleton';
import { TrashSummaryGrid } from '../components/TrashSummaryGrid';
import {
  notifyBulkPermanentDeleteResult,
  notifyBulkRestoreResult,
} from '../utils/trash-bulk-notify';
import {
  useBulkPermanentDeleteTrashMutation,
  useBulkRestoreTrashMutation,
  usePermanentDeleteTrashDocumentMutation,
  useRestoreTrashDocumentMutation,
  useTrashDocumentsQuery,
  useTrashSummaryQuery,
} from '../hooks/useTrashQueries';
import type { TrashDocumentItem, TrashDocumentSort } from '../types/trash.types';
import styles from './TrashPage.module.css';

type PendingRestore =
  | { mode: 'single'; document: TrashDocumentItem }
  | { mode: 'bulk'; documentIds: string[] }
  | null;

type PendingDelete =
  | { mode: 'single'; document: TrashDocumentItem }
  | { mode: 'bulk'; documentIds: string[] }
  | null;

export function TrashPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [sort, setSort] = useState<TrashDocumentSort>('newest');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingRestore, setPendingRestore] = useState<PendingRestore>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const filters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      sort,
      workspaceId: workspaceId ?? undefined,
    }),
    [debouncedSearch, sort, workspaceId],
  );

  const summaryQuery = useTrashSummaryQuery();
  const workspaceSourceQuery = useTrashDocumentsQuery({ sort: 'title' });
  const documentsQuery = useTrashDocumentsQuery(filters);
  const restoreMutation = useRestoreTrashDocumentMutation();
  const permanentDeleteMutation = usePermanentDeleteTrashDocumentMutation();
  const bulkRestoreMutation = useBulkRestoreTrashMutation();
  const bulkPermanentDeleteMutation = useBulkPermanentDeleteTrashMutation();

  const documents = documentsQuery.data?.documents ?? [];
  const totalInTrash = summaryQuery.data?.deletedDocumentCount ?? 0;

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of workspaceSourceQuery.data?.documents ?? []) {
      map.set(doc.workspaceId, doc.workspaceName);
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }, [workspaceSourceQuery.data?.documents]);

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() || workspaceId || sort !== 'newest',
  );

  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, workspaceId, sort]);

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

  const allSelected =
    documents.length > 0 && documents.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(documents.map((d) => d.id)));
  };

  const clearFilters = () => {
    setSearch('');
    setSort('newest');
    setWorkspaceId(null);
  };

  const closeRestoreModal = () => setPendingRestore(null);
  const closeDeleteModal = () => {
    setPendingDelete(null);
    setDeleteConfirmText('');
  };

  const handleRestoreConfirm = async () => {
    if (!pendingRestore) return;
    try {
      if (pendingRestore.mode === 'single') {
        const result = await restoreMutation.mutateAsync(
          pendingRestore.document.id,
        );
        notifications.show({
          color: 'green',
          message: result.message,
        });
      } else {
        const total = pendingRestore.documentIds.length;
        const result = await bulkRestoreMutation.mutateAsync(
          pendingRestore.documentIds,
        );
        notifyBulkRestoreResult(result, total);
      }
      setSelectedIds(new Set());
      closeRestoreModal();
    } catch (error) {
      notifications.show({
        color: 'red',
        message: getApiErrorMessage(error),
      });
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.mode === 'single') {
        const result = await permanentDeleteMutation.mutateAsync(
          pendingDelete.document.id,
        );
        notifications.show({
          color: 'green',
          message: result.message,
        });
      } else {
        const total = pendingDelete.documentIds.length;
        const result = await bulkPermanentDeleteMutation.mutateAsync(
          pendingDelete.documentIds,
        );
        notifyBulkPermanentDeleteResult(result, total);
      }
      setSelectedIds(new Set());
      closeDeleteModal();
    } catch (error) {
      notifications.show({
        color: 'red',
        message: getApiErrorMessage(error),
      });
    }
  };

  const isRestoring =
    restoreMutation.isPending || bulkRestoreMutation.isPending;
  const isDeleting =
    permanentDeleteMutation.isPending || bulkPermanentDeleteMutation.isPending;

  const showEmptyTrash =
    !documentsQuery.isLoading &&
    !documentsQuery.isError &&
    totalInTrash === 0 &&
    !hasActiveFilters;

  const showNoResults =
    !documentsQuery.isLoading &&
    !documentsQuery.isError &&
    documents.length === 0 &&
    !showEmptyTrash;

  return (
    <main className={styles.page}>
      <TrashHero
        selectedCount={selectedIds.size}
        bulkRestoreLoading={bulkRestoreMutation.isPending}
        bulkDeleteLoading={bulkPermanentDeleteMutation.isPending}
        onBulkRestore={() => {
          if (selectedIds.size === 0) return;
          setPendingRestore({
            mode: 'bulk',
            documentIds: Array.from(selectedIds),
          });
        }}
        onBulkPermanentDelete={() => {
          if (selectedIds.size === 0) return;
          setPendingDelete({
            mode: 'bulk',
            documentIds: Array.from(selectedIds),
          });
        }}
      />

      <TrashSummaryGrid
        loading={summaryQuery.isLoading}
        summary={summaryQuery.data}
      />

      {selectedIds.size > 0 ? (
        <TrashSelectionToolbar
          selectedCount={selectedIds.size}
          restoreLoading={bulkRestoreMutation.isPending}
          deleteLoading={bulkPermanentDeleteMutation.isPending}
          onClearSelection={() => setSelectedIds(new Set())}
          onRestore={() =>
            setPendingRestore({
              mode: 'bulk',
              documentIds: Array.from(selectedIds),
            })
          }
          onPermanentDelete={() =>
            setPendingDelete({
              mode: 'bulk',
              documentIds: Array.from(selectedIds),
            })
          }
        />
      ) : (
        <TrashFilters
          search={search}
          sort={sort}
          workspaceId={workspaceId}
          workspaceOptions={workspaceOptions}
          resultCount={documents.length}
          hasActiveFilters={hasActiveFilters}
          onSearchChange={setSearch}
          onSortChange={setSort}
          onWorkspaceChange={setWorkspaceId}
          onClearFilters={clearFilters}
        />
      )}

      {documentsQuery.isError ? (
        <section className={styles.errorPanel}>
          <h2 className={styles.errorTitle}>Çöp kutusu yüklenemedi</h2>
          <p className={styles.errorDescription}>
            {getApiErrorMessage(documentsQuery.error)}
          </p>
          <Button
            variant="light"
            color="violet"
            onClick={() => void documentsQuery.refetch()}
          >
            Yeniden dene
          </Button>
        </section>
      ) : null}

      {documentsQuery.isLoading ? (
        <div className={styles.list}>
          {[0, 1, 2].map((i) => (
            <TrashDocumentCardSkeleton key={i} />
          ))}
        </div>
      ) : null}

      {showEmptyTrash ? <TrashEmptyState variant="empty" /> : null}
      {showNoResults ? (
        <TrashEmptyState variant="no-results" onClearFilters={clearFilters} />
      ) : null}

      {!documentsQuery.isLoading &&
      !documentsQuery.isError &&
      documents.length > 0 ? (
        <>
          <div className={styles.listHeader}>
            <div className={styles.selectAllRow}>
              <Checkbox
                checked={allSelected}
                indeterminate={selectedIds.size > 0 && !allSelected}
                onChange={toggleSelectAll}
                label="Tümünü seç"
              />
            </div>
          </div>
          <div className={styles.list}>
            {documents.map((doc) => (
              <DeletedDocumentCard
                key={doc.id}
                document={doc}
                selected={selectedIds.has(doc.id)}
                restoreLoading={
                  restoreMutation.isPending &&
                  restoreMutation.variables === doc.id
                }
                deleteLoading={
                  permanentDeleteMutation.isPending &&
                  permanentDeleteMutation.variables === doc.id
                }
                onToggleSelect={toggleSelect}
                onRestore={(document) =>
                  setPendingRestore({ mode: 'single', document })
                }
                onPermanentDelete={(document) =>
                  setPendingDelete({ mode: 'single', document })
                }
              />
            ))}
          </div>
        </>
      ) : null}

      <RestoreConfirmModal
        opened={pendingRestore !== null}
        mode={pendingRestore?.mode ?? 'single'}
        document={
          pendingRestore?.mode === 'single' ? pendingRestore.document : undefined
        }
        count={
          pendingRestore?.mode === 'bulk'
            ? pendingRestore.documentIds.length
            : undefined
        }
        loading={isRestoring}
        onClose={closeRestoreModal}
        onConfirm={() => void handleRestoreConfirm()}
      />

      <PermanentDeleteModal
        opened={pendingDelete !== null}
        mode={pendingDelete?.mode ?? 'single'}
        titleText={
          pendingDelete?.mode === 'single'
            ? pendingDelete.document.title
            : undefined
        }
        count={
          pendingDelete?.mode === 'bulk'
            ? pendingDelete.documentIds.length
            : undefined
        }
        loading={isDeleting}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        onClose={closeDeleteModal}
        onConfirm={() => void handlePermanentDeleteConfirm()}
      />
    </main>
  );
}
