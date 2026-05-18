import { Button, Select, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { DocumentsDisplayMode } from '../hooks/useDocumentsViewMode';
import type {
  DocumentsRoleFilter,
  DocumentsSort,
} from '../types/document.types';
import { DocumentsViewModeToggle } from './DocumentsViewModeToggle';
import styles from '../pages/DocumentsPage.module.css';

export type WorkspaceFilterOption = { value: string; label: string };

type DocumentsFiltersProps = {
  search: string;
  sort: DocumentsSort;
  workspaceId: string | null;
  role: DocumentsRoleFilter;
  workspaceOptions: WorkspaceFilterOption[];
  resultCount: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: DocumentsSort) => void;
  onWorkspaceChange: (value: string | null) => void;
  onRoleChange: (value: DocumentsRoleFilter) => void;
  onClearFilters: () => void;
  viewMode: DocumentsDisplayMode;
  onViewModeChange: (mode: DocumentsDisplayMode) => void;
};

const SORT_OPTIONS = [
  { value: 'updated', label: 'Son güncellenen' },
  { value: 'created', label: 'Yeni oluşturulan' },
  { value: 'title', label: 'Ada göre' },
  { value: 'favorite', label: 'Favoriler önce' },
] as const;

const ROLE_OPTIONS = [
  { value: '', label: 'Tüm roller' },
  { value: 'OWNER', label: 'Owner' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'VIEWER', label: 'Viewer' },
] as const;

export function DocumentsFilters({
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
  viewMode,
  onViewModeChange,
}: DocumentsFiltersProps) {
  return (
    <section className={styles.filtersPanel}>
      <div className={styles.filtersRow}>
        <TextInput
          className={styles.searchInput}
          placeholder="Dokümanlarda ara..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <Select
          className={styles.sortSelect}
          data={[...SORT_OPTIONS]}
          value={sort}
          onChange={(v) => onSortChange((v as DocumentsSort) ?? 'updated')}
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
        <Select
          className={styles.roleSelect}
          data={[...ROLE_OPTIONS]}
          value={role}
          onChange={(v) => onRoleChange((v as DocumentsRoleFilter) ?? '')}
          allowDeselect={false}
        />
      </div>
      <div className={styles.filtersFooter}>
        <p className={styles.resultCount}>
          <strong>
            {resultCount === 1
              ? '1 doküman bulundu'
              : `${resultCount} doküman bulundu`}
          </strong>
        </p>
        <div className={styles.filtersFooterRight}>
          <DocumentsViewModeToggle value={viewMode} onChange={onViewModeChange} />
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
      </div>
    </section>
  );
}
