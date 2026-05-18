import { Modal } from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { useEffect, useMemo, useState } from 'react';
import { CreateDocumentModal } from '../../documents/components/CreateDocumentModal';
import { SharedByMeCard } from '../components/SharedByMeCard';
import { SharedEmptyState } from '../components/SharedEmptyState';
import { SharedFilters } from '../components/SharedFilters';
import { SharedHero } from '../components/SharedHero';
import { SharedSummaryGrid } from '../components/SharedSummaryGrid';
import { SharedTabs } from '../components/SharedTabs';
import { SharedWithMeCard } from '../components/SharedWithMeCard';
import {
  useSharedByMeQuery,
  useSharedSummaryQuery,
  useSharedWithMeQuery,
} from '../hooks/useSharedQueries';
import type { SharedRoleFilter, SharedSort, SharedTab } from '../types/shared.types';
import styles from './SharedPage.module.css';

export function SharedPage() {
  const [activeTab, setActiveTab] = useState<SharedTab>('with-me');
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [sort, setSort] = useState<SharedSort>('updated');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [role, setRole] = useState<SharedRoleFilter>('');
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const withMeFilters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      sort,
      workspaceId: workspaceId ?? undefined,
      role: role || undefined,
    }),
    [debouncedSearch, sort, workspaceId, role],
  );

  const byMeFilters = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      sort,
      workspaceId: workspaceId ?? undefined,
    }),
    [debouncedSearch, sort, workspaceId],
  );

  const summaryQuery = useSharedSummaryQuery();
  const withMeSourceQuery = useSharedWithMeQuery({ sort: 'title' });
  const byMeSourceQuery = useSharedByMeQuery({ sort: 'title' });
  const withMeQuery = useSharedWithMeQuery(withMeFilters);
  const byMeQuery = useSharedByMeQuery(byMeFilters);

  const summary = summaryQuery.data;
  const withMeDocs = withMeQuery.data?.documents ?? [];
  const byMeDocs = byMeQuery.data?.documents ?? [];
  const activeDocs = activeTab === 'with-me' ? withMeDocs : byMeDocs;
  const activeLoading = activeTab === 'with-me' ? withMeQuery.isLoading : byMeQuery.isLoading;

  const workspaceOptions = useMemo(() => {
    const map = new Map<string, string>();
    const source =
      activeTab === 'with-me'
        ? withMeSourceQuery.data?.documents ?? []
        : byMeSourceQuery.data?.documents ?? [];

    for (const doc of source) {
      const label = doc.workspaceName?.trim() || 'Kişisel';
      map.set(doc.workspaceId, label);
    }

    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  }, [activeTab, withMeSourceQuery.data?.documents, byMeSourceQuery.data?.documents]);

  const hasActiveFilters = Boolean(
    debouncedSearch.trim() ||
      workspaceId ||
      sort !== 'updated' ||
      (activeTab === 'with-me' && role),
  );

  useEffect(() => {
    setRole('');
  }, [activeTab]);

  const clearFilters = () => {
    setSearch('');
    setWorkspaceId(null);
    setSort('updated');
    setRole('');
  };

  const tabTotal =
    activeTab === 'with-me' ? (summary?.withMeCount ?? 0) : (summary?.byMeCount ?? 0);

  const emptyVariant: 'empty' | 'no-results' =
    !hasActiveFilters && tabTotal === 0 ? 'empty' : 'no-results';

  const showEmptyList = !activeLoading && activeDocs.length === 0;

  return (
    <div className={styles.page}>
      <SharedHero onNewDocument={openCreate} />
      <SharedSummaryGrid loading={summaryQuery.isLoading} summary={summary} />
      <SharedTabs
        activeTab={activeTab}
        withMeCount={summary?.withMeCount ?? 0}
        byMeCount={summary?.byMeCount ?? 0}
        onChange={setActiveTab}
      />
      <SharedFilters
        activeTab={activeTab}
        search={search}
        sort={sort}
        workspaceId={workspaceId}
        role={role}
        workspaceOptions={workspaceOptions}
        resultCount={activeDocs.length}
        hasActiveFilters={hasActiveFilters}
        onSearchChange={setSearch}
        onSortChange={setSort}
        onWorkspaceChange={setWorkspaceId}
        onRoleChange={setRole}
        onClearFilters={clearFilters}
      />
      {activeLoading ? (
        <section className={styles.grid} aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.cardSkeleton} />
          ))}
        </section>
      ) : showEmptyList ? (
        <SharedEmptyState
          tab={activeTab}
          variant={emptyVariant}
          onClearFilters={clearFilters}
        />
      ) : (
        <section className={styles.grid}>
          {activeTab === 'with-me'
            ? withMeDocs.map((doc) => <SharedWithMeCard key={doc.id} document={doc} />)
            : byMeDocs.map((doc) => <SharedByMeCard key={doc.id} document={doc} />)}
        </section>
      )}
      <Modal opened={createOpened} onClose={closeCreate} title="Yeni doküman" centered radius="md">
        <CreateDocumentModal opened={createOpened} onClose={closeCreate} onCreated={() => closeCreate()} />
      </Modal>
    </div>
  );
}
