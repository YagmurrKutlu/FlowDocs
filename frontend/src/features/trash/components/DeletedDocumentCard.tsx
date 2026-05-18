import { Button, Checkbox } from '@mantine/core';
import { IconFileText } from '@tabler/icons-react';
import type { TrashDocumentItem } from '../types/trash.types';
import styles from '../pages/TrashPage.module.css';

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

type DeletedDocumentCardProps = {
  document: TrashDocumentItem;
  selected: boolean;
  restoreLoading: boolean;
  deleteLoading: boolean;
  onToggleSelect: (documentId: string) => void;
  onRestore: (document: TrashDocumentItem) => void;
  onPermanentDelete: (document: TrashDocumentItem) => void;
};

export function DeletedDocumentCard({
  document,
  selected,
  restoreLoading,
  deleteLoading,
  onToggleSelect,
  onRestore,
  onPermanentDelete,
}: DeletedDocumentCardProps) {
  const deletedByLabel = document.deletedBy?.name ?? 'Bilinmiyor';
  const urgentRetention =
    document.daysUntilPolicyLimit > 0 && document.daysUntilPolicyLimit <= 7;
  const retentionLabel =
    document.daysUntilPolicyLimit <= 0
      ? 'Politika süresi doldu'
      : `${document.daysUntilPolicyLimit} gün kaldı`;

  return (
    <article
      className={`${styles.docCard} ${selected ? styles.docCardSelected : ''} ${styles.docCardDangerHover}`}
    >
      <Checkbox
        className={styles.cardCheckbox}
        checked={selected}
        onChange={() => onToggleSelect(document.id)}
        aria-label={`${document.title} seç`}
      />
      <div className={styles.docIconWrap} aria-hidden>
        <IconFileText size={22} stroke={1.6} />
      </div>
      <div className={styles.docBody}>
        <div className={styles.docTitleRow}>
          <h2 className={styles.docTitle} title={document.title}>
            {document.title}
          </h2>
          <span className={styles.workspaceBadge} title={document.workspaceName}>
            {document.workspaceName}
          </span>
          <span
            className={`${styles.retentionBadge} ${urgentRetention ? styles.retentionBadgeUrgent : ''}`}
          >
            {retentionLabel}
          </span>
        </div>
        <ul className={styles.docMeta}>
          <li>
            <span className={styles.docMetaLabel}>Silinme</span>
            <span className={styles.docMetaValue}>
              {formatDateTime(document.deletedAt)}
            </span>
          </li>
          <li>
            <span className={styles.docMetaLabel}>Silen</span>
            <span className={styles.docMetaValue}>{deletedByLabel}</span>
          </li>
          <li>
            <span className={styles.docMetaLabel}>Son güncelleme</span>
            <span className={styles.docMetaValue}>
              {formatDateTime(document.lastUpdatedAt)}
            </span>
          </li>
          <li>
            <span className={styles.docMetaLabel}>Üye sayısı</span>
            <span className={styles.docMetaValue}>{document.memberCount}</span>
          </li>
        </ul>
      </div>
      <div className={styles.docActions}>
        <Button
          className={styles.cardRestoreBtn}
          size="sm"
          loading={restoreLoading}
          onClick={() => onRestore(document)}
        >
          Geri Yükle
        </Button>
        <Button
          className={styles.cardDeleteBtn}
          size="sm"
          loading={deleteLoading}
          onClick={() => onPermanentDelete(document)}
        >
          Kalıcı Sil
        </Button>
      </div>
    </article>
  );
}
