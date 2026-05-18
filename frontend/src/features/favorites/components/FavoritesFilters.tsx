import { Button, Select, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { FavoritesSort } from '../types/favorites.types';
import styles from '../pages/FavoritesPage.module.css';

export type WorkspaceFilterOption = { value: string; label: string };

type FavoritesFiltersProps = {
  search: string;
  sort: FavoritesSort;
  workspaceId: string | null;
  workspaceOptions: WorkspaceFilterOption[];
  resultCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: FavoritesSort) => void;
  onWorkspaceChange: (value: string | null) => void;
  onClearFilters: () => void;
};

const SORT_OPTIONS = [
  { value: 'recent', label: 'Son favorilenen' },
  { value: 'updated', label: 'Son güncellenen' },
  { value: 'title', label: 'Ada göre' },
] as const;

export function FavoritesFilters({
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
}: FavoritesFiltersProps) {
  return (
    <section className={styles.filtersPanel}>
      <div className={styles.filtersRow}>
        <TextInput
          className={styles.searchInput}
          placeholder="Favorilerde ara..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <Select
          className={styles.sortSelect}
          data={[...SORT_OPTIONS]}
          value={sort}
          onChange={(v) => onSortChange((v as FavoritesSort) ?? 'recent')}
          allowDeselect={false}
        />
        <Select
          className={styles.workspaceSelect}
          data={[
            { value: '', label: 'Tüm çalışma alanları' },
            ...workspaceOptions,
          ]}
          value={workspaceId ?? ''}
          onChange={(v) => onWorkspaceChange(v || null)}
          allowDeselect={false}
          disabled={workspaceOptions.length === 0}
        />
      </div>
      <div className={styles.filtersFooter}>
        <p className={styles.resultCount}>
          <strong>
            {resultCount === 1
              ? '1 favori bulundu'
              : `${resultCount} favori bulundu`}
          </strong>
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
