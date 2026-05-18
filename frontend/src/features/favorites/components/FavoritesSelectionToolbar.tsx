import { Button, Group } from '@mantine/core';
import { IconStarOff, IconX } from '@tabler/icons-react';
import styles from '../pages/FavoritesPage.module.css';

type FavoritesSelectionToolbarProps = {
  selectedCount: number;
  removeLoading: boolean;
  onClearSelection: () => void;
  onRemoveSelected: () => void;
};

export function FavoritesSelectionToolbar({
  selectedCount,
  removeLoading,
  onClearSelection,
  onRemoveSelected,
}: FavoritesSelectionToolbarProps) {
  return (
    <section className={styles.selectionToolbar} aria-live="polite">
      <p className={styles.selectionInfo}>
        {selectedCount === 1 ? '1 favori seçildi' : `${selectedCount} favori seçildi`}
      </p>
      <Group className={styles.selectionActions} gap={10}>
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconX size={16} />}
          onClick={onClearSelection}
        >
          Seçimi temizle
        </Button>
        <Button
          className={styles.bulkRemoveBtn}
          leftSection={<IconStarOff size={16} />}
          loading={removeLoading}
          onClick={onRemoveSelected}
        >
          Seçilenleri favorilerden çıkar
        </Button>
      </Group>
    </section>
  );
}
