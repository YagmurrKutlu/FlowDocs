import { Button, Select, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { TrashDocumentSort } from '../types/trash.types';
import styles from '../pages/TrashPage.module.css';

export type WorkspaceFilterOption = {
  value: string;
  label: string;
};

type TrashFiltersProps = {
  search: string;
  sort: TrashDocumentSort;
  workspaceId: string | null;
  workspaceOptions: WorkspaceFilterOption[];
  resultCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: TrashDocumentSort) => void;
  onWorkspaceChange: (value: string | null) => void;
  onClearFilters: () => void;
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'En yeni silinen' },
  { value: 'oldest', label: 'En eski silinen' },
  { value: 'title', label: 'Ada göre' },
] as const;

function formatResultCount(count: number): string {
  if (count === 1) return '1 doküman bulundu';
  return `${count} doküman bulundu`;
}

export function TrashFilters({
  search,
  sort,
  workspaceId,
  workspaceOptions,
  resultCount,
  hasActiveFilters,
  onSearchChange,
  onSortChange,
  onWorkspaceChange,
  onClearFilters,
}: TrashFiltersProps) {
  const showWorkspaceFilter = workspaceOptions.length > 0;

  return (
    <section className={styles.filtersPanel}>
      <div className={styles.filtersRow}>
        <TextInput
          className={styles.searchInput}
          placeholder="Silinen dokümanlarda ara..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <Select
          className={styles.sortSelect}
          data={[...SORT_OPTIONS]}
          value={sort}
          onChange={(value) =>
            onSortChange((value as TrashDocumentSort) ?? 'newest')
          }
          allowDeselect={false}
        />
        {showWorkspaceFilter ? (
          <Select
            className={styles.workspaceSelect}
            data={[
              { value: '', label: 'Tüm çalışma alanları' },
              ...workspaceOptions,
            ]}
            value={workspaceId ?? ''}
            onChange={(value) => onWorkspaceChange(value || null)}
            allowDeselect={false}
          />
        ) : null}
      </div>
      <div className={styles.filtersFooter}>
        <p className={styles.resultCount}>
          <strong>{formatResultCount(resultCount)}</strong>
        </p>
        {hasActiveFilters ? (
          <Button variant="subtle" color="gray" size="compact-sm" onClick={onClearFilters}>
            Filtreleri temizle
          </Button>
        ) : null}
      </div>
    </section>
  );
}
