import { SegmentedControl } from '@mantine/core';
import { IconLayoutGrid, IconList } from '@tabler/icons-react';
import type { DocumentsDisplayMode } from '../hooks/useDocumentsViewMode';
import styles from '../pages/DocumentsPage.module.css';

type DocumentsViewModeToggleProps = {
  value: DocumentsDisplayMode;
  onChange: (value: DocumentsDisplayMode) => void;
};

export function DocumentsViewModeToggle({
  value,
  onChange,
}: DocumentsViewModeToggleProps) {
  return (
    <SegmentedControl
      className={styles.viewModeToggle}
      value={value}
      onChange={(v) => onChange(v as DocumentsDisplayMode)}
      data={[
        {
          value: 'grid',
          label: (
            <span className={styles.viewModeLabel}>
              <IconLayoutGrid size={16} />
              Grid
            </span>
          ),
        },
        {
          value: 'list',
          label: (
            <span className={styles.viewModeLabel}>
              <IconList size={16} />
              Liste
            </span>
          ),
        },
      ]}
    />
  );
}
