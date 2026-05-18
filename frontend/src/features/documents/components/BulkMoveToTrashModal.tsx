import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import styles from '../pages/DocumentsPage.module.css';

type BulkMoveToTrashModalProps = {
  opened: boolean;
  selectedCount: number;
  deletableCount: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function BulkMoveToTrashModal({
  opened,
  selectedCount,
  deletableCount,
  loading,
  onClose,
  onConfirm,
}: BulkMoveToTrashModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Seçili dokümanlar çöp kutusuna taşınsın mı?"
      centered
      radius="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Bu işlem kalıcı değildir. Dokümanları Çöp Kutusu sayfasından geri
          yükleyebilirsiniz.
        </Text>
        <div className={styles.trashDetailBox}>
          <div className={styles.trashDetailRow}>
            <span className={styles.trashDetailLabel}>Seçim</span>
            <strong className={styles.trashDetailValue}>
              {selectedCount === 1
                ? '1 doküman seçildi'
                : `${selectedCount} doküman seçildi`}
            </strong>
          </div>
          {deletableCount < selectedCount ? (
            <div className={styles.trashDetailRow}>
              <span className={styles.trashDetailLabel}>Taşınabilir</span>
              <strong className={styles.trashDetailValue}>
                {deletableCount} / {selectedCount}
              </strong>
            </div>
          ) : null}
        </div>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={loading}>
            İptal
          </Button>
          <Button color="orange" loading={loading} onClick={onConfirm}>
            Çöp Kutusuna Taşı
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
