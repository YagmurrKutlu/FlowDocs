import { Button, Group, Modal, Text } from '@mantine/core';
import type { TrashDocumentItem } from '../types/trash.types';
import styles from './RestoreConfirmModal.module.css';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

type RestoreConfirmModalProps = {
  opened: boolean;
  mode: 'single' | 'bulk';
  document?: TrashDocumentItem;
  count?: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function RestoreConfirmModal({
  opened,
  mode,
  document,
  count = 0,
  loading,
  onClose,
  onConfirm,
}: RestoreConfirmModalProps) {
  const title =
    mode === 'bulk'
      ? 'Seçili dokümanlar geri yüklensin mi?'
      : 'Dokümanı geri yükle?';

  const description =
    mode === 'bulk'
      ? `${count} doküman tekrar dokümanlarınız arasında görünecek.`
      : `${document?.title ?? 'Bu doküman'} tekrar dokümanlarınız arasında görünecek.`;

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered radius="md">
      <Text size="sm" c="dimmed" className={styles.description}>
        {description}
      </Text>
      {mode === 'single' && document ? (
        <dl className={styles.detailBox}>
          <div className={styles.detailRow}>
            <dt className={styles.detailLabel}>Çalışma alanı</dt>
            <dd className={styles.detailValue}>{document.workspaceName}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailLabel}>Silinme tarihi</dt>
            <dd className={styles.detailValue}>
              {formatDateTime(document.deletedAt)}
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt className={styles.detailLabel}>Silen kişi</dt>
            <dd className={styles.detailValue}>
              {document.deletedBy?.name ?? '—'}
            </dd>
          </div>
        </dl>
      ) : null}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose} disabled={loading}>
          İptal
        </Button>
        <Button color="green" loading={loading} onClick={onConfirm}>
          Geri Yükle
        </Button>
      </Group>
    </Modal>
  );
}
