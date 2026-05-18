import { Button, Group } from '@mantine/core';
import {
  IconStar,
  IconStarOff,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import styles from '../pages/DocumentsPage.module.css';

type DocumentsSelectionToolbarProps = {
  selectedCount: number;
  deletableCount: number;
  favoriteLoading: boolean;
  trashLoading: boolean;
  onClearSelection: () => void;
  onAddFavorites: () => void;
  onRemoveFavorites: () => void;
  onMoveToTrash: () => void;
};

export function DocumentsSelectionToolbar({
  selectedCount,
  deletableCount,
  favoriteLoading,
  trashLoading,
  onClearSelection,
  onAddFavorites,
  onRemoveFavorites,
  onMoveToTrash,
}: DocumentsSelectionToolbarProps) {
  const trashHint =
    deletableCount < selectedCount
      ? ` (${deletableCount}/${selectedCount} taşınabilir)`
      : '';

  return (
    <section className={styles.selectionToolbar} aria-live="polite">
      <p className={styles.selectionInfo}>
        {selectedCount === 1
          ? '1 doküman seçildi'
          : `${selectedCount} doküman seçildi`}
      </p>
      <Group className={styles.selectionActions} gap={10} wrap="wrap">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconX size={16} />}
          onClick={onClearSelection}
        >
          Seçimi Temizle
        </Button>
        <Button
          className={styles.bulkFavoriteBtn}
          variant="light"
          color="yellow"
          leftSection={<IconStar size={16} />}
          loading={favoriteLoading}
          onClick={onAddFavorites}
        >
          Favorilere Ekle
        </Button>
        <Button
          className={styles.bulkFavoriteBtn}
          variant="light"
          color="gray"
          leftSection={<IconStarOff size={16} />}
          loading={favoriteLoading}
          onClick={onRemoveFavorites}
        >
          Favorilerden Çıkar
        </Button>
        <Button
          className={styles.bulkTrashBtn}
          variant="light"
          color="orange"
          leftSection={<IconTrash size={16} />}
          loading={trashLoading}
          onClick={onMoveToTrash}
        >
          Çöp Kutusuna Taşı{trashHint}
        </Button>
      </Group>
    </section>
  );
}
