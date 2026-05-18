import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { formatRoleLabel } from '../documents.utils';
import styles from '../pages/DocumentsPage.module.css';

type MoveToTrashModalProps = {
  opened: boolean;
  documentTitle: string;
  workspaceName: string;
  role: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function MoveToTrashModal({
  opened,
  documentTitle,
  workspaceName,
  role,
  loading,
  onClose,
  onConfirm,
}: MoveToTrashModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Doküman çöp kutusuna taşınsın mı?"
      centered
      radius="md"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Bu işlem kalıcı değildir. Dokümanı Çöp Kutusu sayfasından geri yükleyebilirsiniz.
        </Text>
        <div className={styles.trashDetailBox}>
          <div className={styles.trashDetailRow}>
            <span className={styles.trashDetailLabel}>Doküman adı</span>
            <strong className={styles.trashDetailValue}>{documentTitle}</strong>
          </div>
          <div className={styles.trashDetailRow}>
            <span className={styles.trashDetailLabel}>Çalışma alanı</span>
            <strong className={styles.trashDetailValue}>{workspaceName}</strong>
          </div>
          <div className={styles.trashDetailRow}>
            <span className={styles.trashDetailLabel}>Rol</span>
            <strong className={styles.trashDetailValue}>{formatRoleLabel(role)}</strong>
          </div>
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
