import { Button } from '@mantine/core';
import { IconCopy, IconExternalLink, IconFileText, IconUsers } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { DocumentFavoriteButton } from '../../documents/components/DocumentFavoriteButton';
import { useOpenSharedDocument } from '../hooks/useOpenSharedDocument';
import {
  copyDocumentLink,
  formatDateTime,
  previewSnippet,
  sharedUserCountLabel,
  workspaceDisplayName,
} from '../shared.utils';
import type { SharedByMeDocument } from '../types/shared.types';
import styles from '../pages/SharedPage.module.css';

type SharedByMeCardProps = {
  document: SharedByMeDocument;
};

export function SharedByMeCard({ document: doc }: SharedByMeCardProps) {
  const { openDocument } = useOpenSharedDocument();

  const handleCopyLink = async () => {
    const ok = await copyDocumentLink(doc.id);
    notifications.show({
      color: ok ? 'green' : 'red',
      message: ok ? 'Doküman bağlantısı kopyalandı.' : 'Bağlantı kopyalanamadı.',
    });
  };

  return (
    <article className={styles.docCard}>
      <div className={styles.docCardHeader}>
        <div className={styles.docIconWrap} aria-hidden>
          <IconFileText size={22} stroke={1.6} />
        </div>
        <DocumentFavoriteButton documentId={doc.id} isFavorite={doc.isFavorite} />
      </div>
      <h2 className={styles.docTitle} title={doc.title}>
        {doc.title}
      </h2>
      <div className={styles.badgeRow}>
        <span className={styles.workspaceBadge} title={workspaceDisplayName(doc.workspaceName)}>
          {workspaceDisplayName(doc.workspaceName)}
        </span>
        <span className={styles.sharedCountPill}>
          <IconUsers size={14} />
          {sharedUserCountLabel(doc.sharedUserCount)}
        </span>
      </div>
      <div className={styles.rolePills}>
        <span
          className={`${styles.miniBadgeEditor} ${doc.editorCount === 0 ? styles.miniBadgeMuted : ''}`}
        >
          {doc.editorCount} Editor
        </span>
        <span
          className={`${styles.miniBadgeViewer} ${doc.viewerCount === 0 ? styles.miniBadgeMuted : ''}`}
        >
          {doc.viewerCount} Viewer
        </span>
      </div>
      <p className={styles.preview}>{previewSnippet(doc.previewContent)}</p>
      <p className={styles.updatedLine}>
        Son güncelleme: {formatDateTime(doc.updatedAt)}
      </p>
      <div className={styles.cardActions}>
        <Button
          className={styles.openBtn}
          size="sm"
          leftSection={<IconExternalLink size={14} />}
          onClick={() => openDocument(doc.id)}
        >
          Aç
        </Button>
        <Button
          className={styles.copyBtn}
          size="sm"
          leftSection={<IconCopy size={14} />}
          onClick={() => void handleCopyLink()}
        >
          Linki Kopyala
        </Button>
        <Button
          className={styles.manageBtnPrimary}
          size="sm"
          onClick={() => openDocument(doc.id, { share: true })}
        >
          Paylaşımı Yönet
        </Button>
      </div>
    </article>
  );
}
