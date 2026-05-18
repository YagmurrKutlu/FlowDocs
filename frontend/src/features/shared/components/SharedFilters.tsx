import { Button, Select, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { SharedRoleFilter, SharedSort, SharedTab } from '../types/shared.types';
import styles from '../pages/SharedPage.module.css';

export type WorkspaceFilterOption = { value: string; label: string };

type SharedFiltersProps = {
  activeTab: SharedTab;
  search: string;
  sort: SharedSort;
  workspaceId: string | null;
  role: SharedRoleFilter;
  workspaceOptions: WorkspaceFilterOption[];
  resultCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: SharedSort) => void;
  onWorkspaceChange: (value: string | null) => void;
  onRoleChange: (value: SharedRoleFilter) => void;
  onClearFilters: () => void;
};

const SORT_OPTIONS = [
  { value: 'updated', label: 'Son güncellenen' },
  { value: 'recent', label: 'Son paylaşılan' },
  { value: 'title', label: 'Ada göre' },
] as const;

const ROLE_OPTIONS = [
  { value: '', label: 'Tüm roller' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'VIEWER', label: 'Viewer' },
] as const;

export function SharedFilters({
  activeTab,
  search,
  sort,
  workspaceId,
  role,
  workspaceOptions,
  resultCount,
  hasActiveFilters,
  onSearchChange,
  onSortChange,
  onWorkspaceChange,
  onRoleChange,
  onClearFilters,
}: SharedFiltersProps) {
  return (
    <section className={styles.filtersPanel}>
      <div className={styles.filtersRow}>
        <TextInput
          className={styles.searchInput}
          placeholder="Paylaşılan dokümanlarda ara..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <Select
          className={styles.sortSelect}
          data={[...SORT_OPTIONS]}
          value={sort}
          onChange={(v) => onSortChange((v as SharedSort) ?? 'updated')}
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
        {activeTab === 'with-me' ? (
          <Select
            className={styles.roleSelect}
            data={[...ROLE_OPTIONS]}
            value={role}
            onChange={(v) => onRoleChange((v as SharedRoleFilter) ?? '')}
            allowDeselect={false}
          />
        ) : null}
      </div>
      <div className={styles.filtersFooter}>
        <p className={styles.resultCount}>
          <strong>
            {resultCount === 1
              ? '1 doküman bulundu'
              : `${resultCount} doküman bulundu`}
          </strong>
        </p>
        <Button
          className={`${styles.clearFiltersBtn} ${hasActiveFilters ? styles.clearFiltersBtnActive : styles.clearFiltersBtnDisabled}`}
          variant="light"
          color="violet"
          size="compact-sm"
          disabled={!hasActiveFilters}
          onClick={onClearFilters}
        >
          Filtreleri temizle
        </Button>
      </div>
    </section>
  );
}
