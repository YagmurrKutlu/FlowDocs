import { Button, Group } from '@mantine/core';
import { IconArrowBackUp, IconTrash, IconX } from '@tabler/icons-react';
import styles from '../pages/TrashPage.module.css';

type TrashSelectionToolbarProps = {
  selectedCount: number;
  restoreLoading: boolean;
  deleteLoading: boolean;
  onClearSelection: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
};

export function TrashSelectionToolbar({
  selectedCount,
  restoreLoading,
  deleteLoading,
  onClearSelection,
  onRestore,
  onPermanentDelete,
}: TrashSelectionToolbarProps) {
  return (
    <section className={styles.selectionToolbar} aria-live="polite">
      <p className={styles.selectionInfo}>{selectedCount} doküman seçildi</p>
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
          className={styles.restoreBtn}
          leftSection={<IconArrowBackUp size={16} />}
          loading={restoreLoading}
          onClick={onRestore}
        >
          Geri Yükle
        </Button>
        <Button
          className={styles.dangerBtn}
          leftSection={<IconTrash size={16} />}
          loading={deleteLoading}
          onClick={onPermanentDelete}
        >
          Kalıcı Sil
        </Button>
      </Group>
    </section>
  );
}
